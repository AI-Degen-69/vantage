/**
 * Vantage API Router — plain JavaScript.
 *
 * Vercel's @vercel/node bundler cannot handle local TypeScript imports from
 * api/*.ts files (FUNCTION_INVOCATION_FAILED at runtime). This file is pure
 * JS so every import resolves through npm packages (which Vercel handles)
 * while being imported from a .ts catch-all.
 *
 * Prefix `_` tells Vercel this is NOT a serverless function endpoint.
 *
 * Yahoo Finance (yahoo-finance2) is free and requires NO API key. FMP-
 * dependent endpoints (financials, metrics, earnings calendar, sector
 * heatmap) return empty/fallback responses until the env vars are set.
 */

import yfDefault from 'yahoo-finance2';
import NodeCache from 'node-cache';

const yf = new yfDefault({ suppressNotices: ['yahooSurvey'] });
const cache = new NodeCache({ stdTTL: 300 });
const QUOTE_TTL = 60;
const CHART_TTL = 600;

// ── Helpers ───────────────────────────────────────────────────────────────────
let _lastWarned = {};
function throttledWarn(key, ...args) {
  const now = Date.now();
  if (_lastWarned[key] && now - _lastWarned[key] < 60000) return;
  _lastWarned[key] = now;
  console.warn(...args);
}

function toNum(v) {
  if (v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeQuote(q, symbol) {
  if (!q) return null;
  return {
    symbol: String(q.symbol || symbol || ''),
    name: q.longName || q.shortName || q.displayName,
    price: toNum(q.regularMarketPrice) ?? 0,
    change: toNum(q.regularMarketChange) ?? 0,
    changesPercentage: toNum(q.regularMarketChangePercent) ?? 0,
    previousClose: toNum(q.regularMarketPreviousClose),
    dayLow: toNum(q.regularMarketDayLow),
    dayHigh: toNum(q.regularMarketDayHigh),
    yearLow: toNum(q.fiftyTwoWeekLow),
    yearHigh: toNum(q.fiftyTwoWeekHigh),
    priceAvg50: toNum(q.fiftyDayAverage),
    priceAvg200: toNum(q.twoHundredDayAverage),
    marketCap: toNum(q.marketCap),
    volume: toNum(q.regularMarketVolume),
    avgVolume: toNum(q.averageDailyVolume10Day || q.averageDailyVolume3Month),
    exchange: q.exchange,
    sharesOutstanding: toNum(q.sharesOutstanding),
    eps: toNum(q.epsTrailingTwelveMonths),
    pe: toNum(q.trailingPE),
    earningsAnnouncement: q.earningsTimestamp
      ? new Date(q.earningsTimestamp * 1000).toISOString() : null,
  };
}

function normalizeChartPoint(r) {
  const close = Number(r.close ?? 0);
  const prev = Number(r.open ?? close);
  return {
    date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date ?? ''),
    open: toNum(r.open) ?? 0,
    high: toNum(r.high) ?? 0,
    low: toNum(r.low) ?? 0,
    close,
    adjClose: toNum(r.adjclose ?? r.close) ?? 0,
    volume: Number(r.volume ?? 0),
    change: close - prev,
    changePercent: prev > 0 ? ((close - prev) / prev) * 100 : 0,
  };
}

async function getYahooQuote(symbol) {
  const cacheKey = `quote_${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  try {
    const q = await yf.quote(symbol);
    const result = normalizeQuote(q, symbol);
    cache.set(cacheKey, result, QUOTE_TTL);
    return result;
  } catch { return null; }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function handleDemo(req, res) {
  res.json({ message: 'Hello from Vantage API' });
}

export async function handleStockQuote(req, res) {
  const symbol = String(req.query?.symbol || '').toUpperCase();
  if (!symbol) return res.status(400).json({ error: 'symbol parameter required' });
  const result = await getYahooQuote(symbol);
  res.json(result);
}

export async function handleBatchQuotes(req, res) {
  const raw = String(req.query?.symbols || req.query?.symbol || '');
  const symbols = raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  if (!symbols.length) return res.status(400).json({ error: 'symbols parameter required' });
  const quotes = await Promise.all(symbols.map(getYahooQuote));
  res.json({ quotes });
}

export async function handleIndexQuotes(req, res) {
  const cacheKey = 'index_quotes';
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const [sp500, nasdaq, dow] = await Promise.all([
    yf.quote('^GSPC').catch(() => null),
    yf.quote('^IXIC').catch(() => null),
    yf.quote('^DJI').catch(() => null),
  ]);

  const wrap = (q, name, sym) => q ? {
    symbol: sym, name,
    price: toNum(q.regularMarketPrice) ?? 0,
    change: toNum(q.regularMarketChange) ?? 0,
    changesPercentage: toNum(q.regularMarketChangePercent) ?? 0,
  } : null;

  const result = {
    sp500: wrap(sp500, 'S&P 500', '^GSPC'),
    nasdaq: wrap(nasdaq, 'Nasdaq', '^IXIC'),
    dow: wrap(dow, 'Dow Jones', '^DJI'),
  };
  cache.set(cacheKey, result, QUOTE_TTL);
  res.json(result);
}

export async function handleStockOverview(req, res) {
  const symbol = String(req.query?.symbol || '').toUpperCase();
  if (!symbol) return res.status(400).json({ error: 'symbol parameter required' });
  try {
    const q = await yf.quote(symbol);
    if (q) {
      return res.json({
        symbol: q.symbol || symbol,
        companyName: q.longName || q.shortName || symbol,
        description: q.longBusinessSummary || '',
        sector: q.sector || '', industry: q.industry || '',
        ceo: '', fullTimeEmployees: null, beta: toNum(q.beta),
        peRatio: toNum(q.trailingPE), marketCap: toNum(q.marketCap),
        price: toNum(q.regularMarketPrice), exchange: q.exchange,
        currency: q.currency, image: '',
      });
    }
  } catch {}
  res.json({ symbol, companyName: symbol, description: '', sector: '', industry: '', ceo: '', fullTimeEmployees: null, beta: null, peRatio: null });
}

// Yahoo returns summary fields either as bare numbers (defaultKeyStatistics)
// or as `{ raw, fmt }` objects (financialData, summaryDetail). `pick()`
// normalises both shapes: bare → itself, object → .raw, anything missing → undefined.
function pick(v) {
  if (v == null) return undefined;
  if (typeof v === 'object' && 'raw' in v) return Number.isFinite(Number(v.raw)) ? Number(v.raw) : undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// Converts Yahoo's `endDate` field. The history modules return ISO strings
// already, but a few other sub-fields (splitDate, fiscalYearEnd) come back
// as Unix seconds. Single helper so both go through one normalisation path.
function isoDate(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const asNum = Number(s);
  if (Number.isFinite(asNum) && asNum > 1_000_000_000) {
    const ms = asNum > 1e12 ? asNum : asNum * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return s.slice(0, 10);
}

// Calendar year derived from an end-date.
function calYearOf(isoD) { return isoD ? isoD.slice(0, 4) : ''; }

export async function handleStockMetrics(req, res) {
  const symbol = String(req.query?.symbol || '').toUpperCase();
  if (!symbol) return res.status(400).json({ error: 'symbol parameter required' });
  const ck = `metrics_${symbol}`;
  const cached = cache.get(ck);
  if (cached) return res.json(cached);

  try {
    // Catch returns `{}` so the per-module `.defaultKeyStatistics || {}` paths
    // never blow up on a partial Yahoo response.
    const raw = await yf.quoteSummary(symbol, {
      modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail'],
    }).catch((e) => {
      throttledWarn(`qs:metrics:${symbol}`, `quoteSummary metrics ${symbol}:`, e?.message);
      return {};
    });
    const dks = raw?.defaultKeyStatistics || {};
    const fd = raw?.financialData || {};
    const sd = raw?.summaryDetail || {};

    // Backfill `symbol` so `peRatioTTM`, etc., match the shared StockMetrics type
    // — the interface allows the key but the request URL is the source of truth.
    const metrics = {
      revenuePerShareTTM: pick(fd.revenuePerShare),
      netIncomePerShareTTM: pick(dks.trailingEps),
      operatingCashFlowPerShareTTM: pick(fd.operatingCashflow != null && fd.sharesOutstanding ? fd.operatingCashflow / fd.sharesOutstanding : undefined),
      peRatioTTM: pick(sd.trailingPE) ?? pick(dks.forwardPE),
      dividendYielTTM: pick(sd.dividendYield) ?? pick(sd.trailingAnnualDividendYield),
      priceToSalesRatioTTM: pick(sd.priceToSalesTrailing12Months) ?? pick(dks.enterpriseToRevenue),
      priceToBookRatioTTM: pick(dks.priceToBook),
      evToSalesTTM: pick(dks.enterpriseToRevenue),
      evToEBITDATTM: pick(dks.enterpriseToEbitda),
      evToOperatingCashFlowTTM: undefined, // Yahoo free tier doesn't expose EV / OCF cleanly
      returnOnEquityTTM: pick(fd.returnOnEquity),
      returnOnAssetsTTM: pick(fd.returnOnAssets),
      freeCashFlowYieldTTM: undefined,     // would need price + diluted shares — not derivable cheaply
    };

    const ratios = {
      priceEarningsRatioTTM: pick(sd.trailingPE),
      priceToBookRatioTTM: pick(dks.priceToBook),
      priceToSalesRatioTTM: pick(sd.priceToSalesTrailing12Months) ?? pick(dks.enterpriseToRevenue),
      priceToEarningsGrowthRatioTTM: pick(dks.pegRatio),
      netProfitMargin: pick(fd.profitMargins) ?? pick(dks.profitMargins),
      operatingProfitMarginTTM: pick(fd.operatingMargins),
      grossProfitMarginTTM: pick(fd.grossMargins),
      dividendPayoutRatioTTM: pick(sd.payoutRatio),
      currentRatio: pick(fd.currentRatio),
      quickRatio: pick(fd.quickRatio),
      debtToEquityRatio: pick(fd.debtToEquity),
    };

    // Strip undefined keys so the payload is tight.
    const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

    const result = { metrics: clean(metrics), ratios: clean(ratios), scores: null };
    cache.set(ck, result, 600); // 10-minute TTL — ratios refresh slowly between earnings reports
    res.json(result);
  } catch (e) {
    throttledWarn(`metrics:${symbol}`, `metrics ${symbol}:`, e?.message);
    res.json({ metrics: {}, ratios: {}, scores: null });
  }
}

/**
 * Income / balance / cash rows for the requested symbol.
 *
 * Primary path (default): yahoo-finance2 v4 `fundamentalsTimeSeries()` over
 * kebab-case modules `financials` / `balance-sheet` / `cash-flow` + a
 * `type` of `annual` or `quarterly`. Yahoo points users here since their
 * `quoteSummary` history modules have been returning sparse data since
 * Nov 2024 — see https://github.com/gadicc/yahoo-finance2/blob/master/src/modules/fundamentalsTimeSeries.d.ts.
 *
 * Each module call returns a flat array. We fan out the 3 calls in
 * parallel via `Promise.allSettled` so a sparse balance-sheet response
 * (NVDA returned only 7 fields in probe) doesn't block the income
 * rows. The eventual cache entry is one object per (symbol, period)
 * with arrays for all three statements; partial returns are intentional.
 *
 * Fallback path: `quoteSummary` history modules. Kept behind the
 * `YAHOO_FUNDAMENTALS_PRIMARY=quoteSummary` env var so we can flip back
 * if the new path rate-limits or breaks. Same field shapes either way —
 * `Index.tsx`'s 8-card grid reads `revenue, ebitda, grossProfit,
 * operatingIncome, eps, netIncome, cashAndCashEquivalents, totalAssets`
 * by exact name.
 *
 * `?period=quarter` switches both paths to quarterly sources: FTS uses
 * `type: 'quarterly'`, the legacy uses `*HistoryQuarterly` modules.
 *
 * `periodType` ('12M' = FY, '3M' = Q) drives the `period` label so
 * downstream `safeYoy()` year-over-year math still aligns.
 */
export async function handleStockFinancials(req, res) {
  const symbol = String(req.query?.symbol || '').toUpperCase();
  if (!symbol) return res.status(400).json({ error: 'symbol parameter required' });
  const period = String(req.query?.period || 'annual').toLowerCase() === 'quarter' ? 'quarter' : 'annual';
  const ck = `fin_${symbol}_${period}`;
  const cached = cache.get(ck);
  if (cached) return res.json(cached);

  // Strict: only the literal string `"quoteSummary"` flips us to the legacy
  // path. Default (unset / empty / random value) → FTS. Negative env values
  // like `=0` or `=false` don't accidentally toggle the flag.
  const isFts = process.env.YAHOO_FUNDAMENTALS_PRIMARY !== 'quoteSummary';
  let income = [], balance = [], cash = [];

  try {
    if (isFts) {
      // ── Primary: fundamentalsTimeSeries ──────────────────────────────────────
      // period1 = 5y back covers annual rows; quarterly type returns ~5 quarters
      // over a 2y window so we use the same fetch range for both.
      const period1 = new Date();
      period1.setFullYear(period1.getFullYear() - 5);
      const t = period === 'quarter' ? 'quarterly' : 'annual';

      const fanOut = (module, label) =>
        yf.fundamentalsTimeSeries(symbol, { module, period1, type: t })
          .catch((e) => { throttledWarn(`fts:${label}:${symbol}`, `fts ${label} ${symbol}:`, e?.message); return null; });

      const [finRes, balRes, cshRes] = await Promise.all([
        fanOut('financials', 'fin'),
        fanOut('balance-sheet', 'bs'),
        fanOut('cash-flow', 'cf'),
      ]);

      // First-non-undefined lookup across a list of candidate Yahoo field names.
      // The module returns a SINGLE flat array per call — not nested by module
      // name — so we just map over the array and read each row's per-section
      // keys directly. Empty rows (e.g. NVDA's slim balance-sheet response)
      // produce undefined fields but the row is preserved so the date axis
      // stays aligned across income/balance/cash.
      const ftsGet = (r, keys) => {
        if (!r) return undefined;
        for (const k of keys) {
          const v = r[k];
          if (v !== undefined && v !== null) {
            const n = Number(v);
            return Number.isFinite(n) ? n : undefined;
          }
        }
        return undefined;
      };

      const processFtsRow = (r, kind) => {
        const date = isoDate(r.date);
        // Use the URL param (intent) instead of `r.periodType` to derive the
        // label — Yahoo's `periodType` is `'12M' | '3M'`, but if anything
        // returns mixed during an upstream anomaly we still emit the
        // label that matches what the client requested.
        const periodLabel = period === 'quarter' ? 'Q' : 'FY';
        const row = { date, symbol, reportedCurrency: 'USD', calendarYear: calYearOf(date), period: periodLabel };
        if (kind === 'income') {
          row.revenue = ftsGet(r, ['totalRevenue', 'operatingRevenue']) ?? 0;
          row.costOfRevenue = ftsGet(r, ['costOfRevenue']);
          row.grossProfit = ftsGet(r, ['grossProfit']);
          row.operatingIncome = ftsGet(r, ['operatingIncome', 'ebit']);
          row.operatingExpense = ftsGet(r, ['operatingExpense']);
          row.ebitda = ftsGet(r, ['normalizedEBITDA', 'ebitda']) ?? 0;
          row.netIncome = ftsGet(r, ['netIncome', 'netIncomeCommonStockholders']) ?? 0;
          row.eps = ftsGet(r, ['basicEPS', 'dilutedEPS']);
          row.epsDiluted = ftsGet(r, ['dilutedEPS']);
        } else if (kind === 'balance') {
          // Annual rows have `totalAssets`; quarterly rows sometimes come
          // back as `quarterlyTotalAssets`. Probe both.
          row.totalAssets = ftsGet(r, ['totalAssets', 'quarterlyTotalAssets']) ?? 0;
          row.totalLiabilities = ftsGet(r, ['totalLiabilitiesNetMinorityInterest']);
          row.totalEquity = ftsGet(r, ['stockholdersEquity', 'totalEquityGrossMinorityInterest']);
          row.totalDebt = ftsGet(r, ['totalDebt', 'longTermDebt']);
          row.cashAndCashEquivalents = ftsGet(r, ['cashAndCashEquivalents', 'cash']) ?? 0;
          row.netDebt = ftsGet(r, ['netDebt']) ?? ((row.totalDebt ?? 0) - row.cashAndCashEquivalents);
        } else if (kind === 'cash') {
          const explicitOcf = ftsGet(r, ['operatingCashFlow', 'cashFlowFromContinuingOperatingActivities']);
          row.operatingCashFlow = explicitOcf ?? 0;
          row.capitalExpenditure = ftsGet(r, ['capitalExpenditure']);
          // Yahoo reports capex as a negative on the cash flow statement;
          // flip so client UI's `FCF = OCF - Capex` reads naturally.
          const capex = row.capitalExpenditure !== undefined ? -Math.abs(row.capitalExpenditure) : 0;
          // Don't derive `freeCashFlow` from a missing OCF (would yield a
          // misleading 0-0=0). Prefer an explicit Yahoo FCF; fall back to
          // math only when OCF is present; otherwise leave undefined so
          // `stripUndef` drops the key.
          const explicitFcf = ftsGet(r, ['freeCashFlow']);
          row.freeCashFlow = explicitFcf !== undefined
            ? explicitFcf
            : explicitOcf !== undefined
              ? (row.operatingCashFlow || 0) - capex
              : undefined;
          row.stockBasedCompensation = ftsGet(r, ['stockBasedCompensation']);
          row.dividendPayments = ftsGet(r, ['cashDividendsPaid', 'dividendsPaid']);
        }
        return stripUndef(row);
      };

      if (Array.isArray(finRes)) income = finRes.map((r) => processFtsRow(r, 'income'));
      if (Array.isArray(balRes)) balance = balRes.map((r) => processFtsRow(r, 'balance'));
      if (Array.isArray(cshRes)) cash = cshRes.map((r) => processFtsRow(r, 'cash'));

      const result = { income, balance, cash };
      // 6h TTL — fundamentalsTimeSeries modules propagate asynchronously at
      // Yahoo's end (income may land before balance sheet on earnings day),
      // so 6h strikes the balance between fresh and not-thrashing rate limits.
      cache.set(ck, result, 21600);
      res.json(result);
      return;
    }

    // ── Fallback: quoteSummary history modules (legacy) ────────────────────────
    const modules = period === 'quarter'
      ? ['incomeStatementHistoryQuarterly', 'balanceSheetHistoryQuarterly', 'cashflowStatementHistoryQuarterly']
      : ['incomeStatementHistory', 'balanceSheetHistory', 'cashflowStatementHistory'];
    const raw = await yf.quoteSummary(symbol, { modules }).catch((e) => {
      throttledWarn(`qs:fin:${symbol}`, `quoteSummary fin ${symbol}:`, e?.message);
      return {};
    });

    const incRoot = raw?.[modules[0]] || {};
    const balRoot = raw?.[modules[1]] || {};
    const cshRoot = raw?.[modules[2]] || {};
    // Yahoo nests the rows under either `*Statements` (new layout) or the
    // module name itself (older libs). Try both — whichever resolves wins.
    const incRows = incRoot.incomeStatementHistory || incRoot.incomeStatementHistoryQuarterly
      || incRoot.incomeStatements || incRoot.incomeStatementHistoryStatements || [];
    const balRows = balRoot.balanceSheetHistory || balRoot.balanceSheetHistoryQuarterly
      || balRoot.balanceSheetStatements || [];
    const cshRows = cshRoot.cashflowStatementHistory || cshRoot.cashflowStatementHistoryQuarterly
      || cshRoot.cashflowStatements || [];

    const symbolRow = (r, kind, section) => {
      const date = isoDate(r.endDate);
      const calendarYear = calYearOf(date);
      const periodLabel = section || (period === 'quarter' ? 'Q' : 'FY');
      const row = { date, symbol, reportedCurrency: 'USD', calendarYear, period: periodLabel };
      if (kind === 'income') {
        row.revenue = pick(r.totalRevenue) ?? 0;
        row.costOfRevenue = pick(r.costOfRevenue);
        row.grossProfit = pick(r.grossProfit);
        row.operatingIncome = pick(r.operatingIncome);
        row.operatingExpense = pick(r.totalOperatingExpenses);
        row.ebitda = pick(r.ebitda) ?? 0;
        row.netIncome = pick(r.netIncome) ?? 0;
        row.eps = pick(r.dilutedEPS) ?? pick(r.basicEPS);
        row.epsDiluted = pick(r.dilutedEPS);
      } else if (kind === 'balance') {
        row.totalAssets = pick(r.totalAssets) ?? 0;
        row.totalLiabilities = pick(r.totalLiab);
        row.totalEquity = pick(r.totalStockholderEquity);
        row.totalDebt = pick(r.totalDebt) ?? pick(r.longTermDebt);
        row.cashAndCashEquivalents = pick(r.cash) ?? 0;
        row.netDebt = (row.totalDebt ?? 0) - row.cashAndCashEquivalents;
      } else if (kind === 'cash') {
        row.operatingCashFlow = pick(r.totalCashFromOperatingActivities) ?? 0;
        row.capitalExpenditure = pick(r.capitalExpenditures);
        // Yahoo reports capex as a negative on the cash flow statement;
        // flip so client UI's `FCF = OCF - Capex` reads naturally.
        const capex = row.capitalExpenditure !== undefined ? -Math.abs(row.capitalExpenditure) : 0;
        row.freeCashFlow = row.operatingCashFlow - capex;
        row.stockBasedCompensation = pick(r.stockBasedCompensation);
        row.dividendPayments = pick(r.dividendsPaid);
      }
      return row;
    };

    const incomeLegacy = incRows.map((r) => stripUndef(symbolRow(r, 'income', period === 'quarter' ? 'Q' : 'FY')));
    const balanceLegacy = balRows.map((r) => stripUndef(symbolRow(r, 'balance', period === 'quarter' ? 'Q' : 'FY')));
    const cashLegacy = cshRows.map((r) => stripUndef(symbolRow(r, 'cash', period === 'quarter' ? 'Q' : 'FY')));

    const result = { income: incomeLegacy, balance: balanceLegacy, cash: cashLegacy };
    cache.set(ck, result, 86400); // 24h — quarterly statements don't change daily
    res.json(result);
  } catch (e) {
    throttledWarn(`fin:${symbol}`, `financials ${symbol}:`, e?.message);
    res.json({ income: [], balance: [], cash: [] });
  }
}

// Strip undefined keys from a row so the JSON wire payload is tight.
// Lifted out of handleStockFinancials' body so both primary and fallback
// paths can reuse it without duplicating the filter.
function stripUndef(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

export async function handleStockAnalyst(req, res) {
  const symbol = String(req.query?.symbol || '').toUpperCase();
  if (!symbol) return res.status(400).json({ error: 'symbol parameter required' });
  const ck = `analyst_${symbol}`;
  const cached = cache.get(ck);
  if (cached) return res.json(cached);
  try {
    const raw = await yf.quoteSummary(symbol, { modules: ['earningsTrend'] });
    const trend = raw?.earningsTrend?.trend ?? [];
    const result = trend.map(p => ({
      period: String(p.period || ''),
      endDate: p.endDate,
      growth: p.growth?.raw,
      earningsEstimate: p.earningsEstimate ? { avg: p.earningsEstimate.avg?.raw ?? null, low: p.earningsEstimate.low?.raw ?? null, high: p.earningsEstimate.high?.raw ?? null } : undefined,
      revenueEstimate: p.revenueEstimate ? { avg: p.revenueEstimate.avg?.raw ?? null, low: p.revenueEstimate.low?.raw ?? null, high: p.revenueEstimate.high?.raw ?? null } : undefined,
      epsTrend: p.epsTrend ? { current: p.epsTrend.current?.raw ?? null, sevenDaysAgo: p.epsTrend['7daysAgo']?.raw ?? null, thirtyDaysAgo: p.epsTrend['30daysAgo']?.raw ?? null } : undefined,
    }));
    cache.set(ck, result);
    res.json(result);
  } catch (e) {
    throttledWarn(`analyst:${symbol}`, `analyst ${symbol}:`, e?.message);
    res.json([]);
  }
}

export async function handleStockInsider(req, res) {
  const symbol = String(req.query?.symbol || '').toUpperCase();
  if (!symbol) return res.status(400).json({ error: 'symbol parameter required' });
  const ck = `insider_${symbol}`;
  const cached = cache.get(ck);
  if (cached) return res.json(cached);
  try {
    const raw = await yf.quoteSummary(symbol, { modules: ['insiderTransactions'] });
    const txs = raw?.insiderTransactions?.transactions ?? [];
    const result = txs.map(t => {
      const shares = t.shares?.raw ?? Number(t.shares ?? 0);
      const value = t.value?.raw ?? Number(t.value ?? 0);
      return {
        filerName: String(t.filerName || t.name || 'Insider'),
        filerRelation: t.filerRelation?.raw ?? t.filerRelation,
        transactionText: String(t.transactionText || t.type || 'Transaction'),
        startDate: t.startDate?.raw ?? t.startDate ?? 0,
        shares, value, price: shares > 0 ? value / shares : 0,
      };
    });
    cache.set(ck, result);
    res.json(result);
  } catch (e) {
    throttledWarn(`insider:${symbol}`, `insider ${symbol}:`, e?.message);
    res.json([]);
  }
}

export async function handleStockNews(req, res) {
  const symbol = String(req.query?.symbol || '').toUpperCase();
  if (!symbol) return res.status(400).json({ error: 'symbol parameter required' });
  const ck = `news_${symbol}`;
  const cached = cache.get(ck);
  if (cached) return res.json(cached);
  try {
    const raw = await yf.search(symbol, { newsCount: 5 });
    const items = raw?.news ?? [];
    const result = items.map(n => {
      const c = n.content ?? n;
      return {
        title: String(c.title || c.headline || n.title || ''),
        publisher: String(c.providerName || c.publisher || n.publisher || 'News'),
        providerPublishTime: typeof c.providerPublishTime === 'number' ? c.providerPublishTime : Math.floor(Date.now() / 1000),
        link: String(c.clickUrl || c.url || c.link || n.link || '#'),
        thumbnail: c.thumbnail?.resolutions?.[0]?.url || c.thumbnail,
        type: c.type,
      };
    });
    cache.set(ck, result);
    res.json(result);
  } catch (e) {
    throttledWarn(`news:${symbol}`, `news ${symbol}:`, e?.message);
    res.json([]);
  }
}

export async function handleStockChart(req, res) {
  const symbol = String(req.query?.symbol || '').toUpperCase();
  if (!symbol) return res.status(400).json({ error: 'symbol parameter required' });
  const ck = `chart_${symbol}`;
  const cached = cache.get(ck);
  if (cached) return res.json(cached);
  try {
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 1);
    const raw = await yf.historical(symbol, { period1, interval: '1d' });
    const rows = Array.isArray(raw) ? raw : raw?.quotes ?? [];
    if (!rows.length) return res.json(null);
    const result = { symbol, historical: rows.map(normalizeChartPoint) };
    cache.set(ck, result, CHART_TTL);
    res.json(result);
  } catch (e) {
    throttledWarn(`chart:${symbol}`, `chart ${symbol}:`, e?.message);
    res.json(null);
  }
}

export async function handleEarningsCalendar(req, res) {
  res.json([]);
}

export const handleStockProfile = handleStockOverview;

export async function handleSectorHeatmap(req, res) {
  const symbolsRaw = String(req.query?.symbols || '');
  if (!symbolsRaw) return res.status(400).json({ error: 'symbols parameter required' });
  const symbols = symbolsRaw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  if (symbols.length > 50) return res.status(400).json({ error: 'Too many symbols. Max 50.' });
  const days = Math.max(3, Math.min(10, Math.floor(Number(req.query?.days ?? 5))));
  const now = new Date();
  const dateStrs = [];
  for (let i = days; i >= 1; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    dateStrs.push(d.toISOString().slice(0, 10));
  }
  res.json({ days: dateStrs, rows: [], untagged: [], generatedAt: new Date().toISOString() });
}

const INSIGHTS_UNIVERSES = {
  sp500: { label: 'S&P 500', entries: [
    { symbol: 'AAPL', name: 'Apple' }, { symbol: 'MSFT', name: 'Microsoft' },
    { symbol: 'GOOGL', name: 'Alphabet' }, { symbol: 'AMZN', name: 'Amazon' },
    { symbol: 'NVDA', name: 'NVIDIA' }, { symbol: 'META', name: 'Meta' },
    { symbol: 'TSLA', name: 'Tesla' }, { symbol: 'JPM', name: 'JPMorgan Chase' },
    { symbol: 'V', name: 'Visa' }, { symbol: 'MA', name: 'Mastercard' },
  ]},
  trending: { label: 'Trending', entries: [
    { symbol: 'PLTR', name: 'Palantir' }, { symbol: 'ARM', name: 'Arm Holdings' },
    { symbol: 'COIN', name: 'Coinbase' }, { symbol: 'RDDT', name: 'Reddit' },
  ]},
  growth: { label: 'Growth', entries: [
    { symbol: 'CRM', name: 'Salesforce' }, { symbol: 'NOW', name: 'ServiceNow' },
    { symbol: 'ADBE', name: 'Adobe' }, { symbol: 'INTU', name: 'Intuit' },
  ]},
};

export async function handleInsightsTab(req, res) {
  const tab = String(req.query?.tab || 'sp500');
  const universe = INSIGHTS_UNIVERSES[tab] || INSIGHTS_UNIVERSES.sp500;
  res.json({ tab, label: universe.label, entries: universe.entries });
}

export async function handleSmaDistances(req, res) {
  const raw = req.query?.symbols ?? req.query?.symbol ?? [];
  const list = Array.isArray(raw) ? raw.map(String) : String(raw).split(',').map(s => s.trim());
  const symbols = list.filter(Boolean).map(s => s.toUpperCase());
  if (!symbols.length) return res.status(400).json({ error: 'symbols parameter required' });
  if (symbols.length > 50) return res.status(400).json({ error: 'Too many symbols. Max 50.' });
  const windowSize = Math.max(5, Math.min(200, Math.floor(Number(req.query?.window ?? 200))));
  const rows = await Promise.all(symbols.map(async (sym) => {
    try {
      const period1 = new Date(); period1.setFullYear(period1.getFullYear() - 1);
      const r = await yf.historical(sym, { period1, interval: '1d' });
      const chart = Array.isArray(r) ? r : r?.quotes ?? [];
      const closes = chart.map(p => Number(p.close)).filter(n => Number.isFinite(n) && n > 0);
      const tail = closes.slice(-windowSize);
      if (!tail.length) return { symbol: sym, sma200: null, distancePct: null, sampleSize: 0, price: null };
      const sum = tail.reduce((s, n) => s + n, 0);
      const mean = sum / tail.length;
      const price = tail[tail.length - 1];
      return { symbol: sym, sma200: mean, distancePct: mean > 0 ? ((price - mean) / mean) * 100 : null, sampleSize: tail.length, price };
    } catch {
      return { symbol: sym, sma200: null, distancePct: null, sampleSize: 0, price: null };
    }
  }));
  res.json({ rows });
}

export async function handleFxRates(req, res) {
  const raw = String(req.query?.currencies || 'USD,ILS,EUR');
  const valid = new Set(['USD', 'ILS', 'EUR', 'GBP']);
  const currencies = raw.split(',').map(s => s.trim().toUpperCase()).filter(s => valid.has(s));
  if (!currencies.length) return res.status(400).json({ error: 'currencies parameter required' });
  const ck = `fx_${currencies.slice().sort().join(',')}`;
  const cached = cache.get(ck);
  if (cached) return res.json(cached);
  const pairs = [];
  for (const base of currencies)
    for (const quote of currencies)
      if (base !== quote) pairs.push(`${base}${quote}=X`);
  const settled = await Promise.all(pairs.map(async (sym) => {
    try { const r = await yf.quote(sym); const px = Number(r?.regularMarketPrice ?? NaN); return Number.isFinite(px) && px > 0 ? [sym.replace('=X', ''), px] : null; } catch { return null; }
  }));
  const rates = { USDUSD: 1 };
  for (const s of settled) if (s) rates[s[0]] = s[1];
  const result = { rates, fetchedAt: new Date().toISOString(), source: 'yahoo' };
  cache.set(ck, result, 3600);
  res.json(result);
}

// Deprecated 2026-07: logos moved client-side to Logo.dev's direct CDN
// (see `client/lib/logoDev.ts`). The publishable `pk_` key is designed for
// `<img src>` use, so the proxy no longer adds latency or privacy advantage.
// Removed from the router map below; this handler stays exported in case
// a future route needs first-party branding. Calls to /api/company-logo
// now 404 from the catch-all — migrating callers should switch to `import
// { getLogoDevUrl } from '@/lib/logoDev'` and embed the URL directly.
export async function handleCompanyLogo(req, res) {
  const ticker = String(req.query?.ticker || '').toUpperCase();
  if (!ticker) return res.status(400).json({ error: 'ticker parameter required' });
  const token = process.env.LOGO_DEV_TOKEN || '';
  if (!token) return res.status(503).json({ error: 'LOGO_DEV_TOKEN not configured' });
  try {
    const url = `https://img.logo.dev/ticker/${ticker}?token=${token}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const response = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!response.ok) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ error: `logo not found: ${response.status}` });
    }
    const arrayBuf = await response.arrayBuffer();
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(arrayBuf));
  } catch (e) {
    if (e?.name === 'AbortError') return res.status(504).json({ error: 'Logo request timed out' });
    res.status(500).json({ error: 'Failed to fetch logo' });
  }
}

// ── Router ────────────────────────────────────────────────────────────────────
// `/api/company-logo` is intentionally OMITTED from the routes map: logos now
// load client-side directly from Logo.dev's CDN (publishable key is safe for
// `<img src>`s, see `client/lib/logoDev.ts`). A curl to the previous URL
// returns 404 from the catch-all router. The `handleCompanyLogo` handler is
// still exported — kept in case a future proxy requires server-side caching
// or first-party branding.
const routes = {
  '/api/demo': handleDemo,
  '/api/stock-quote': handleStockQuote,
  '/api/stock-batch-quotes': handleBatchQuotes,
  '/api/stock-profile': handleStockProfile,
  '/api/stock-overview': handleStockOverview,
  '/api/stock-financials': handleStockFinancials,
  '/api/stock-metrics': handleStockMetrics,
  '/api/stock-analyst': handleStockAnalyst,
  '/api/stock-insider': handleStockInsider,
  '/api/stock-news': handleStockNews,
  '/api/earnings-calendar': handleEarningsCalendar,
  '/api/stock-chart': handleStockChart,
  '/api/index-quotes': handleIndexQuotes,
  '/api/sector-heatmap': handleSectorHeatmap,
  '/api/insights-tab': handleInsightsTab,
  '/api/sma-distances': handleSmaDistances,
  '/api/fx-rates': handleFxRates,
};

export async function router(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  const fn = routes[path];
  if (!fn) {
    res.status(404).json({ error: `Not found: ${path}` });
    return;
  }
  try {
    await fn(req, res);
  } catch (e) {
    console.error(`[router] ${path} error:`, e);
    res.status(500).json({ error: 'Internal server error', detail: e?.message });
  }
}
