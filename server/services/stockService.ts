import yahooFinanceDefault from 'yahoo-finance2';
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
  RatiosTTM,
  SectorHeatmapResponse,
  SmaDistanceResponse,
  SmaDistanceRow,
  StockMetrics,
  StockQuote,
} from '@shared/api';
import { insightsTabUniverses } from './insightsUniverses';
// Relative path (not `@shared/...`) so the helper resolves cleanly under Vite's
// config-file resolver, which doesn't apply its own `resolve.alias` map when
// bundling vite.config.ts at startup. The TS path alias still works — this is
// purely a runtime resolution concern at config-load time.
import { aggregateSectorHeatmap, type SectorHeatmapInputRow } from '../../shared/aggregateSectorHeatmap';

// yahoo-finance2 v4 ships the class as its default export. Use one shared
// instance per process; constructing it "throwaway" per call degrades
// Yahoo's rate-limit grace and triggers the survey notice on every fetch.
const yahooFinance = new yahooFinanceDefault({ suppressNotices: ['yahooSurvey'] });

/**
 * Upstream-aware stock data layer.
 *
 * Strategy: this file discusses with FMP via the /api/v3/ path which is
 * still the canonical path for free-tier keys (and most current ones). The
 * newer /stable/ path returns 404 on the current key — see docs/endpoints.md
 * for the migration plan.
 *
 * Every function returns the shared shape from shared/api.ts (never `any`).
 * Normalizers live inline so callers don't have to know which upstream API
 * was used for any given field.
 */

// ---- Cache ----------------------------------------------------------------
const cache = new NodeCache({ stdTTL: 3600 });
const QUOTE_TTL = 60; // 1 min — quotes are the only thing we ever refetch live
const SECTOR_HEATMAP_TTL = 900; // 15 min — heatmap recomputation cache (day deltas are slow-moving)

// ---- Warn throttling --------------------------------------
const lastWarnAt = new Map<string, number>();
const WARN_THROTTLE_MS = 60_000;

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

/** When the user's key is the free tier we use v3; flip to /stable when a paid key is plugged in. */
const FMP_BASE = process.env.FMP_USE_STABLE === '1' ? 'https://financialmodelingprep.com/stable' : 'https://financialmodelingprep.com/api/v3';

/** Earnings-calendar endpoint name — `/stable/` uses `earnings-calendar` (plural, hyphen); legacy v3 still accepts `earning_calendar` (singular, underscore). Hoisted alongside `FMP_BASE` so both shape decisions read the same env var at module init. */
const EARNINGS_ENDPOINT = process.env.FMP_USE_STABLE === '1' ? 'earnings-calendar' : 'earning_calendar';

/**
 * Chart endpoint — `/stable/` exposes EOD bars via `historical-price-eod/full`
 * (full OHLC + vwap) and `/historical-price-eod/light` (lean: just
 * `{symbol,date,price,volume}` — NO open/high/low/close). The legacy v3
 * path `historical-price-full` 404s on `/stable/`. We pick `/full` so the
 * chart UI sees real OHLC bar geometry; Yahoo historical remains the
 * always-on fallback.
 */
const CHART_ENDPOINT = process.env.FMP_USE_STABLE === '1' ? 'historical-price-eod/full' : 'historical-price-full';

/**
 * Quote endpoint — `/stable/` requires the query-param shape `?symbol=...`;
 * `quote/{symbol}` (path-segment) 404s on `/stable/`. v3 accepted both. We
 * pick the shape that works on the active base so the rest of the file stays
 * branchless.
 */
const QUOTE_USE_QUERY_PARAM = process.env.FMP_USE_STABLE === '1';

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
 * @param url - The URL to request
 * @param label - Identifier used for warning messages
 * @param timeoutMs - Maximum request duration in milliseconds
 * @returns The parsed response data, or `null` when the request fails
 */
async function fetchJSON<T = any>(url: string, label: string, timeoutMs = 12000): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) {
      // 404 / 403 from FMP shows up here — caller decides what to do.
      throttledWarn(`fetcher:${label}`, `[stockService] ${label} HTTP ${res.status} for ${url}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e: any) {
    throttledWarn(`fetcher:${label}`, `[stockService] ${label} failed: ${e?.message || e}`);
    return null;
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
  return {
    symbol: String(raw.symbol ?? ''),
    name: raw.name ?? raw.companyName,
    price: toNum(raw.price) ?? 0,
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
  return {
    date: String(raw.date ?? ''),
    symbol: String(raw.symbol ?? ''),
    reportedCurrency: String(raw.reportedCurrency ?? 'USD'),
    calendarYear: String(raw.calendarYear ?? ''),
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
  return {
    date: String(raw.date ?? ''),
    symbol: String(raw.symbol ?? ''),
    reportedCurrency: String(raw.reportedCurrency ?? 'USD'),
    calendarYear: String(raw.calendarYear ?? ''),
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
  return {
    date: String(raw.date ?? ''),
    symbol: String(raw.symbol ?? ''),
    reportedCurrency: String(raw.reportedCurrency ?? 'USD'),
    calendarYear: String(raw.calendarYear ?? ''),
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
  const toNum = (v: any) => (v === undefined || v === null ? null : Number(v));
  return {
    symbol: String(raw.symbol ?? ''),
    date: String(raw.date ?? ''),
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

/**
 * Normalizes an upstream insider transaction into the shared transaction format.
 *
 * @param raw - The upstream transaction data to normalize
 * @returns A normalized insider transaction with numeric shares, value, and price fields
 */
function normalizeInsider(raw: any): InsiderTransaction {
  const shares = typeof raw.shares === 'object' && raw.shares?.raw !== undefined
    ? Number(raw.shares.raw)
    : Number(raw.shares ?? 0);
  const value = typeof raw.value === 'object' && raw.value?.raw !== undefined
    ? Number(raw.value.raw)
    : Number(raw.value ?? 0);
  const startDate = raw.startDate;
  return {
    filerName: String(raw.filerName ?? raw.name ?? 'Insider'),
    filerRelation: typeof raw.filerRelation === 'string'
      ? raw.filerRelation
      : raw.filerRelation?.raw ?? undefined,
    transactionText: String(raw.transactionText ?? raw.type ?? 'Transaction'),
    startDate: typeof startDate === 'object' ? Number(startDate.raw ?? 0) : (startDate ?? 0),
    shares,
    value,
    price: shares ? value / shares : 0,
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
async function yahooChart(symbol: string): Promise<ChartSeries | null> {
  try {
    // yahoo-finance2 v4 returns {quotes: [{date, open, high, low, close, volume, adjclose}], ...}
    // range "1y" + interval "1d" gives ~252 trading-day closes — more than enough for SMA-200.
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 1);
    const raw: any = await yahooFinance.historical(symbol, {
      period1,
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
    return {
      symbol: String(q.symbol ?? symbol),
      name: q.longName ?? q.shortName ?? q.displayName,
      price: Number(q.regularMarketPrice ?? 0),
      change: Number(q.regularMarketChange ?? 0),
      changesPercentage: Number(q.regularMarketChangePercent ?? 0),
      previousClose: Number(q.regularMarketPreviousClose ?? 0),
      dayLow: Number(q.regularMarketDayLow ?? 0),
      dayHigh: Number(q.regularMarketDayHigh ?? 0),
      yearLow: Number(q.fiftyTwoWeekLow ?? 0),
      yearHigh: Number(q.fiftyTwoWeekHigh ?? 0),
      priceAvg50: Number(q.fiftyDayAverage ?? 0),
      priceAvg200: Number(q.twoHundredDayAverage ?? 0),
      marketCap: Number(q.marketCap ?? 0),
      volume: Number(q.regularMarketVolume ?? 0),
      avgVolume: Number(q.averageDailyVolume10Day ?? q.averageDailyVolume3Month ?? 0),
      exchange: q.exchange,
      sharesOutstanding: Number(q.sharesOutstanding ?? 0),
      eps: q.epsTrailingTwelveMonths,
      pe: q.trailingPE,
      earningsAnnouncement: q.earningsTimestamp ? new Date(q.earningsTimestamp * 1000).toISOString() : null,
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
    const cacheKey = `quote_${symbol}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey) as StockQuote | null;

    let result: StockQuote | null = null;
    // Try Yahoo first (richest field set including earningsTimestamp).
    result = await yahooQuote(symbol);
    if (!result && hasFmp()) {
      // Branch query-param (works on /stable/) vs path-segment (legacy v3).
      const url = QUOTE_USE_QUERY_PARAM
        ? fmpUrl('quote', { symbol })
        : fmpUrl(`quote/${symbol}`);
      const raw = await fetchJSON<any>(url, `quote/${symbol}`);
      if (raw) {
        // FMP returns an array even for single symbols.
        const row = Array.isArray(raw) ? raw[0] : raw;
        result = normalizeQuote(row);
        // Defensive back-fill: /stable/quote strips `eps` and a numeric `pe`
        // (the legacy v3 shape carried both). We trust Yahoo first — by the
        // time we hit this branch, Yahoo returned something but probably with
        // epsTrailingTwelveMonths or trailingPE missing for this ticker.
        // One cached round-trip to getMetrics() covers both fields atomically.
        if (result && (result.eps === undefined || result.pe === undefined)) {
          const metrics = await this.getMetrics(symbol);
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
      // Alpha Vantage fallback — same shape mapping.
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${AV_KEY}`;
      const raw = await fetchJSON<any>(url, `av quote/${symbol}`);
      const g = raw?.['Global Quote'];
      if (g) {
        const toNum = (s: string) => Number(String(s).replace(/[%,$]/g, ''));
        result = {
          symbol: g['01. symbol'] ?? symbol,
          price: toNum(g['05. price'] ?? 0),
          change: toNum(g['09. change'] ?? 0),
          changesPercentage: toNum(g['10. change percent'] ?? 0),
          previousClose: toNum(g['08. previous close'] ?? 0),
          exchange: undefined,
        };
      }
    }
    cache.set(cacheKey, result, QUOTE_TTL);
    return result;
  },

  /**
   * Batch quotes.
   *
   * The FMP /stable/ multi-symbol endpoint is gated behind the PAID plan
   * (402). On free-tier / stable-tier we ALWAYS use Yahoo — parallel
   * Promise.all over cached `getQuote` calls (each individual cache entry
   * is shared across siblings so a 30-ticker batch is one upstream trip per
   * ticker total, not 30). The legacy v3 multi-symbol path is kept as an
   * opportunistic fallback if someone re-enables it via FMP_USE_STABLE!=1.
   *
   * Cache key includes the symbol list so distinct orderings don't collide.
   */
  async getBatchQuotes(symbols: string[]): Promise<BatchQuoteResponse> {
    if (symbols.length === 0) return { quotes: [] };
    const ordered = symbols.map(s => s.toUpperCase());
    const cacheKey = `batch_${ordered.join(',')}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey) as BatchQuoteResponse;

    let rawArr: any[] | null = null;

    // /stable/ batch is paid-tier — skip unless explicitly on legacy v3.
    if (hasFmp() && !QUOTE_USE_QUERY_PARAM) {
      const raw = await fetchJSON<any>(
        fmpUrl(`quote/${ordered.join(',')}`),
        `batch quote: ${ordered.length}`,
        18000,
      );
      if (Array.isArray(raw)) rawArr = raw;
    }

    if (!rawArr) {
      // Yahoo path — primary on /stable/, fallback on v3. Each per-symbol
      // getQuote is cached, so sibling ticks within a batch are one upstream
      // call each (Yahoo's HTTP/1.1 concurrency handle absorbs the burst).
      const results = await Promise.all(ordered.map(s => this.getQuote(s)));
      const payload: BatchQuoteResponse = { quotes: results };
      cache.set(cacheKey, payload, QUOTE_TTL);
      return payload;
    }

    // Map results back into the input order so the UI can index by ticker.
    const bySymbol = new Map<string, StockQuote>();
    for (const row of rawArr) {
      const nq = normalizeQuote(row);
      if (nq?.symbol) bySymbol.set(nq.symbol.toUpperCase(), nq);
    }
    const quotes = ordered.map(s => bySymbol.get(s) ?? null);
    const payload: BatchQuoteResponse = { quotes };
    cache.set(cacheKey, payload, QUOTE_TTL);
    return payload;
  },

  async getProfile(symbol: string): Promise<CompanyProfile | null> {
    const cacheKey = `profile_${symbol}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey) as CompanyProfile | null;
    if (!hasFmp()) return null;
    const raw = await fetchJSON<any>(tickerUrl('profile', symbol), `profile/${symbol}`);
    const row = Array.isArray(raw) ? raw[0] : raw;
    const result = row ? normalizeProfile(row) : null;
    if (result) cache.set(cacheKey, result);
    return result;
  },

  async getFinancialStatements(symbol: string): Promise<FinancialStatements> {
    const cacheKey = `financials_${symbol}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey) as FinancialStatements;
    if (!hasFmp()) return { income: [], balance: [], cash: [] };
    const [incomeRaw, balanceRaw, cashRaw] = await Promise.all([
      fetchJSON<any[]>(tickerUrl('income-statement', symbol, { limit: 10 }), `income/${symbol}`),
      fetchJSON<any[]>(tickerUrl('balance-sheet-statement', symbol, { limit: 10 }), `balance/${symbol}`),
      fetchJSON<any[]>(tickerUrl('cash-flow-statement', symbol, { limit: 10 }), `cash/${symbol}`),
    ]);
    const result: FinancialStatements = {
      income: Array.isArray(incomeRaw) ? incomeRaw.map(normalizeIncomeRow) : [],
      balance: Array.isArray(balanceRaw) ? balanceRaw.map(normalizeBalanceRow) : [],
      cash: Array.isArray(cashRaw) ? cashRaw.map(normalizeCashRow) : [],
    };
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
      const normalized: AnalystTrendPoint[] = trend.map((p: any) => ({
        period: String(p.period ?? ''),
        endDate: p.endDate,
        growth: p.growth?.raw,
        earningsEstimate: p.earningsEstimate
          ? { avg: p.earningsEstimate.avg?.raw ?? null, low: p.earningsEstimate.low?.raw ?? null, high: p.earningsEstimate.high?.raw ?? null }
          : undefined,
        revenueEstimate: p.revenueEstimate
          ? { avg: p.revenueEstimate.avg?.raw ?? null, low: p.revenueEstimate.low?.raw ?? null, high: p.revenueEstimate.high?.raw ?? null }
          : undefined,
        epsTrend: p.epsTrend
          ? {
              current: p.epsTrend.current?.raw ?? null,
              sevenDaysAgo: p.epsTrend['7daysAgo']?.raw ?? null,
              thirtyDaysAgo: p.epsTrend['30daysAgo']?.raw ?? null,
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
      const raw: any = await yahooFinance.search(symbol, { newsCount: 5 });
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
    cache.set(cacheKey, result);
    return result;
  },

  async getChart(symbol: string): Promise<ChartSeries | null> {
    const cacheKey = `chart_${symbol}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey) as ChartSeries;
    // Try FMP first using the path shape that works on the active base:
    //   /stable/ → historical-price-eod/light?symbol=X (1 year daily)
    //   /api/v3/ → historical-price-full/X?timeseries=N (1 year daily)
    // On failure (404/402/403) fall back to Yahoo historical which is always on.
    if (hasFmp()) {
      const url = QUOTE_USE_QUERY_PARAM
        ? fmpUrl(CHART_ENDPOINT, { symbol })
        : fmpUrl(`${CHART_ENDPOINT}/${symbol}`, { timeseries: 200 });
      const raw = await fetchJSON<any>(url, `chart/${symbol}`);
      if (raw) {
        // /stable/ of {symbol, historical: [...]}; v3 same shape (keyed under "historical").
        const rows = Array.isArray(raw.historical)
          ? raw.historical
          : Array.isArray(raw)
          ? raw
          : [];
        const series: ChartSeries = {
          symbol: String(raw.symbol ?? symbol),
          historical: rows.map(normalizeChartPoint),
        };
        if (series.historical.length > 0) {
          cache.set(cacheKey, series);
          return series;
        }
      }
    }
    const yahoo = await yahooChart(symbol);
    if (yahoo) {
      cache.set(cacheKey, yahoo);
      return yahoo;
    }
    return null;
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
   * The `sectors` arg lets the caller scope the heatmap to a subset of
   * sectors (e.g. "Tech only"); rows whose sector isn't in the allowlist
   * flow into `untagged` so the UI can still count them. Pass `[]` to
   * include every distinct sector in `symbols`.
   *
   * Cache key includes the sorted symbol list, the day count, and the
   * sector allowlist so distinct calls don't collide.
   */
  async getSectorHeatmap(
    symbols: string[],
    days: number = 5,
    sectorAllow: string[] | null = null,
  ): Promise<SectorHeatmapResponse> {
    if (symbols.length === 0) {
      return { days: [], rows: [], untagged: [], generatedAt: new Date().toISOString() };
    }
    const sortedSyms = symbols.slice().map((s) => s.toUpperCase()).sort();
    const allowKey =
      sectorAllow && sectorAllow.length > 0 ? sectorAllow.slice().sort().join(',') : '*';
    const cacheKey = `sector_heatmap_${days}_${allowKey}_${sortedSyms.join(',')}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey) as SectorHeatmapResponse;

    // Fan out `getChart` + `getProfile` per symbol. Both are independently
    // cached (1h for chart, 1h for profile), so a 30-ticker universe on
    // the first warm call costs ~60 upstream calls (parallel). Subsequent
    // calls inside the 15-min node-cache TTL are pure in-memory reads.
    // Profile.sector is canonical: FMP's `/stable/profile` returns it
    // cleanly on free-tier keys (the editor-curated fallback in
    // insightsUniverses is only consulted when the universe already
    // ships a static tag, e.g. when the caller passes an overrides map).
    const rows: SectorHeatmapInputRow[] = await Promise.all(
      sortedSyms.map(async (sym): Promise<SectorHeatmapInputRow> => {
        const [chart, profile] = await Promise.all([
          this.getChart(sym),
          this.getProfile(sym),
        ]);
        return {
          symbol: sym,
          sector: profile?.sector?.trim() || null,
          chart,
        };
      }),
    );

    // Today's ISO date (server local) → `isPartial` on the rightmost cell.
    // On weekends the server treats the most recent settled bar as "today",
    // so callers don't see "today (partial)" on Saturday/Sunday landings.
    const todayIso = new Date().toISOString().slice(0, 10);
    const result = aggregateSectorHeatmap(rows, days, {
      allowedSectors: sectorAllow,
      todayIso,
    });
    cache.set(cacheKey, result, SECTOR_HEATMAP_TTL);
    return result;
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
    const rows: SmaDistanceRow[] = await Promise.all(
      symbols.map(async (sym): Promise<SmaDistanceRow> => {
        try {
          const chart = await this.getChart(sym.toUpperCase());
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
          const price = tail[tail.length - 1];
          const distancePct = mean > 0 ? ((price - mean) / mean) * 100 : null;
          return { symbol: sym, sma200: mean, distancePct, sampleSize: tail.length, price };
        } catch (e: any) {
          throttledWarn(`sma:${sym}`, `[stockService] sma ${sym} failed: ${e?.message ?? e}`);
          return { symbol: sym, sma200: null, distancePct: null, sampleSize: 0, price: null };
        }
      }),
    );
    return { rows };
  },
};
