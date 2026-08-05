import yahooFinanceDefault from 'yahoo-finance2';
import { apiUsageTracker, __test__ as usageTestSeam, getProviderUsage as _getProviderUsage } from './apiUsageTracker';
import NodeCache from 'node-cache';
import {
  AnalystTrendPoint,
  AnalystTrends,
  BatchQuoteResponse,
  CashFlowRow,
  ChartSeries,
  CompanyProfile,
  EarningsEvent,
  FinancialStatements,
  FinancialScores,
  FxCurrency,
  FxRatesResponse,
  IncomeStatementRow,
  BalanceSheetRow,
  InsiderTransaction,
  InsightsTabEntry,
  InsightsTabId,
  InsightsTabResponse,
  KeyMetricsTTM,
  NewsItem,
  ProviderHealthEntry,
  ProviderHealthFeature,
  ProviderHealthResponse,
  RatiosTTM,
  SectorHeatmapMetadata,
  SectorHeatmapResponse,
  SmaDistanceResponse,
  SmaDistanceRow,
  StockMetrics,
  StockQuote,
  YahooFallbackFinancials,
} from '../../shared/api';
import { insightsTabUniverses } from './insightsUniverses';
// Relative path (not `@shared/...`) so the helper resolves cleanly under Vite's
// config-file resolver, which doesn't apply its own `resolve.alias` map when
// bundling vite.config.ts at startup. The TS path alias still works — this is
// purely a runtime resolution concern at config-load time.
import { aggregateSectorHeatmap, type SectorHeatmapInputRow } from '../../shared/aggregateSectorHeatmap';
import {
  buildFmpBatchUrl,
  buildHeatmapRows,
  buildSectorHeatmapCacheKey,
  canonicalSymbols,
  createInFlightRegistry,
  orderByRequestedSymbols,
  resolveOrderedBatch,
} from './marketDataReliability';
import { normalizeSectorMeta } from '../../shared/sectorMeta';
import { providerStatusFromProbe } from '../../shared/providerHealth';

// yahoo-finance2 v4 ships the class as its default export. Use one shared
// instance per process; constructing it "throwaway" per call degrades
// Yahoo's rate-limit grace and triggers the survey notice on every fetch.
const yahooFinanceInner = new yahooFinanceDefault({ suppressNotices: ['yahooSurvey'] });
// Wrap each method in a Proxy that records one call per top-level
// invocation in apiUsageTracker. Every fetchYahooQuote / yahooFinance.quoteSummary
// / yahooFinance.chart / yahooFinance.search call auto-counts without
// each call site having to opt in. The proxy only intercepts function
// props; non-function props (constants, promises) pass through.
const yahooFinance: typeof yahooFinanceInner = new Proxy(yahooFinanceInner, {
  get(target, prop: string | symbol) {
    const value = (target as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return (...args: unknown[]) => {
        apiUsageTracker.recordCall('yahoo');
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    }
    return value;
  },
});
// Re-export the test seam so vitest can reset the bucket between specs.
export { usageTestSeam };

/**
 * Upstream-aware stock data layer.
 *
 * Strategy: this file discusses with FMP via the /stable/ path, which is
 * the only endpoint family FMP still serves for current keys (the legacy
 * /api/v3/ endpoints were deprecated in 2025 — see docs/endpoints.md). Set
 * FMP_USE_STABLE=0 to opt back into the legacy v3 shapes for
 * grandfather-licensed keys.
 *
 * Every function returns the shared shape from shared/api.ts (never `any`).
 * Normalizers live inline so callers don't have to know which upstream API
 * was used for any given field.
 */

// ---- Cache ----------------------------------------------------------------
const cache = new NodeCache({ stdTTL: 3600, maxKeys: 10000 });
const QUOTE_TTL = 60; // 1 min — quotes are the only thing we ever refetch live
const QUOTE_NEGATIVE_TTL = 15; // Briefly suppress repeated misses without hiding recovery.
const PROFILE_NEGATIVE_TTL = 30; // Provider outages/not-found responses are retryable.
const CHART_NEGATIVE_TTL = 30; // Avoid retry storms while preserving recovery from provider outages.
const SECTOR_HEATMAP_TTL = 900; // 15 min — heatmap recomputation cache (day deltas are slow-moving)
const MAX_EARNINGS_ENRICH_SYMBOLS = 100; // protect provider quotas on unusually large calendars
// Health probes: 2 of the 5 calls are FMP (quote + batch-quote; the other
// three — Yahoo quote, Yahoo chart, AlphaVantage quote — are keyless or
// keyed on separate budgets), so 1-min polling would burn ~120 FMP
// requests/hour against the 250/day free cap. 5 min keeps worst-case FMP
// spend ~24/hour while staying reactive (widgets also badge on their own
// request failures immediately, independent of this).
const PROVIDER_HEALTH_TTL = 300; // seconds — server re-probes at most every 5 min
const PROVIDER_HEALTH_TIMEOUT_MS = 8_000; // per-provider probe timeout

// ---- Warn throttling --------------------------------------
const lastWarnAt = new Map<string, number>();
const WARN_THROTTLE_MS = 60_000;

const quoteInFlight = createInFlightRegistry();
const batchQuoteInFlight = createInFlightRegistry();
const profileInFlight = createInFlightRegistry();
const chartInFlight = createInFlightRegistry();
const heatmapInFlight = createInFlightRegistry();
const healthInFlight = createInFlightRegistry();
// Coalesces concurrent fallback-financials calls during a Yahoo outage
// (when many requesters see FMP's 429 at once and pivot to the Yahoo
// fallback path). Same module-scoped lifetime as the other registries.
const yahooFallbackInFlight = createInFlightRegistry();

/** Throttle to once-per-key per minute. Logs once per (function, symbol) per minute. */
function throttledWarn(key: string, ...args: unknown[]): void {
  const now = Date.now();
  const last = lastWarnAt.get(key);
  if (last !== undefined && now - last < WARN_THROTTLE_MS) return;
  lastWarnAt.set(key, now);
  console.warn(...args);
}

// ---- Key/env --------------------------------------------------------------
const FMP_KEY = process.env.FMP_KEY || '';
const AV_KEY = process.env.AV_KEY || '';

/**
 * FMP deprecated the legacy /api/v3/ endpoints for all but pre-Aug-2025
 * subscribers; /stable/ is the canonical API now. We default to /stable/
 * and allow opting back into the legacy v3 shapes with FMP_USE_STABLE=0
 * (e.g. for grandfather-licensed keys).
 */
const FMP_USE_STABLE = process.env.FMP_USE_STABLE !== '0';
const FMP_BASE = FMP_USE_STABLE ? 'https://financialmodelingprep.com/stable' : 'https://financialmodelingprep.com/api/v3';

/** Earnings-calendar endpoint name — `/stable/` uses `earnings-calendar` (plural, hyphen); legacy v3 still accepts `earning_calendar` (singular, underscore). Hoisted alongside `FMP_BASE` so both shape decisions read the same env var at module init. */
const EARNINGS_ENDPOINT = FMP_USE_STABLE ? 'earnings-calendar' : 'earning_calendar';

/**
 * Chart endpoint — `/stable/` exposes EOD bars via `historical-price-eod/full`
 * (full OHLC + vwap) and `/historical-price-eod/light` (lean: just
 * `{symbol,date,price,volume}` — NO open/high/low/close). The legacy v3
 * path `historical-price-full` 404s on `/stable/`. We pick `/full` so the
 * chart UI sees real OHLC bar geometry; Yahoo historical remains the
 * always-on fallback.
 */
const CHART_ENDPOINT = FMP_USE_STABLE ? 'historical-price-eod/full' : 'historical-price-full';

/**
 * Quote endpoint — `/stable/` requires the query-param shape `?symbol=...`;
 * `quote/{symbol}` (path-segment) 404s on `/stable/`. v3 accepted both. We
 * pick the shape that works on the active base so the rest of the file stays
 * branchless.
 */
const QUOTE_USE_QUERY_PARAM = FMP_USE_STABLE;

/**
 * Determines whether an FMP API key is configured.
 *
 * @returns `true` if an FMP API key is available, `false` otherwise.
 */
function hasFmp(): boolean {
  return typeof FMP_KEY === 'string' && FMP_KEY.length > 0;
}

/**
 * Fetches JSON data from a URL within the specified timeout.
 *
 * Exported only as a test seam: the diagnostic classification
 * (http_<status> / invalid_json / timeout / network_error) is exercised
 * deterministically in server/services/stockService.spec.ts with a mocked
 * global fetch. Not part of the public service API.
 *
 * @param url - The URL to request
 * @param label - Identifier used for warning messages
 * @param timeoutMs - Maximum request duration in milliseconds
 * @returns The parsed response data, or `null` when the request fails
 */
export async function fetchJSON<T = any>(url: string, label: string, timeoutMs = 12000): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      // 404 / 403 from FMP shows up here — caller decides what to do.
      throttledWarn(`fetcher:${label}:http`, `[stockService] ${label} failed: http_${res.status}`);
      return null;
    }
    try {
      return (await res.json()) as T;
    } catch {
      throttledWarn(`fetcher:${label}:json`, `[stockService] ${label} failed: invalid_json`);
      return null;
    }
  } catch (e: any) {
    const kind = e?.name === 'AbortError' ? 'timeout' : 'network_error';
    throttledWarn(`fetcher:${label}:${kind}`, `[stockService] ${label} failed: ${kind}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Builds an FMP API URL with the configured API key and query parameters.
 *
 * @param endpoint - The FMP API endpoint path
 * @param params - Additional query parameters
 * @returns The complete FMP API URL
 */
function fmpUrl(endpoint: string, params: Record<string, string | number> = {}): string {
  const qs = new URLSearchParams({ apikey: FMP_KEY, ...params as any }).toString();
  return `${FMP_BASE}/${endpoint}?${qs}`;
}

/**
 * Builds a single-ticker FMP URL using the active endpoint format.
 *
 * @param name - The FMP endpoint name
 * @param symbol - The ticker symbol
 * @param extra - Additional query parameters
 * @returns The complete FMP request URL
 */
function tickerUrl(name: string, symbol: string, extra: Record<string, string | number | boolean> = {}): string {
  if (QUOTE_USE_QUERY_PARAM) {
    const qs = new URLSearchParams({ apikey: FMP_KEY, symbol, ...extra as any }).toString();
    return `${FMP_BASE}/${name}?${qs}`;
  }
  const qs = new URLSearchParams({ apikey: FMP_KEY, ...extra as any }).toString();
  return `${FMP_BASE}/${name}/${symbol}?${qs}`;
}

// ---- Provider health helpers ------------------------------------------------
// Upstream error-body detection lives here; status classification
// (200 / 402 / 403 / 429 / other, plus the null-probe timeout branch) is
// shared with the client in shared/providerHealth.ts — see
// `providerStatusFromProbe`. FMP and AlphaVantage ALSO return HTTP 200
// with an error body (e.g. {"Error Message": "You have exceeded..."} /
// AV {"Note": ...}) for rate limits and bad keys — detect those and
// treat them as degraded too.
function detectUpstreamError(bodyText: string): string | null {
  try {
    const parsed = JSON.parse(bodyText);
    if (!parsed || typeof parsed !== 'object') return null;
    const msg =
      parsed['Error Message'] ??
      parsed.Note ??
      parsed.Information ??
      parsed.error ??
      parsed.message ??
      null;
    return typeof msg === 'string' && msg.length > 0 ? msg : null;
  } catch {
    return null;
  }
}

/** Probe a URL with a bounded timeout; null on network error/timeout. */
async function probeUrlStatus(
  url: string,
): Promise<{ status: number; latencyMs: number; errorMessage: string | null } | null> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROVIDER_HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const text = await res.text();
    return {
      status: res.status,
      latencyMs: Date.now() - started,
      errorMessage: detectUpstreamError(text),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Race a promise against a timeout, clearing the timer when it settles first. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// ---- Normalizers ----------------------------------------------------------
/** Convert an FMP profile object (camelCase OR PascalCase) to our shared shape. */
function normalizeProfile(raw: any): CompanyProfile {
  if (!raw || typeof raw !== 'object') {
    return {
      symbol: '', companyName: '', description: '', sector: '', industry: '',
      ceo: '', fullTimeEmployees: null, beta: null, peRatio: null,
    };
  }
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      if (raw[k] !== undefined && raw[k] !== null && raw[k] !== '') return raw[k];
    }
    return undefined;
  };
  const toNum = (v: unknown): number | null => {
    if (v === undefined || v === null || v === '') return null;
    const n = typeof v === 'string' ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : null;
  };
  const toBool = (v: unknown): boolean | undefined => {
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      const s = v.toLowerCase();
      if (s === 'true') return true;
      if (s === 'false') return false;
    }
    return undefined;
  };

  const employeesRaw = pick('fullTimeEmployees', 'FullTimeEmployees');
  return {
    symbol: String(pick('symbol', 'Symbol') ?? ''),
    companyName: String(pick('companyName', 'CompanyName') ?? ''),
    description: String(pick('description', 'Description') ?? ''),
    sector: String(pick('sector', 'Sector') ?? ''),
    industry: String(pick('industry', 'Industry') ?? ''),
    ceo: String(pick('ceo', 'CEO') ?? ''),
    website: pick('website', 'Website'),
    country: pick('country', 'Country'),
    state: pick('state', 'State'),
    city: pick('city', 'City'),
    address: pick('address', 'Address'),
    phone: pick('phone', 'Phone'),
    fullTimeEmployees: employeesRaw ? toNum(employeesRaw) : null,
    beta: toNum(pick('beta', 'Beta')),
    peRatio: toNum(pick('peRatio', 'PERatio', 'pe')),
    marketCap: toNum(pick('marketCap', 'mktCap', 'MarketCap')),
    price: toNum(pick('price', 'Price')),
    exchange: pick('exchange', 'Exchange'),
    exchangeFullName: pick('exchangeFullName', 'ExchangeFullName'),
    currency: pick('currency', 'Currency'),
    ipoDate: pick('ipoDate', 'IpoDate'),
    image: pick('image', 'Image'),
    /* ---- /stable/-only identity fields (always optional; absent on legacy v3) ---- */
    cik: pick('cik'),
    isin: pick('isin'),
    cusip: pick('cusip'),
    lastDividend: toNum(pick('lastDividend', 'LastDividend')) ?? undefined,
    isEtf: toBool(pick('isEtf', 'IsEtf')),
    isFund: toBool(pick('isFund', 'IsFund')),
    isAdr: toBool(pick('isAdr', 'IsAdr')),
    isActivelyTrading: toBool(pick('isActivelyTrading', 'IsActivelyTrading')),
    defaultImage: toBool(pick('defaultImage', 'DefaultImage')),
  };
}

function normalizeQuote(raw: any): StockQuote | null {
  if (!raw || typeof raw !== 'object') return null;
  const toNum = (v: unknown): number | undefined => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = typeof v === 'string' ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : undefined;
  };
  const price = toNum(raw.price);
  if (price === undefined || price <= 0) return null;
  return {
    symbol: String(raw.symbol ?? ''),
    name: raw.name ?? raw.companyName,
    price,
    change: toNum(raw.change) ?? 0,
    // /stable/ returns `changePercentage` (no 's'); legacy v3 returns
    // `changesPercentage`; very-legacy returns `changePercent`. Maintain
    // backward compatibility without breaking the /stable/ upgrade.
    changesPercentage: toNum(raw.changesPercentage ?? raw.changePercentage ?? raw.changePercent) ?? 0,
    previousClose: toNum(raw.previousClose),
    dayLow: toNum(raw.dayLow),
    dayHigh: toNum(raw.dayHigh),
    yearLow: toNum(raw.yearLow),
    yearHigh: toNum(raw.yearHigh),
    priceAvg50: toNum(raw.priceAvg50),
    priceAvg200: toNum(raw.priceAvg200),
    marketCap: toNum(raw.marketCap ?? raw.mktCap),
    volume: toNum(raw.volume),
    avgVolume: toNum(raw.avgVolume),
    exchange: raw.exchange,
    sharesOutstanding: toNum(raw.sharesOutstanding),
    eps: toNum(raw.eps),
    pe: toNum(raw.pe),
    earningsAnnouncement: raw.earningsAnnouncement ?? null,
  };
}

/**
 * Normalizes raw income statement data into the shared income statement format.
 *
 * @param raw - The raw income statement record to normalize.
 * @returns An income statement row with normalized fields and default values for missing core metrics.
 */
function normalizeIncomeRow(raw: any): IncomeStatementRow {
  const toNum = (v: any) => (v === undefined ? undefined : Number(v));
  // /stable/ statements expose `fiscalYear` (e.g. 2025), not `calendarYear`.
  // The shared row type and client charts key off `calendarYear`, so prefer
  // it but fall back to `fiscalYear` so the restored free-tier data renders.
  const year = raw.calendarYear ?? raw.fiscalYear ?? '';
  return {
    date: String(raw.date ?? ''),
    symbol: String(raw.symbol ?? ''),
    reportedCurrency: String(raw.reportedCurrency ?? 'USD'),
    calendarYear: String(year),
    period: String(raw.period ?? ''),
    revenue: toNum(raw.revenue) ?? 0,
    costOfRevenue: toNum(raw.costOfRevenue),
    grossProfit: toNum(raw.grossProfit) ?? 0,
    operatingIncome: toNum(raw.operatingIncome),
    operatingExpense: toNum(raw.operatingExpense),
    ebitda: toNum(raw.ebitda) ?? 0,
    netIncome: toNum(raw.netIncome) ?? 0,
    eps: toNum(raw.eps) ?? 0,
    epsDiluted: toNum(raw.epsDiluted),
  };
}

/**
 * Converts a raw balance sheet record into a normalized balance sheet row.
 *
 * @param raw - The source balance sheet record.
 * @returns A normalized balance sheet row with numeric financial values.
 */
function normalizeBalanceRow(raw: any): BalanceSheetRow {
  const toNum = (v: any) => (v === undefined ? undefined : Number(v));
  const year = raw.calendarYear ?? raw.fiscalYear ?? '';
  return {
    date: String(raw.date ?? ''),
    symbol: String(raw.symbol ?? ''),
    reportedCurrency: String(raw.reportedCurrency ?? 'USD'),
    calendarYear: String(year),
    period: String(raw.period ?? ''),
    totalAssets: toNum(raw.totalAssets) ?? 0,
    totalLiabilities: toNum(raw.totalLiabilities),
    totalEquity: toNum(raw.totalEquity),
    totalDebt: toNum(raw.totalDebt),
    cashAndCashEquivalents: toNum(raw.cashAndCashEquivalents) ?? 0,
    netDebt: toNum(raw.netDebt),
  };
}

/**
 * Normalizes a cash flow statement row into the shared cash flow format.
 *
 * @param raw - The source cash flow statement data.
 * @returns A normalized cash flow statement row.
 */
function normalizeCashRow(raw: any): CashFlowRow {
  const toNum = (v: any) => (v === undefined ? undefined : Number(v));
  const year = raw.calendarYear ?? raw.fiscalYear ?? '';
  return {
    date: String(raw.date ?? ''),
    symbol: String(raw.symbol ?? ''),
    reportedCurrency: String(raw.reportedCurrency ?? 'USD'),
    calendarYear: String(year),
    period: String(raw.period ?? ''),
    operatingCashFlow: toNum(raw.operatingCashFlow) ?? 0,
    capitalExpenditure: toNum(raw.capitalExpenditure),
    freeCashFlow: toNum(raw.freeCashFlow) ?? 0,
    stockBasedCompensation: toNum(raw.stockBasedCompensation),
    dividendPayments: toNum(raw.dividendPayments),
  };
}

/**
 * Normalizes an earnings calendar record into the shared earnings event format.
 *
 * @param raw - The upstream earnings record to normalize
 * @returns An earnings event with normalized identifiers, dates, timing, and financial values
 */
function normalizeEarningEvent(raw: any): EarningsEvent {
  const toNum = (v: any): number | null => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    symbol: String(raw.symbol ?? ''),
    date: String(raw.date ?? ''),
    marketCap: toNum(raw.marketCap ?? raw.mktCap),
    epsEstimated: toNum(raw.epsEstimated ?? raw.epsEstimate),
    eps: toNum(raw.eps),
    revenueEstimated: toNum(raw.revenueEstimated ?? raw.revenueEstimate),
    revenue: toNum(raw.revenue),
    time: String(raw.time ?? 'bmo'),
  };
}

/**
 * Normalizes a Yahoo Finance news item into the shared news format.
 *
 * @param raw - A flat or content-wrapped Yahoo Finance news item
 * @returns A normalized news item with title, publisher, publication time, link, and optional media metadata
 */
function normalizeNewsItem(raw: any): NewsItem {
  // Yahoo v4 shape from .search(): flat. Legacy content-wrapped shape sometimes
  // appears when proxying — handle both.
  const c = raw.content ?? raw;
  const t = c.providerPublishTime ?? c.pubDate ?? raw.providerPublishTime;
  return {
    title: String(c.title ?? c.headline ?? raw.title ?? ''),
    publisher: String(c.providerName ?? c.publisher ?? raw.publisher ?? 'News'),
    providerPublishTime: typeof t === 'number' ? t : Math.floor(Date.now() / 1000),
    link: String(c.clickUrl ?? c.url ?? c.link ?? raw.link ?? '#'),
    thumbnail: c.thumbnail?.resolutions?.[0]?.url ?? c.thumbnail ?? raw.thumbnail,
    type: c.type ?? raw.type,
  };
}

// ---- Helpers used only by normalizeInsider ---------------------------------
// Kept file-local because Yahoo's `quoteSummary` shape has three real-world
// variants we need to absorb (Date object, ISO string, `{raw, fmt}` object,
// plain number). Centralizing them here means we can write tests against
// the through-line by mutating one helper. Plus a 1990 sanity bound matching
// `client/lib/finance.PLAUSIBLE_DATE_MIN_MS` (kept in lockstep — a future
// contributor who tunes one MUST tune the other so the date column doesn't
// read different UTC dates on the client vs. the workspace).
const INSIDER_DATE_MIN_MS = Date.UTC(1990, 0, 1);

function toNumberLoose(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const raw = obj.raw;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
    const fmt = obj.fmt;
    if (typeof fmt === "string") {
      const n = Number(fmt);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function toDateMs(value: unknown): number | null {
  // Accepts: Date object, ISO string (YYYY-MM-DD or full ISO), {raw, fmt}, plain number.
  // Returns `null` for everything pre-1990 (Yahoo sanity guard) so the UI
  // renders "—" instead of "1/1/1970".
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) && ms >= INSIDER_DATE_MIN_MS ? ms : null;
  }
  if (typeof value === "number") {
    // Mirror the Yahoo runtime convention from client/lib/finance.ts: < 1e12
    // is unix-seconds, larger is already ms.
    const ms = value < 1e12 ? value * 1000 : value;
    return Number.isFinite(ms) && ms >= INSIDER_DATE_MIN_MS ? ms : null;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed >= INSIDER_DATE_MIN_MS) return parsed;
    return null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const raw = obj.raw;
    if (typeof raw === "number") {
      const ms = raw < 1e12 ? raw * 1000 : raw;
      if (Number.isFinite(ms) && ms >= INSIDER_DATE_MIN_MS) return ms;
    } else if (typeof raw === "string") {
      const parsed = Date.parse(raw);
      if (Number.isFinite(parsed) && parsed >= INSIDER_DATE_MIN_MS) return parsed;
    }
    const fmt = obj.fmt;
    if (typeof fmt === "string") {
      const parsed = Date.parse(fmt);
      if (Number.isFinite(parsed) && parsed >= INSIDER_DATE_MIN_MS) return parsed;
    }
  }
  return null;
}

/**
 * Normalizes an upstream insider transaction into the shared transaction format.
 *
 * @param raw - The upstream transaction data to normalize
 * @returns A normalized insider transaction with numeric shares, value, and price fields
 */
function normalizeInsider(raw: any): InsiderTransaction {
  const shares = toNumberLoose(raw.shares) ?? 0;
  const value = toNumberLoose(raw.value) ?? 0;
  // Date extraction is the high-risk one — Yahoo v4 returns startDate as a
  // native Date object OR an ISO string OR a {raw, fmt} object OR a plain
  // unix-second number. The legacy code only handled the `.raw` object
  // shape so Date objects (the dominant v4 shape) flattened to 0 and the
  // UI rendered "—" for every row. `toDateMs` collapses all four to a
  // safe UTC-ms number (or `null` for everything pre-1990 / unparseable)
  // so UI text via `formatTradeDateLocale` reads as a real date.
  const startDate = toDateMs(raw.startDate);
  return {
    filerName: String(raw.filerName ?? raw.name ?? 'Insider'),
    filerRelation: typeof raw.filerRelation === 'string'
      ? raw.filerRelation
      : raw.filerRelation?.raw ?? undefined,
    transactionText: String(raw.transactionText ?? raw.type ?? 'Transaction'),
    // Pass through the per-transaction single-letter code so the UI can
    // branch on it (purchase / sale / award / gift / etc) and render the
    // right format. Optional here because some sessions omit it.
    transactionCode: typeof raw.transactionCode === 'string'
      ? raw.transactionCode.trim().toUpperCase() || null
      : null,
    startDate,
    shares,
    value,
    // `price` is `value / shares` when both fields exist; for non-cash rows
    // (gifts, awards, tax-withholding) the result is a fiction — the UI
    // ignores it and renders "—". We still ship the field so any cash-flow
    // aggregation can do "Sum(value) across rows" without re-deriving.
    price: shares > 0 && value > 0 ? value / shares : 0,
  };
}

/**
 * Converts a raw chart data record into a normalized chart point.
 *
 * @param raw - The source chart data record
 * @returns A chart point with normalized date, price, volume, and change values
 */
function normalizeChartPoint(raw: any) {
  return {
    date: String(raw.date ?? ''),
    open: Number(raw.open ?? 0),
    high: Number(raw.high ?? 0),
    low: Number(raw.low ?? 0),
    close: Number(raw.close ?? 0),
    adjClose: Number(raw.adjClose ?? raw.close ?? 0),
    volume: Number(raw.volume ?? 0),
    change: Number(raw.change ?? 0),
    changePercent: Number(raw.changePercent ?? 0),
  };
}

/**
 * Retrieves one year of daily historical price data for a symbol.
 *
 * @param symbol - The ticker symbol to retrieve
 * @returns The normalized chart series, or `null` when no data is available
 */
async function fetchProfileWithAvailability(
  symbol: string,
): Promise<{ profile: CompanyProfile | null; unavailable: boolean }> {
  if (!hasFmp()) return { profile: null, unavailable: true };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const response = await fetch(tickerUrl('profile', symbol), { signal: ctrl.signal });
      if (!response.ok) {
        throttledWarn(`profile/${symbol}`, `[stockService] profile/${symbol} HTTP ${response.status}`);
        return { profile: null, unavailable: true };
      }
      const raw = (await response.json()) as any;
      const row = Array.isArray(raw) ? raw[0] : raw;
      const profile = row ? normalizeProfile(row) : null;
      const matchesRequestedSymbol =
        profile?.symbol.trim().toUpperCase() === symbol.toUpperCase();
      return {
        profile: matchesRequestedSymbol ? profile : null,
        unavailable: false,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (error: any) {
    throttledWarn(`profile/${symbol}`, `[stockService] profile/${symbol} failed: ${error?.message ?? error}`);
    return { profile: null, unavailable: true };
  }
}

async function yahooChart(symbol: string): Promise<ChartSeries | null> {
  try {
    // yahoo-finance2 v4 deprecated historical() in favor of chart(). The v4
    // historical() shim maps to chart() but explicitly passes period2:
    // undefined, which fails ChartOptions validation — so call chart()
    // directly with an explicit end date instead.
    // period1 (1y ago) + interval "1d" gives ~252 trading-day closes — more
    // than enough for SMA-200.
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 1);
    const raw: any = await yahooFinance.chart(symbol, {
      period1,
      period2: new Date(),
      interval: "1d",
    });
    const rows: any[] = Array.isArray(raw) ? raw : raw?.quotes ?? [];
    if (rows.length === 0) return null;
    const historical = rows.map((r: any) => ({
      date: String(
        r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date ?? ""
      ),
      open: Number(r.open ?? 0),
      high: Number(r.high ?? 0),
      low: Number(r.low ?? 0),
      close: Number(r.close ?? 0),
      adjClose: Number(r.adjclose ?? r.close ?? 0),
      volume: Number(r.volume ?? 0),
      change: Number(r.change ?? 0),
      changePercent: Number(r.changePercent ?? 0),
    }));
    return {
      symbol: String(symbol),
      historical,
    };
  } catch (e: any) {
    throttledWarn(`yahoo_chart:${symbol}`, `[stockService] yahoo chart failed for ${symbol}: ${e?.message ?? e}`);
    return null;
  }
}
/**
 * Retrieves and normalizes a quote for a symbol from Yahoo Finance.
 *
 * @returns A normalized stock quote, or `null` when no quote is available.
 */
async function yahooQuote(symbol: string): Promise<StockQuote | null> {
  try {
    // yahoo-finance2 v4 returns camelCase already for the regularMarket* fields.
    const q: any = await yahooFinance.quote(symbol);
    if (!q) return null;
    const toFinite = (value: unknown): number | undefined => {
      if (value === null || value === undefined || value === "") return undefined;
      const number = Number(value);
      return Number.isFinite(number) ? number : undefined;
    };
    const price = toFinite(q.regularMarketPrice);
    if (price === undefined || price <= 0) return null;
    const earningsTimestamp = toFinite(q.earningsTimestamp);
    return {
      symbol: String(q.symbol ?? symbol),
      name: q.longName ?? q.shortName ?? q.displayName,
      price,
      change: toFinite(q.regularMarketChange) ?? 0,
      changesPercentage: toFinite(q.regularMarketChangePercent) ?? 0,
      previousClose: toFinite(q.regularMarketPreviousClose),
      dayLow: toFinite(q.regularMarketDayLow),
      dayHigh: toFinite(q.regularMarketDayHigh),
      yearLow: toFinite(q.fiftyTwoWeekLow),
      yearHigh: toFinite(q.fiftyTwoWeekHigh),
      priceAvg50: toFinite(q.fiftyDayAverage),
      priceAvg200: toFinite(q.twoHundredDayAverage),
      marketCap: toFinite(q.marketCap),
      volume: toFinite(q.regularMarketVolume),
      avgVolume: toFinite(q.averageDailyVolume10Day ?? q.averageDailyVolume3Month),
      exchange: q.exchange,
      sharesOutstanding: toFinite(q.sharesOutstanding),
      eps: toFinite(q.epsTrailingTwelveMonths),
      pe: toFinite(q.trailingPE),
      earningsAnnouncement: q.earningsTimestamp
        ? new Date(
            typeof q.earningsTimestamp === "number" && q.earningsTimestamp < 1e12
              ? q.earningsTimestamp * 1000
              : q.earningsTimestamp
          ).toISOString()
        : null,
    };
  } catch (e: any) {
    // Yahoo v4 throws if the symbol is unknown — fall through to MOCK.
    throttledWarn(`yahoo_quote:${symbol}`, `[stockService] yahoo quote failed for ${symbol}: ${e?.message ?? e}`);
    return null;
  }
}

// ---- Public service --------------------------------------------------------
export const stockService = {
  /**
   * Quote for a single ticker. Yahoo → FMP → AlphaVantage fallback chain.
   *
   * The FMP /stable/ shape uses `?symbol=…` query params. If Yahoo didn't
   * yield EPS (yahoofinance dropped `epsTrailingTwelveMonths` on some
   * tickers), we back-fill EPS from `key-metrics-ttm.netIncomePerShareTTM`
   * — `/stable/` quote stripped the embedded `eps` field. PE is back-filled
   * from `ratios-ttm.priceEarningsRatioTTM` when Yahoo's trailingPE is null.
   */
  async getQuote(symbol: string): Promise<StockQuote | null> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const cacheKey = `quote_${normalizedSymbol}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey) as StockQuote | null;

    return quoteInFlight.getOrCreate(cacheKey, async () => {
      if (cache.has(cacheKey)) return cache.get(cacheKey) as StockQuote | null;

      let result: StockQuote | null = await yahooQuote(normalizedSymbol);
      if (!result && hasFmp()) {
        const url = QUOTE_USE_QUERY_PARAM
          ? fmpUrl('quote', { symbol: normalizedSymbol })
          : fmpUrl(`quote/${normalizedSymbol}`);
        const raw = await fetchJSON<any>(url, `quote/${normalizedSymbol}`);
        if (raw) {
          const row = Array.isArray(raw) ? raw[0] : raw;
          result = normalizeQuote(row);
          if (result && (result.eps === undefined || result.pe === undefined)) {
            const metrics = await this.getMetrics(normalizedSymbol);
            if (result.eps === undefined) {
              const eps = metrics.metrics?.netIncomePerShareTTM;
              if (eps && Number.isFinite(eps)) result.eps = eps;
            }
            if (result.pe === undefined) {
              const ratiosPe = metrics.ratios?.priceEarningsRatioTTM ?? null;
              if (ratiosPe && Number.isFinite(ratiosPe)) result.pe = ratiosPe;
            }
          }
        }
      }
      if (!result && AV_KEY) {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${normalizedSymbol}&apikey=${AV_KEY}`;
        apiUsageTracker.recordCall('alphavantage');
        const raw = await fetchJSON<any>(url, `av quote/${normalizedSymbol}`);
        const g = raw?.['Global Quote'];
        if (g) {
          const toNum = (s: unknown) => {
            const n = Number(String(s ?? '').replace(/[%,$]/g, ''));
            return Number.isFinite(n) ? n : undefined;
          };
          result = normalizeQuote({
            symbol: g['01. symbol'] ?? normalizedSymbol,
            price: toNum(g['05. price']),
            change: toNum(g['09. change']),
            changesPercentage: toNum(g['10. change percent']),
            previousClose: toNum(g['08. previous close']),
          });
        }
      }

      cache.set(cacheKey, result, result ? QUOTE_TTL : QUOTE_NEGATIVE_TTL);
      return result;
    });
  },

  /**
   * Batch quotes use the verified active FMP shape when configured. A partial
   * provider response falls back only for missing symbols, with bounded
   * concurrency, and every caller receives its own requested order.
   */
  async getBatchQuotes(symbols: string[]): Promise<BatchQuoteResponse> {
    if (symbols.length === 0) return { quotes: [] };
    const requested = symbols.map((symbol) => symbol.trim().toUpperCase());
    const canonical = canonicalSymbols(requested);
    const cacheKey = `batch_${canonical.join(',')}`;
    const cached = cache.get<BatchQuoteResponse>(cacheKey);
    if (cached) return { quotes: orderByRequestedSymbols(requested, cached.quotes) };

    const canonicalPayload = await batchQuoteInFlight.getOrCreate(cacheKey, async () => {
      const existing = cache.get<BatchQuoteResponse>(cacheKey);
      if (existing) return existing;

      const quotes = await resolveOrderedBatch<StockQuote>({
        symbols: canonical,
        concurrency: 8,
        fetchBatch: async (batchSymbols) => {
          if (!hasFmp()) return null;
          const raw = await fetchJSON<any>(
            buildFmpBatchUrl(FMP_BASE, FMP_KEY, batchSymbols, QUOTE_USE_QUERY_PARAM),
            `batch quote: ${batchSymbols.length}`,
            18000,
          );
          const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : null;
          if (!rows) return null;
          return rows.map(normalizeQuote).filter((quote): quote is StockQuote => quote !== null);
        },
        fetchSingle: (singleSymbol) => this.getQuote(singleSymbol),
      });
      const payload: BatchQuoteResponse = { quotes };
      const hasLiveQuote = quotes.some(Boolean);
      cache.set(cacheKey, payload, hasLiveQuote ? QUOTE_TTL : QUOTE_NEGATIVE_TTL);
      return payload;
    });

    return { quotes: orderByRequestedSymbols(requested, canonicalPayload.quotes) };
  },

  async getProfile(symbol: string): Promise<CompanyProfile | null> {
    return (await this.getProfileValidation(symbol)).profile;
  },

  async getProfileValidation(
    symbol: string,
  ): Promise<{ profile: CompanyProfile | null; unavailable: boolean }> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const cacheKey = `profile_${normalizedSymbol}`;
    const cached = cache.get<{ profile: CompanyProfile | null; unavailable: boolean }>(cacheKey);
    if (cached) return cached;

    return profileInFlight.getOrCreate(cacheKey, async () => {
      const inFlightCached = cache.get<{ profile: CompanyProfile | null; unavailable: boolean }>(cacheKey);
      if (inFlightCached) return inFlightCached;
      const result = await fetchProfileWithAvailability(normalizedSymbol);
      cache.set(cacheKey, result, result.profile ? 3600 : PROFILE_NEGATIVE_TTL);
      return result;
    });
  },

  /**
   * Fetch historical financial statements via Yahoo Finance fundamentalsTimeSeries.
   * Used as a fallback when FMP is unavailable or rate limited.
   */
  async getYahooFinancialStatements(ticker: string, period: 'annual' | 'quarter' = 'annual', limit: number = 5): Promise<FinancialStatements> {
    try {
      const type = period === 'quarter' ? 'quarterly' : 'annual';
      const fallbackDate = new Date();
      // To get 20 quarters, we need at least 5 years. 6 years gives a safe buffer (24 quarters).
      fallbackDate.setFullYear(fallbackDate.getFullYear() - 6); 
      let res: any[] = await yahooFinance.fundamentalsTimeSeries(ticker, {
        module: 'all',
        type,
        period1: fallbackDate.toISOString(),
      });
      if (!res || res.length === 0) return { income: [], balance: [], cash: [] };
      
      // Yahoo returns chronological order. Slice to get the most recent `limit` items.
      if (res.length > limit) {
        res = res.slice(-limit);
      }

      // Normalize to our expected format
      const getPeriod = (r: any) => {
        if (period === 'annual') return 'FY';
        const m = new Date(r.date).getMonth(); // 0-11
        return `Q${Math.ceil((m + 1) / 3)}`;
      };

      const income = res.map((r: any) => ({
        date: new Date(r.date).toISOString().slice(0, 10),
        symbol: ticker,
        reportedCurrency: 'USD',
        calendarYear: new Date(r.date).getFullYear().toString(),
        period: getPeriod(r),
        revenue: r.totalRevenue || 0,
        costOfRevenue: r.costOfRevenue || r.reconciledCostOfRevenue || 0,
        grossProfit: r.grossProfit || 0,
        operatingIncome: r.operatingIncome || 0,
        operatingExpense: r.operatingExpense || 0,
        ebitda: r.EBITDA || r.normalizedEBITDA || 0,
        netIncome: r.netIncome || 0,
        eps: r.basicEPS || 0,
        epsDiluted: r.dilutedEPS || 0,
      }));

      const balance = res.map((r: any) => ({
        date: new Date(r.date).toISOString().slice(0, 10),
        symbol: ticker,
        reportedCurrency: 'USD',
        calendarYear: new Date(r.date).getFullYear().toString(),
        period: getPeriod(r),
        totalAssets: r.totalAssets || 0,
        totalLiabilities: r.totalLiabilitiesNetMinorityInterest || 0,
        totalEquity: r.stockholdersEquity || 0,
        totalDebt: r.totalDebt || 0,
        cashAndCashEquivalents: r.cashAndCashEquivalents || r.cashCashEquivalentsAndShortTermInvestments || 0,
        netDebt: r.netDebt || 0,
      }));

      const cash = res.map((r: any) => ({
        date: new Date(r.date).toISOString().slice(0, 10),
        symbol: ticker,
        reportedCurrency: 'USD',
        calendarYear: new Date(r.date).getFullYear().toString(),
        period: getPeriod(r),
        operatingCashFlow: r.operatingCashFlow || r.cashFlowFromContinuingOperatingActivities || 0,
        capitalExpenditure: r.capitalExpenditure || 0,
        freeCashFlow: r.freeCashFlow || 0,
      }));

      return { income, balance, cash };
    } catch (e) {
      throttledWarn(`yahooFinance:fundamentalsTimeSeries:${ticker}`, `[YahooFinance] Failed to fetch fundamentalsTimeSeries for ${ticker}:`, e);
      return { income: [], balance: [], cash: [] };
    }
  },

  async getFinancialStatements(
    symbol: string,
    period: "annual" | "quarter" = "annual",
  ): Promise<FinancialStatements> {
    const cacheKey = `financials_${symbol}_${period}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey) as FinancialStatements;
    
    let result: FinancialStatements = { income: [], balance: [], cash: [] };
    const limit = period === "quarter" ? 20 : 5;

    if (hasFmp()) {
      const extra: Record<string, string | number> = { limit };
      if (period === "quarter") extra.period = "quarter";
      const [incomeRaw, balanceRaw, cashRaw] = await Promise.all([
        fetchJSON<any[]>(tickerUrl('income-statement', symbol, extra), `income/${symbol}/${period}`),
        fetchJSON<any[]>(tickerUrl('balance-sheet-statement', symbol, extra), `balance/${symbol}/${period}`),
        fetchJSON<any[]>(tickerUrl('cash-flow-statement', symbol, extra), `cash/${symbol}/${period}`),
      ]);
      
      if (Array.isArray(incomeRaw) && incomeRaw.length > 0) {
        result = {
          income: incomeRaw.map(normalizeIncomeRow),
          balance: Array.isArray(balanceRaw) ? balanceRaw.map(normalizeBalanceRow) : [],
          cash: Array.isArray(cashRaw) ? cashRaw.map(normalizeCashRow) : [],
        };
      }
    }

    if (result.income.length === 0) {
      // Fallback to Yahoo if FMP is unavailable, rate-limited, or fails
      result = await this.getYahooFinancialStatements(symbol, period, limit);
    }

    cache.set(cacheKey, result);
    return result;
  },

  async getMetrics(symbol: string): Promise<StockMetrics> {
    const cacheKey = `metrics_${symbol}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey) as StockMetrics;
    if (!hasFmp()) return { metrics: {}, ratios: {}, scores: null };
    const [m, r, s] = await Promise.all([
      fetchJSON<any[]>(tickerUrl('key-metrics-ttm', symbol), `metrics/${symbol}`),
      fetchJSON<any[]>(tickerUrl('ratios-ttm', symbol), `ratios/${symbol}`),
      fetchJSON<any[]>(tickerUrl('financial-scores', symbol), `scores/${symbol}`),
    ]);
    const m0 = Array.isArray(m) ? m[0] : m;
    const r0 = Array.isArray(r) ? r[0] : r;
    const s0 = Array.isArray(s) ? s[0] : s;
    const result: StockMetrics = {
      metrics: (m0 || {}) as KeyMetricsTTM,
      ratios: (r0 || {}) as RatiosTTM,
      scores: s0
        ? { symbol: String(s0.symbol ?? symbol), altmanZScore: s0.altmanZScore, piotroskiScore: s0.piotroskiScore }
        : null,
    };
    cache.set(cacheKey, result);
    return result;
  },

  /** Yahoo earningsTrend. */
  async getAnalystEstimates(symbol: string): Promise<AnalystTrends> {
    const cacheKey = `analyst_${symbol}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey) as AnalystTrends;
    try {
      const raw: any = await yahooFinance.quoteSummary(symbol, { modules: ['earningsTrend'] });
      const trend = raw?.earningsTrend?.trend ?? [];
      // Yahoo earningsTrend values come in two real-world shapes:
      //   1. `{ raw: number, fmt: "x.xx" }` objects (the documented form)
      //   2. plain numbers (some symbols/sessions flatten the shape)
      // Older code only handled #1, which made the client render "0.00" for
      // every cell when Yahoo returned #2 with `.raw` undefined. The
      // helper below accepts either, returning `null` for genuinely
      // missing data so the renderer can show "—" instead of misleading
      // zeros.
      const extract = (v: unknown): number | null => {
        if (v === undefined || v === null) return null;
        if (typeof v === "number") return Number.isFinite(v) ? v : null;
        if (typeof v === "string") {
          const n = Number(v);
          return Number.isFinite(n) ? n : null;
        }
        if (typeof v === "object" && v !== null) {
          const obj = v as Record<string, unknown>;
          const raw = obj.raw;
          const fmt = obj.fmt;
          if (typeof raw === "number" && Number.isFinite(raw)) return raw;
          if (typeof raw === "string") {
            const n = Number(raw);
            if (Number.isFinite(n)) return n;
          }
          if (typeof fmt === "string") {
            const n = Number(fmt);
            if (Number.isFinite(n)) return n;
          }
        }
        return null;
      };
      const normalized: AnalystTrendPoint[] = trend.map((p: any) => ({
        period: String(p.period ?? ''),
        endDate: p.endDate,
        growth: extract(p.growth),
        earningsEstimate: p.earningsEstimate
          ? { avg: extract(p.earningsEstimate.avg), low: extract(p.earningsEstimate.low), high: extract(p.earningsEstimate.high) }
          : undefined,
        revenueEstimate: p.revenueEstimate
          ? { avg: extract(p.revenueEstimate.avg), low: extract(p.revenueEstimate.low), high: extract(p.revenueEstimate.high) }
          : undefined,
        epsTrend: p.epsTrend
          ? {
              current: extract(p.epsTrend.current),
              sevenDaysAgo: extract(p.epsTrend['7daysAgo']),
              thirtyDaysAgo: extract(p.epsTrend['30daysAgo']),
            }
          : undefined,
      }));
      cache.set(cacheKey, normalized);
      return normalized;
    } catch (e: any) {
      throttledWarn(`analyst:${symbol}`, `[stockService] analyst ${symbol} failed: ${e?.message ?? e}`);
      return [];
    }
  },

  /**
   * Yahoo-driven fallback path for the Index financial-metrics grid when
   * the FMP primary is rate-limited (HTTP 429 from `/stable/`). Surfaces
   * a 4-card compact view of single-point fundamentals + estimates so the
   * page renders honest live numbers with a "(Yahoo estimate)" chip
   * instead of collapsing to "Metrics unavailable" + a no-op retry.
   *
   * - Yahoo free tier doesn't ship historical fundamentals, so this
   *   serves a SNAPSHOT, not a series — the YoY/CAGR 8-card FMP grid
   *   is replaced by 4 single-point cards (Revenue, EBITDA, Gross
   *   Profit, EPS-est). Anything missing upstream normalises to `null`
   *   and renders as `—` so a real `0` can't be confused with "no data".
   * - Cached 5 minutes via the shared `cache` and coalesced via a small
   *   in-flight registry so concurrent calls during a Yahoo outage
   *   don't replicate the upstream call.
   * - Mirrors the parity handler `handleStockYahooFallbackFinancials`
   *   in `api/_router.js` so Vercel / Netlify (which uses the plain-JS
   *   router) gets the same response shape and coalescing semantics.
   *
   * The provider-health probe + the index metrics grid decide WHEN this
   * is invoked; this method only decides WHAT to return when it is.
   */
  async getYahooFallbackFinancials(symbol: string): Promise<YahooFallbackFinancials> {
    const cacheKey = `yahoo_fallback_financials_${symbol}`;
    if (cache.has(cacheKey)) return cache.get<YahooFallbackFinancials>(cacheKey) as YahooFallbackFinancials;
    return yahooFallbackInFlight.getOrCreate(cacheKey, async () => {
      // Re-check inside the in-flight registry: another concurrent caller
      // may have populated the cache between the outer miss and the
      // registry getOrCreate lock.
      const inFlight = cache.get<YahooFallbackFinancials>(cacheKey);
      if (inFlight) return inFlight;
      // Coerce both `{ raw, fmt }` object and bare number shapes — Yahoo's
      // `defaultKeyStatistics` module returns bare numbers while
      // `financialData` returns objects. Missing anything → `null`.
      const extractNum = (v: unknown): number | null => {
        if (v === undefined || v === null) return null;
        if (typeof v === "number") return Number.isFinite(v) ? v : null;
        if (typeof v === "string") {
          const n = Number(v);
          return Number.isFinite(n) ? n : null;
        }
        if (typeof v === "object" && v !== null) {
          const obj = v as Record<string, unknown>;
          const raw = obj.raw;
          const fmt = obj.fmt;
          if (typeof raw === "number" && Number.isFinite(raw)) return raw;
          if (typeof raw === "string") {
            const n = Number(raw);
            if (Number.isFinite(n)) return n;
          }
          if (typeof fmt === "string") {
            const n = Number(fmt);
            if (Number.isFinite(n)) return n;
          }
        }
        return null;
      };
      // `margin: 0.18` (a fraction) is what Yahoo ships; downstream UI
      // treats margin fields as percent so multiply by 100 here.
      const extractMarginPct = (v: unknown): number | null => {
        const n = extractNum(v);
        return n === null ? null : n * 100;
      };
      try {
        // Same modules + shape as handleStockMetrics — `defaultKeyStatistics`
        // (EV, eps, debt ratio) + `financialData` (revenue, EBITDA, margins)
        // + `earningsTrend` (consensus next-quarter EPS / revenue).
        const raw: any = await yahooFinance.quoteSummary(symbol, {
          modules: ['defaultKeyStatistics', 'financialData', 'earningsTrend'],
        }).catch(() => ({}));
        const dks = raw?.defaultKeyStatistics || {};
        const fd = raw?.financialData || {};
        const trends: any[] = raw?.earningsTrend?.trend ?? [];
        const nextQtr = trends.find((t) => t?.period === "+1q");
        const epsEstNext = nextQtr?.earningsEstimate?.avg;
        const revEstNext = nextQtr?.revenueEstimate?.avg;
        const result: YahooFallbackFinancials = {
          revenue: extractNum(fd.totalRevenue),
          ebitda: extractNum(fd.ebitda),
          grossProfit: extractNum(fd.grossProfits),
          operatingMargin: extractMarginPct(fd.operatingMargins),
          profitMargin: extractMarginPct(fd.profitMargins),
          grossMargin: extractMarginPct(fd.grossMargins),
          revenueGrowth: extractMarginPct(fd.revenueGrowth),
          earningsGrowth: extractMarginPct(fd.earningsGrowth),
          totalCash: extractNum(fd.totalCash),
          totalDebt: extractNum(fd.totalDebt),
          enterpriseValue: extractNum(dks.enterpriseValue),
          trailingEps: extractNum(dks.trailingEps),
          forwardEps: extractNum(dks.forwardEps),
          epsEstimateNextQtr: extractNum(epsEstNext),
          revenueEstimateNextQtr: extractNum(revEstNext),
        };
        cache.set(cacheKey, result, 300);
        return result;
      } catch (e: any) {
        throttledWarn(
          `yahoo-fallback:${symbol}`,
          `[stockService] yahoo fallback ${symbol} failed: ${e?.message ?? e}`,
        );
        // All-null sentinel shape so the client renders four em-dash cards
        // instead of the prior "Metrics unavailable" empty-state. The
        // contract: never throw, always return the strict shape.
        const empty: YahooFallbackFinancials = {
          revenue: null,
          ebitda: null,
          grossProfit: null,
          operatingMargin: null,
          profitMargin: null,
          grossMargin: null,
          revenueGrowth: null,
          earningsGrowth: null,
          totalCash: null,
          totalDebt: null,
          enterpriseValue: null,
          trailingEps: null,
          forwardEps: null,
          epsEstimateNextQtr: null,
          revenueEstimateNextQtr: null,
        };
        cache.set(cacheKey, empty, 300);
        return empty;
      }
    });
  },

  // Internal helper exposed for tests only — keep the API surface clean.

  async getInsiderTrading(symbol: string): Promise<InsiderTransaction[]> {
    const cacheKey = `insider_${symbol}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey) as InsiderTransaction[];
    try {
      const raw: any = await yahooFinance.quoteSummary(symbol, { modules: ['insiderTransactions'] });
      const txs = raw?.insiderTransactions?.transactions ?? [];
      const normalized = txs.map((t: any) => normalizeInsider(t));
      cache.set(cacheKey, normalized);
      return normalized;
    } catch (e: any) {
      throttledWarn(`insider:${symbol}`, `[stockService] insider ${symbol} failed: ${e?.message ?? e}`);
      return [];
    }
  },

  /**
   * Yahoo v4 .search() returned news in a flat shape but as of recent
   * v4 updates the response key changed to `quotes`/`news` mixing. We
   * accept either shape.
   */
  async getNews(symbol: string): Promise<NewsItem[]> {
    const cacheKey = `news_${symbol}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey) as NewsItem[];
    try {
      // newsCount: 12 — bumped from 5 so the in-app news card on /stock/:ticker
      // has enough rows for a real news-feed feel (with thumbnails).
      // 12 is comfortable under Yahoo's ~20-25 free-tier ceiling.
      const raw: any = await yahooFinance.search(symbol, { newsCount: 12 });
      const items = raw?.news ?? [];
      const normalized = items.map(normalizeNewsItem);
      cache.set(cacheKey, normalized);
      return normalized;
    } catch (e: any) {
      throttledWarn(`news:${symbol}`, `[stockService] news ${symbol} failed: ${e?.message ?? e}`);
      return [];
    }
  },

  async getEarningsCalendar(from: string, to: string): Promise<EarningsEvent[]> {
    const cacheKey = `earnings_cal_${from}_${to}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey) as EarningsEvent[];
    if (!hasFmp()) return [];
    const raw = await fetchJSON<any[]>(fmpUrl(EARNINGS_ENDPOINT, { from, to }), `earnings ${from}..${to}`);
    const result: EarningsEvent[] = Array.isArray(raw) ? raw.map(normalizeEarningEvent) : [];

    // FMP's calendar often omits market cap, while the client uses it for
    // the large/mid/small filters. Enrich distinct returned symbols from the
    // quote cache; getBatchQuotes keeps concurrency bounded. Keep a service-level
    // ceiling as a second line of defense against unusually large provider
    // responses exhausting the upstream quote budget.
    const symbols = Array.from(
      new Set(
        result
          .map((event) => event.symbol.trim().toUpperCase())
          .filter(Boolean),
      ),
    );
    const enrichSymbols = symbols.slice(0, MAX_EARNINGS_ENRICH_SYMBOLS);
    if (enrichSymbols.length > 0) {
      const quotes = await this.getBatchQuotes(enrichSymbols);
      const marketCaps = new Map<string, number>();
      for (const quote of quotes.quotes) {
        if (!quote?.symbol || quote.marketCap === undefined || quote.marketCap <= 0) continue;
        marketCaps.set(quote.symbol.toUpperCase(), quote.marketCap);
      }
      for (const event of result) {
        event.marketCap ??= marketCaps.get(event.symbol.toUpperCase()) ?? null;
      }
    }

    cache.set(cacheKey, result);
    return result;
  },

  async getChart(symbol: string): Promise<ChartSeries | null> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const cacheKey = `chart_${normalizedSymbol}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey) as ChartSeries | null;

    return chartInFlight.getOrCreate(cacheKey, async () => {
      if (cache.has(cacheKey)) return cache.get(cacheKey) as ChartSeries | null;

      // Try FMP first using the path shape that works on the active base:
      //   /stable/ → historical-price-eod/full?symbol=X (1 year daily OHLC)
      //   /api/v3/ → historical-price-full/X?timeseries=N (1 year daily)
      // On failure (404/402/403) fall back to Yahoo historical which is always on.
      if (hasFmp()) {
        const url = QUOTE_USE_QUERY_PARAM
          ? fmpUrl(CHART_ENDPOINT, { symbol: normalizedSymbol })
          : fmpUrl(`${CHART_ENDPOINT}/${normalizedSymbol}`, { timeseries: 200 });
        const raw = await fetchJSON<any>(url, `chart/${normalizedSymbol}`);
        if (raw) {
          // /stable/ of {symbol, historical: [...]}; v3 same shape (keyed under "historical").
          const rows = Array.isArray(raw.historical)
            ? raw.historical
            : Array.isArray(raw)
            ? raw
            : [];
          const series: ChartSeries = {
            symbol: String(raw.symbol ?? normalizedSymbol),
            historical: rows.map(normalizeChartPoint),
          };
          if (series.historical.length > 0) {
            cache.set(cacheKey, series);
            return series;
          }
        }
      }
      const yahoo = await yahooChart(normalizedSymbol);
      if (yahoo) {
        cache.set(cacheKey, yahoo);
        return yahoo;
      }
      cache.set(cacheKey, null, CHART_NEGATIVE_TTL);
      return null;
    });
  },

  /**
   * Marquee indices for the TopBar pills (Dow Jones, S&P 500, Nasdaq).
   *
   * /stable/ multi-symbol quote is paid-gated (402) and Yahoo Finance is
   * reliably on for index symbols (^GSPC, ^IXIC, ^DJI). We hit Yahoo FIRST
   * and only consult FMP for whichever index Yahoo didn't return. Saves one
   * upstream call per refresh on the common case and avoids the 402 noise
   * in the server log.
   */
  async getIndexQuotes(): Promise<{ dow: StockQuote | null; sp500: StockQuote | null; nasdaq: StockQuote | null }> {
    const cacheKey = 'index_quotes';
    if (cache.has(cacheKey)) return cache.get(cacheKey) as any;

    // 1. Yahoo-first (parallel). Each index is a normal quote in y-finance v2.
    const [yahooSp, yahooIx, yahooDj] = await Promise.all([
      yahooQuote('^GSPC'),
      yahooQuote('^IXIC'),
      yahooQuote('^DJI'),
    ]);
    let out = {
      sp500: yahooSp,
      nasdaq: yahooIx,
      dow: yahooDj,
    };

    // 2. FMP fallback only for the missing ones. /stable/ indices are paid,
    // so we surface 402 as "no data" rather than crashing.
    if (hasFmp() && (!out.sp500?.symbol || !out.dow?.symbol || !out.nasdaq?.symbol)) {
      try {          const raw = await fetchJSON<any>(
            fmpUrl('quote', { symbol: '^GSPC,^IXIC,^DJI' }),
            'index quotes (fmp fallback)',
            10000,
          );
        const arr: any[] = Array.isArray(raw) ? raw : [];
        const find = (suffix: string) => {
          const match = arr.find((r: any) => String(r.symbol ?? '').endsWith(suffix));
          return match ? normalizeQuote(match) : null;
        };
        out = {
          sp500: out.sp500 ?? find('GSPC'),
          nasdaq: out.nasdaq ?? find('IXIC'),
          dow: out.dow ?? find('DJI'),
        };
      } catch {
        // Already warned by fetchJSON's throttled warn — silent here.
      }
    }

    cache.set(cacheKey, out, QUOTE_TTL);
    return out;
  },

  /**
   * Curated ticker universe for a given Insights tab, surfaced via the new
   * `/api/insights-tab` endpoint. The client overlays live prices with
   * `useBatchQuotes(symbols)`; the universe itself is editorial.
   *
   * Labels here come back as **English** stable strings. The client maps
   * them to its i18n key (`insights.tabs.<id>`) so rebrand/translation is a
   * client-only change.
   */
  getInsightsTab(tab: string): InsightsTabResponse {
    const validKey = (Object.keys(insightsTabUniverses) as InsightsTabId[]).includes(tab as InsightsTabId)
      ? (tab as InsightsTabId)
      : 'sp500';
    const entries = insightsTabUniverses[validKey] ?? insightsTabUniverses.sp500;
    const labels: Record<InsightsTabId, string> = {
      sp500: 'S&P 500',
      trending: 'Trending',
      growth: 'Growth',
      dividend: 'Dividend',
      buyback: 'Buyback',
      ai: 'AI',
      cloud: 'Cloud',
      ev: 'EV',
      leisure: 'Leisure',
    };
    return {
      tab: validKey,
      label: labels[validKey],
      entries,
    };
  },

  /**
   * Returns all curated universes at once for the client-side multi-filter.
   */
  getAllInsightsTabs(): Record<InsightsTabId, InsightsTabEntry[]> {
    return insightsTabUniverses;
  },

  /**
   * Live FX rates for cross-currency portfolio display (Phase 2).
   * Pulls USDEUR=X / USDILS=X / etc. from Yahoo in parallel and returns the
   * pair-quoted JSON the Portfolio UI uses for currency conversion. Cache 1h.
   */
  async getFxRates(currencies: FxCurrency[] = ['USD', 'ILS', 'EUR']): Promise<FxRatesResponse> {
    const cacheKey = `fx_${currencies.slice().sort().join(',')}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey) as FxRatesResponse;
    }
    const pairs: string[] = [];
    for (const base of currencies) {
      for (const quote of currencies) {
        if (base !== quote) pairs.push(`${base}${quote}=X`);
      }
    }
    const settled = await Promise.all(
      pairs.map(async (sym) => {
        try {
          const r = await yahooFinance.quote(sym);
          const px = Number(r?.regularMarketPrice ?? NaN);
          return Number.isFinite(px) && px > 0 ? ([sym.replace('=X', ''), px] as const) : null;
        } catch {
          return null;
        }
      })
    );
    const rates: Record<string, number> = { USDUSD: 1 };
    for (const s of settled) {
      if (s) rates[s[0]] = s[1];
    }
    const out: FxRatesResponse = {
      rates,
      fetchedAt: new Date().toISOString(),
      source: 'yahoo',
    };
    cache.set(cacheKey, out, 3600);
    return out;
  },

  /**
   * Sector × days heatmap for an Insights universe. Cache the FULL
   * aggregation result for 15 minutes — every per-ticker chart is
   * independently cached in `getChart` for 1h, so a 30-ticker universe on
   * the first warm call burns ~30 upstream Yahoo requests; subsequent
   * refreshes inside the TTL window are pure node-cache reads.
   *
   * Curated sector metadata from the Insights universe (`sectorMeta`) is
   * the trusted source for sector assignment: when a symbol has a curated
   * tag, the provider profile call is skipped entirely and the tag is used
   * as-is. Provider profile sectors are consulted only for symbols without
   * a curated tag. Symbols with neither fall into `untagged`.
   *
   * The `sectors` arg lets the caller scope the heatmap to a subset of
   * sectors (e.g. "Tech only"); rows whose sector isn't in the allowlist
   * flow into `untagged` so the UI can still count them. Pass `[]` to
   * include every distinct sector in `symbols`.
   *
   * Cache key includes the sorted symbol list, the day count, the sector
   * allowlist, and the normalized sector metadata so distinct calls never
   * reuse an aggregation computed for a different sector mapping.
   */
  async getSectorHeatmap(
    symbols: string[],
    days: number = 5,
    sectorAllow: string[] | null = null,
    sectorMeta: SectorHeatmapMetadata = {},
  ): Promise<SectorHeatmapResponse> {
    if (symbols.length === 0) {
      return { days: [], rows: [], untagged: [], generatedAt: new Date().toISOString() };
    }
    const sortedSyms = canonicalSymbols(symbols);
    const allowKey =
      sectorAllow && sectorAllow.length > 0 ? sectorAllow.slice().sort().join(',') : '*';
    // Normalize curated metadata once and keep only entries for symbols that
    // are actually part of this request — stray metadata for other tickers
    // would otherwise pollute the cache key without changing the result.
    const requestedSet = new Set(sortedSyms);
    const curated = normalizeSectorMeta(sectorMeta);
    const curatedForRequest: Record<string, string> = {};
    for (const [sym, sector] of Object.entries(curated)) {
      if (requestedSet.has(sym)) curatedForRequest[sym] = sector;
    }
    const cacheKey = buildSectorHeatmapCacheKey({ days, allowKey, meta: curatedForRequest, symbols: sortedSyms });
    const cached = cache.get<SectorHeatmapResponse>(cacheKey);
    if (cached) return cached;

    return heatmapInFlight.getOrCreate(cacheKey, async () => {
      const inFlightCached = cache.get<SectorHeatmapResponse>(cacheKey);
      if (inFlightCached) return inFlightCached;

      // Fan out `getChart` per symbol; `getProfile` only for symbols lacking
      // a curated tag (curated tags are trusted universe metadata). Both
      // operations coalesce independently, so overlapping heatmap requests
      // share work.
      const rows = await buildHeatmapRows<SectorHeatmapInputRow>({
        symbols: sortedSyms,
        curated: curatedForRequest,
        getChart: (sym) => this.getChart(sym),
        getProfile: (sym) => this.getProfile(sym),
      });

      const todayIso = new Date().toISOString().slice(0, 10);
      const result = aggregateSectorHeatmap(rows, days, {
        allowedSectors: sectorAllow,
        todayIso,
      });
      // Use short negative TTL for empty results to allow recovery from transient provider issues
      const isEmpty = result.rows.length === 0;
      cache.set(cacheKey, result, isEmpty ? CHART_NEGATIVE_TTL : SECTOR_HEATMAP_TTL);
      return result;
    });
  },

  /**
   * SMA-200 distance per symbol. Computed from `getChart` (which now
   * Yahoo-first), taking the trailing N closes (default 200) and
   * reducing to a mean. Cheap when symbols is < 25; deeper caching
   * recommended if expanded.
   */
  async getSmaDistancesFor(symbols: string[], windowSize: number = 200): Promise<SmaDistanceResponse> {
    if (symbols.length === 0) return { rows: [] };
    const cap = Math.max(5, Math.min(200, Math.floor(windowSize)));
    const rows: SmaDistanceRow[] = [];
    const BATCH_SIZE = 8;
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batchRows = await Promise.all(
        symbols.slice(i, i + BATCH_SIZE).map(async (sym): Promise<SmaDistanceRow> => {
        try {
          const [chart, quote] = await Promise.all([
            this.getChart(sym.toUpperCase()),
            this.getQuote(sym.toUpperCase()),
          ]);
          if (!chart || chart.historical.length === 0) {
            return { symbol: sym, sma200: null, distancePct: null, sampleSize: 0, price: null };
          }
          // Newest-last so `slice(-cap)` gives the most recent N closes.
          // Using date sort — proxies are different, FYI historical may
          // already be in date-asc order from Yahoo.
          const historical = [...chart.historical].sort((a, b) =>
            a.date < b.date ? -1 : a.date > b.date ? 1 : 0
          );
          const closes = historical
            .map((p) => Number(p.close))
            .filter((n) => Number.isFinite(n) && n > 0);
          const tail = closes.slice(-cap);
          if (tail.length === 0) {
            return { symbol: sym, sma200: null, distancePct: null, sampleSize: 0, price: null };
          }
          const sum = tail.reduce((s, n) => s + n, 0);
          const mean = sum / tail.length;
          const price = quote?.price ?? tail[tail.length - 1];
          const distancePct = mean > 0 ? ((price - mean) / mean) * 100 : null;
          return { symbol: sym, sma200: mean, distancePct, sampleSize: tail.length, price };
        } catch (e: any) {
          throttledWarn(`sma:${sym}`, `[stockService] sma ${sym} failed: ${e?.message ?? e}`);
          return { symbol: sym, sma200: null, distancePct: null, sampleSize: 0, price: null };
        }
        }),
      );
      rows.push(...batchRows);
    }
    return { rows };
  },

  /**
   * Per-provider API usage snapshot for the footer's progress bars.
   * Thin pass-through to the singleton tracker so callers stay decoupled
   * from `apiUsageTracker` directly. Async because the tracker awaits
   * cold-start KV hydration when running on Vercel/serverless with KV.
   */
  async getProviderUsage() {
    return _getProviderUsage();
  },

  /**
   * Live provider health probe so the UI can surface outages instead of
   * silently degrading. Probes one entry PER FEATURE (see
   * `ProviderHealthFeature`):
   *   - yahoo:        quote + chart — keyless real quote round-trip AND a
   *                   historical chart round-trip, so chart-only outages
   *                   (Charts page, heatmaps, SMA) surface separately from
   *                   quote outages instead of hiding under "quote ok"
   *   - fmp:          quote + batch-quote (batch-quote is 402 paid-gated on
   *                   the free tier → `known_restriction`, NOT an outage)
   *   - alphavantage: quote
   * Mirrors scripts/fmp-audit.ts classification. Cached 5 min + coalesced
   * via the in-flight registry so concurrent UI polls share one probe run
   * (the 1-min client poll therefore hits the cache 4/5 times).
   */
  async getProviderHealth(): Promise<ProviderHealthResponse> {
    const cacheKey = 'provider_health';
    const cached = cache.get<ProviderHealthResponse>(cacheKey);
    if (cached) return cached;

    return healthInFlight.getOrCreate(cacheKey, async () => {
      const inFlight = cache.get<ProviderHealthResponse>(cacheKey);
      if (inFlight) return inFlight;

      const probeFmp = async (
        feature: ProviderHealthFeature,
        url: string,
      ): Promise<ProviderHealthEntry> => {
        const probeStart = Date.now();
        apiUsageTracker.recordCall('fmp');
        const result = await probeUrlStatus(url);
        const { status, detail } = providerStatusFromProbe(result);
        return {
          provider: 'fmp',
          feature,
          status,
          latencyMs: result ? result.latencyMs : Date.now() - probeStart,
          detail,
        };
      };

      const providers = await Promise.all([
        // Yahoo — keyless; a real quote round-trip is the honest probe.
        (async (): Promise<ProviderHealthEntry> => {
          const probeStart = Date.now();
          try {
            const q: any = await withTimeout(yahooFinance.quote('AAPL'), PROVIDER_HEALTH_TIMEOUT_MS);
            const price = Number(q?.regularMarketPrice ?? 0);
            return {
              provider: 'yahoo',
              feature: 'quote',
              status: price > 0 ? 'ok' : 'down',
              latencyMs: Date.now() - probeStart,
              detail: price > 0 ? undefined : 'empty quote',
            };
          } catch (e: any) {
            return {
              provider: 'yahoo',
              feature: 'quote',
              status: 'down',
              latencyMs: Date.now() - probeStart,
              detail: e?.message ?? 'error',
            };
          }
        })(),
        // Yahoo — chart: a real historical round-trip distinguishes
        // chart-only outages (Charts page, sector heatmaps, SMA-200) from
        // quote outages. Mirrors `yahooChart()`; any positive close counts
        // as data, so a partial series still reads `ok`.
        (async (): Promise<ProviderHealthEntry> => {
          const probeStart = Date.now();
          try {
            const period1 = new Date();
            period1.setFullYear(period1.getFullYear() - 1);
            const raw: any = await withTimeout(
              yahooFinance.chart('AAPL', {
                period1,
                period2: new Date(),
                interval: '1d',
              }),
              PROVIDER_HEALTH_TIMEOUT_MS,
            );
            const rows: any[] = Array.isArray(raw) ? raw : raw?.quotes ?? [];
            const hasClose = rows.some((r: any) => Number(r?.close ?? 0) > 0);
            return {
              provider: 'yahoo',
              feature: 'chart',
              status: hasClose ? 'ok' : 'down',
              latencyMs: Date.now() - probeStart,
              detail: hasClose ? undefined : 'empty chart',
            };
          } catch (e: any) {
            return {
              provider: 'yahoo',
              feature: 'chart',
              status: 'down',
              latencyMs: Date.now() - probeStart,
              detail: e?.message ?? 'error',
            };
          }
        })(),
        // FMP — quote + batch-quote probes (only when a key is configured).
        hasFmp()
          ? (async (): Promise<ProviderHealthEntry[]> => {
              const quoteUrl = QUOTE_USE_QUERY_PARAM
                ? fmpUrl('quote', { symbol: 'AAPL' })
                : fmpUrl(`quote/AAPL`);
              const batchUrl = QUOTE_USE_QUERY_PARAM
                ? fmpUrl('batch-quote', { symbols: 'AAPL,MSFT,NVDA' })
                : fmpUrl(`batch-quote/AAPL,MSFT,NVDA`);
              return [await probeFmp('quote', quoteUrl), await probeFmp('batch-quote', batchUrl)];
            })()
          : Promise.resolve<ProviderHealthEntry[]>([
              { provider: 'fmp', feature: 'quote', status: 'not_configured', latencyMs: null },
              { provider: 'fmp', feature: 'batch-quote', status: 'not_configured', latencyMs: null },
            ]),
        // AlphaVantage — only probed when a key is configured.
        AV_KEY
          ? (async (): Promise<ProviderHealthEntry> => {
              const probeStart = Date.now();
              const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${AV_KEY}`;
              apiUsageTracker.recordCall('alphavantage');
              const result = await probeUrlStatus(url);
              const { status, detail } = providerStatusFromProbe(result);
              return {
                provider: 'alphavantage',
                feature: 'quote',
                status,
                latencyMs: result ? result.latencyMs : Date.now() - probeStart,
                detail,
              };
            })()
          : Promise.resolve<ProviderHealthEntry>({ provider: 'alphavantage', feature: 'quote', status: 'not_configured', latencyMs: null }),
      ]);

      const flat: ProviderHealthEntry[] = providers.flat();
      const result: ProviderHealthResponse = {
        checkedAt: new Date().toISOString(),
        providers: flat,
        // known_restriction is an expected plan limitation, not an outage.
        healthy: flat.every((p) => p.status === 'ok' || p.status === 'known_restriction'),
      };
      cache.set(cacheKey, result, PROVIDER_HEALTH_TTL);
      return result;
    });
  },
};
