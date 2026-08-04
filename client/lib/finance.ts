/**
 * client/lib/finance.ts
 *
 * Pure, side-effect-free analytics utilities. Used by the Portfolio page to
 * derive IRR / CAGR / Sharpe / Sortino / Volatility from a cashflow series
 * or a daily-close series. No fetchers here — UI components thread the data
 * in; the math stays deterministic and testable.
 *
 * Algorithms:
 *  - IRR: bisection on the NPV equation over the bracket (-0.99, +1.0).
 *    Newton-Raphson can be plugged in later as a warm-start accelerator
 *    (it's faster when the cashflows change sign monotonically) but
 *    bisection is bulletproof when cashflows flip multiple times — which
 *    is exactly the case for living portfolios with periodic deposits,
 *    dividends, and withdrawals. We always need at least 2 cashflows.
 *  - CAGR: closed-form (end / start)^(1/years) - 1.
 *  - Volatility: stddev of daily log-returns × √(tradingDays/year).
 *  - Sharpe:  (meanDailyExcess / stddevDaily) × √(252). Risk-free = 4.5%.
 *  - Sortino: same shape as Sharpe but denominator is downside stddev
 *    (returns below the per-day rf threshold only).
 */

const TRADING_DAYS_PER_YEAR = 252;
const DEFAULT_RISK_FREE = 0.045; // 4.5% APR — the SEC-supplied approximation.

export interface CashflowPoint {
  date: string;       // ISO YYYY-MM-DD or full ISO datetime
  amount: number;     // signed (negative = invested, positive = received)
}

export interface IIRResult {
  rate: number | null;       // annualized rate as decimal, e.g. 0.094 = 9.4%
  iterations: number;
  reason: "converged" | "no_sign_change" | "too_few_points" | "no_convergence";
}

/**
 * Computes the annualized internal rate of return for dated cashflows.
 *
 * @param cashflows - Dated cashflows, with negative amounts representing investments and positive amounts representing receipts.
 * @param opts - Optional bisection bounds, convergence tolerance, and iteration limit.
 * @returns The estimated rate and convergence status, or `null` when the input is insufficient or the bracket does not contain a valid root.
 */
export function irrBisection(
  cashflows: CashflowPoint[],
  opts: { low?: number; high?: number; tol?: number; maxIter?: number } = {}
): IIRResult {
  const low0 = opts.low ?? -0.999;
  const high0 = opts.high ?? 1.0;
  const tol = opts.tol ?? 1e-7;
  const maxIter = opts.maxIter ?? 200;

  if (cashflows.length < 2) {
    return { rate: null, iterations: 0, reason: "too_few_points" };
  }

  // Sort ascending by date so the time-axis is correct.
  const sorted = [...cashflows].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );
  const t0 = new Date(sorted[0].date).getTime();
  if (!Number.isFinite(t0)) {
    return { rate: null, iterations: 0, reason: "too_few_points" };
  }
  const npv = (r: number) => {
    let acc = 0;
    for (const cf of sorted) {
      const years = (new Date(cf.date).getTime() - t0) / (365.25 * 24 * 3600 * 1000);
      acc += cf.amount / Math.pow(1 + r, years);
    }
    return acc;
  };

  let lo = low0, hi = high0;
  let vLo = npv(lo);
  let vHi = npv(hi);

  // Coin-flip check: the bracket must straddle zero for the bisection to find
  // a root. If both ends have the same sign, the IRR either doesn't exist
  // (cancellable streams) or lies outside our bracket — surface this honestly.
  if (!Number.isFinite(vLo) || !Number.isFinite(vHi) || vLo * vHi >= 0) {
    return { rate: null, iterations: 0, reason: "no_sign_change" };
  }

  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    const v = npv(mid);
    if (!Number.isFinite(v)) {
      return { rate: null, iterations: i, reason: "no_convergence" };
    }
    if (Math.abs(v) < tol) {
      return { rate: mid, iterations: i, reason: "converged" };
    }
    if (v * vLo < 0) {
      hi = mid; vHi = v;
    } else {
      lo = mid; vLo = v;
    }
  }
  // Best-effort fallback: return the midpoint even if we didn't converge.
  return { rate: (lo + hi) / 2, iterations: maxIter, reason: "no_convergence" };
}

/**
 * Calculates the compound annual growth rate between two values.
 *
 * @param startValue - The initial value.
 * @param endValue - The final value.
 * @param years - The elapsed time in years.
 * @returns The annualized growth rate, or `null` when the inputs cannot produce a valid rate.
 */
export function cagr(startValue: number, endValue: number, years: number): number | null {
  if (startValue <= 0 || years <= 0 || !Number.isFinite(startValue) || !Number.isFinite(endValue)) return null;
  const ratio = endValue / startValue;
  if (ratio <= 0) return null;
  return Math.pow(ratio, 1 / years) - 1;
}

/**
 * Map a FinanceMetric `name` (the same key passed into `t()`) to the
 * statement source + column + display divisor the ChartModal needs to
 * project a `FinancialStatements` row into a `(date, value)` bar.
 *
 * Centralising this here means:
 *   - the ChartModal does not hardcode metric-key wiring (full-card view
 *     and modal view stay in lockstep),
 *   - quarterly-mode projection uses the SAME map as annual-mode so a
 *     future contributor adding a new metric only writes one row,
 *   - the spec can pin the map without spinning up React.
 *
 * The `name` argument accepts any of the keys Index.tsx puts inside a
 * `FinancialMetric.name` (`insights.revenue`, `insights.eps`, ...). The
 * `EPS` and dollar-denominated metrics pass through with `divisor: 1`
 * because the raw `eps` field is already in $/share.
 */
export interface MetricStatementKey {
  statement: "income" | "balance" | "cash";
  /** Key on IncomeStatementRow / BalanceSheetRow / CashFlowRow. */
  key: string;
  /** Divide raw value for display (revenue/EBITDA/etc → B = 1e9). */
  divisor: number;
}

const METRIC_KEY_MAP: Record<string, MetricStatementKey> = {
  "insights.revenue":           { statement: "income",   key: "revenue",              divisor: 1e9 },
  "insights.ebitda":            { statement: "income",   key: "ebitda",               divisor: 1e9 },
  "insights.grossProfit":       { statement: "income",   key: "grossProfit",          divisor: 1e9 },
  "insights.operatingIncome":   { statement: "income",   key: "operatingIncome",      divisor: 1e9 },
  "insights.netIncome":         { statement: "income",   key: "netIncome",            divisor: 1e9 },
  "insights.eps":               { statement: "income",   key: "eps",                  divisor: 1    },
  "insights.cashAndEquivalents":{ statement: "balance",  key: "cashAndCashEquivalents", divisor: 1e9 },
  "insights.totalAssets":       { statement: "balance",  key: "totalAssets",          divisor: 1e9 },
};

export function metricStatementKey(name: string): MetricStatementKey | null {
  return METRIC_KEY_MAP[name] ?? null;
}

/**
 * Project a `FinancialStatements` shape for the active metric into
 * `(date, value)` points for the chart, ordered ASCENDING by date so the
 * caller can `.slice(-quarterCount)` to apply a 1Y/3Y/5Y window in both
 * annual AND quarterly modes without re-sorting.
 *
 * The `date` label prefers `Qx FY` for quarterly rows (e.g. "Q2 2025")
 * and `FY <year>` for annual rows — the tooltip renders this string
 * verbatim and this layout keeps quarters searchable in the chart.
 *
 * Returns `[]` when the metric key can't be resolved or the chosen
 * statement table is missing; callers render an empty chart rather than
 * passing a single-point series to recharts (which would error on its
 * axis builder).
 *
 * Parameter type: accepts `Pick<FinancialStatements, …>` (the full
 * shared API shape) without forcing the caller to cast `IncomeStatementRow[]`
 * to a wider type. We read `row[meta.key]` and `row.period` /
 * `row.calendarYear` defensively with internal casts because the typed
 * rows do not declare an index signature.
 */
export function projectMetricSeries(
  metricName: string,
  statements: {
    income?: ReadonlyArray<unknown>;
    balance?: ReadonlyArray<unknown>;
    cash?: ReadonlyArray<unknown>;
  } | null | undefined,
): { date: string; value: number }[] {
  const meta = metricStatementKey(metricName);
  if (!meta || !statements) return [];
  const rows = (statements[meta.statement] ?? []) as ReadonlyArray<unknown>;
  const projected = rows
    .map((row) => {
      const raw = Number((row as Record<string, unknown>)[meta.key]);
      if (!Number.isFinite(raw)) return null;
      const safeRow = row as { period?: unknown; calendarYear?: unknown };
      const isQuarter = /^Q[1-4]$/.test(String(safeRow.period ?? "").trim());
      const yearPart = String(safeRow.calendarYear ?? "").trim();
      const periodLabel = String(safeRow.period ?? "").trim();
      const date = isQuarter
        ? `${periodLabel} ${yearPart}`
        : `FY ${yearPart}`;
      // Compute a numeric chronological sort key for quarters. Extract quarter
      // number from "Q1"-"Q4"; for annual rows the key is just the year *
      // 10 so Q* keys (year * 10 + 1..4) sort naturally alongside FY keys.
      const year = Number(yearPart) || 0;
      const qMatch = /^Q([1-4])$/.exec(periodLabel);
      const chronoKey = qMatch
        ? year * 10 + Number(qMatch[1])
        : year * 10;
      return { date, value: raw / meta.divisor, chronoKey };
    })
    .filter((p): p is { date: string; value: number; chronoKey: number } => p !== null);
  // Sort by the numeric chronological key instead of the display label so
  // quarters spanning a year boundary (Q4 2024, Q1 2025, Q2 2025) appear
  // in correct order.
  projected.sort((a, b) => a.chronoKey - b.chronoKey);
  // Drop the chronoKey from the returned shape — callers only need date/value.
  return projected.map(({ date, value }) => ({ date, value }));
}

/**
 * Inspect financial-statement row `period` labels to decide whether a
 * series is ANNUAL (`period === "FY"` or blank) or QUARTERLY
 * (`period === "Q1"` – `"Q4"`). Empty arrays + unrecognised labels fall
 * back to `'annual'` so the caller always gets a deterministic answer.
 *
 * Used by `cagrAtYearsBack` to pick the right stride back: 4 quarters
 * per year vs. 1 row per year. Without this, an annual series and a
 * quarterly series of the same length would compute wildly different
 * CAGRs.
 */
export type FinancialPeriod = "annual" | "quarter";

export function detectPeriodGranularity(
  rows: ReadonlyArray<{ readonly period?: string | null }>,
): FinancialPeriod {
  if (!Array.isArray(rows) || rows.length === 0) return "annual";
  const lastPeriod = String(rows[rows.length - 1].period ?? "").trim();
  return /^Q[1-4]$/.test(lastPeriod) ? "quarter" : "annual";
}

/**
 * Walks the financial series back `years` years (annual = 1 row / year,
 * quarterly = 4 rows / year) and returns the annualized growth rate
 * expressed as **percent** (e.g. `18.32` for 18.32%/yr). Returns `null`
 * for any case that can't produce a valid number so callers can render
 * "-" instead of `NaN%`.
 *
 * Why percent, not decimal: the rest of the UI renders growth as
 * `"65.47%"` (×100 string), and CAGR renders need to plug into the same
 * `value.toFixed(2) + "%"` template in the modal. Returning the
 * already-scaled percent keeps the JSX uniform and prevents the old
 * "0.18%" typo when a contributor renders a decimal straight.
 *
 * Failure modes:
 *   - fewer than 2 rows in the series
 *   - the stride back would underflow `arr.length`
 *   - either endpoint is non-positive, non-finite, or otherwise unsuited
 *     to a power-of-(1/years) calculation
 *
 * Note: this is *close-to-close* CAGR — the straight ratio between
 * `arr[end]` and `arr[startIdx]`, geometrically annualized. If a future
 * reader wants "mean of year-over-year returns within the window", add
 * a sibling helper (`cagrMeanYoY`) rather than overloading this one.
 *
 * Parameter type uses `any[]`: stripped-of-intent but the
 * strictly-typed alternatives (`ReadonlyArray<unknown>`, generic over
 * `T extends object`) all fail to accept `IncomeStatementRow[]` /
 * `BalanceSheetRow[]` because those interfaces from `shared/api.ts`
 * intentionally omit index signatures. The function only reads
 * `arr[startIdx][key]` and feeds the values to `Number(...)`, so any
 * payload type is safe — the `any[]` is a deliberate seam, not lazily
 * typed. Document this so a future contributor doesn't try to tighten
 * the signature without first adding index-signature support upstream.
 */
export function cagrAtYearsBack<T>(
  arr: ReadonlyArray<T>,
  key: string,
  years: number,
  granularity: FinancialPeriod,
): number | null {
  if (!Array.isArray(arr) || arr.length < 2) return null;
  if (!Number.isFinite(years) || years <= 0) return null;
  const stepBack = granularity === "quarter" ? years * 4 : years;
  const lastIdx = arr.length - 1;
  const startIdx = lastIdx - stepBack;
  if (startIdx < 0) return null;
  const start = Number((arr[startIdx] as Record<string, unknown>)[key]);
  const end = Number((arr[lastIdx] as Record<string, unknown>)[key]);
  const raw = cagr(start, end, years);
  return raw === null ? null : raw * 100;
}

/**
 * Locale-aware "short month + day + year" formatter for a trade-date value.
 * Returns `null` for invalid or nullish input so callers can render their
 * own placeholder. This is what the stock banner uses for the
 * "Earnings: <date>" line (was previously rendering as bare ISO
 * `2026-04-22`, which read like a YAML key to non-technical users).
 *
 * Locale behaviour: `Intl.DateTimeFormat` inherits the browser locale
 * and falls back to en-US server-side, so HE users see e.g.
 * "22 באפר 2026" and EN users see "Apr 22, 2026" without any extra
 * wiring.
 */
export function formatEarningsDate(
  value: string | number | null | undefined,
): string | null {
  const ms = parseTradeDate(value);
  if (ms === null) return null;
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Computes returns between consecutive positive closing prices.
 *
 * @returns The day-over-day returns for adjacent pairs with positive prices.
 */
function dailyReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const cur = closes[i];
    if (prev > 0 && cur > 0) out.push(cur / prev - 1);
  }
  return out;
}

/**
 * Computes the arithmetic mean of a numeric array.
 *
 * @param xs - The numbers to average
 * @returns The arithmetic mean, or `0` when the array is empty
 */
function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/**
 * Computes the annualized volatility of a price series.
 *
 * @param closes - The closing prices used to calculate daily returns
 * @param tradingDaysPerYear - The number of trading days in a year
 * @returns The annualized volatility, or `null` when fewer than two prices or no valid daily returns are available
 */
export function annualizedVolatility(
  closes: number[],
  tradingDaysPerYear: number = TRADING_DAYS_PER_YEAR
): number | null {
  if (closes.length < 2) return null;
  const r = dailyReturns(closes);
  if (r.length === 0) return null;
  const m = mean(r);
  const variance = r.reduce((s, x) => s + (x - m) * (x - m), 0) / r.length;
  return Math.sqrt(variance) * Math.sqrt(tradingDaysPerYear);
}

/**
 * Calculates the annualized Sharpe ratio from closing prices.
 *
 * @param closes - The closing prices used to calculate daily returns.
 * @param riskFreeAnnual - The annual risk-free rate.
 * @param tradingDaysPerYear - The number of trading days in a year.
 * @returns The annualized Sharpe ratio, or `null` when insufficient returns exist or their standard deviation is zero.
 */
export function sharpeRatio(
  closes: number[],
  riskFreeAnnual: number = DEFAULT_RISK_FREE,
  tradingDaysPerYear: number = TRADING_DAYS_PER_YEAR
): number | null {
  if (closes.length < 2) return null;
  const r = dailyReturns(closes);
  if (r.length === 0) return null;
  const rfPerDay = riskFreeAnnual / tradingDaysPerYear;
  const m = mean(r) - rfPerDay;
  const variance = r.reduce((s, x) => s + x * x, 0) / r.length;
  const std = Math.sqrt(variance);
  if (std === 0) return null;
  return (m / std) * Math.sqrt(tradingDaysPerYear);
}

/**
 * Computes the annualized Sortino ratio for a closing-price series.
 *
 * @param closes - The closing prices used to calculate daily returns
 * @param riskFreeAnnual - The annual risk-free rate
 * @param tradingDaysPerYear - The number of trading days in a year
 * @returns The annualized Sortino ratio, or `null` when it cannot be calculated
 */
export function sortinoRatio(
  closes: number[],
  riskFreeAnnual: number = DEFAULT_RISK_FREE,
  tradingDaysPerYear: number = TRADING_DAYS_PER_YEAR
): number | null {
  if (closes.length < 2) return null;
  const r = dailyReturns(closes);
  if (r.length === 0) return null;
  const rfPerDay = riskFreeAnnual / tradingDaysPerYear;
  const m = mean(r) - rfPerDay;
  const downside = r.filter((x) => x < rfPerDay);
  if (downside.length === 0) return null;
  const ddVar = downside.reduce((s, x) => s + (x - rfPerDay) * (x - rfPerDay), 0) / downside.length;
  const dd = Math.sqrt(ddVar);
  if (dd === 0) return null;
  return (m / dd) * Math.sqrt(tradingDaysPerYear);
}

/**
 * Computes the price-only total return from the first and last closing prices.
 *
 * @param closes - The chronological closing-price series.
 * @returns The total return, or `null` when fewer than two prices are provided or the first price is not positive.
 */
export function totalReturn(closes: number[]): number | null {
  if (closes.length < 2) return null;
  const first = closes[0];
  const last = closes[closes.length - 1];
  if (first <= 0) return null;
  return last / first - 1;
}

/* ------------------------------------------------------------------ *
 * Trade-date helpers — used across CompanyProfile / Watchlists.     *
 * ------------------------------------------------------------------ *
 * Three concerns, three layers:
 *
 *  1. `parseTradeDate` — strict parser returning `number | null`. Format
 *     helpers use this so invalid input renders as `null`/"—"/"Recent"
 *     rather than a misleading epoch timestamp. Most callers should use it.
 *
 *  2. `parseTradeDateMs` / `parseTradeDateAsc` — sort-sink siblings that
 *     wrap `parseTradeDate` and fall back to a numeric sentinel (`0` or
 *     `Number.MAX_SAFE_INTEGER`) when input is invalid. `Array.sort`
 *     comparators stay NaN-free because `±Infinity ± ±Infinity === NaN`
 *     would otherwise corrupt V8's stable-sort contract.
 *
 *  3. `formatTradeDateShort` / `formatTradeDateLocale` — render helpers
 *     that emit locale-aware labels for in-row tables (insider trades,
 *     earnings events, news timestamps). Returns `null` on invalid input
 *     so callers can render their own placeholder.
 *
 * All four are explicitly named `TradeDate` (rather than just `Date`) to
 * reinforce that they're tuned for trade-date display contexts — see the
 * `PLAUSIBLE_DATE_MIN_MS` domain note below.
 *
 * Helpers are intentionally NOT applied inside `irrBisection` — the finance
 * math relies on `NaN` propagation to surface "no_convergence" cleanly
 * when a cashflow date is malformed. Silently sinking those rows to epoch
 * would mask the bug.
 */

/**
 * Lower-bound sanity threshold (UTC ms). V8's `Date.parse` is permissive:
 * inputs like "garbage", "0", or "1" land near 1970-01-01 instead of NaN.
 * We treat anything pre-1990 as implausible for an equity-domain product
 * (FMP / Yahoo surface nothing earlier). For non-equity reuse (municipal
 * bonds, etc.) bump this constant or extract it as a parameter.
 */
const PLAUSIBLE_DATE_MIN_MS = Date.UTC(1990, 0, 1);

/**
 * Converts a supported trade-date value to a UTC timestamp.
 *
 * @param value - A date string, Unix timestamp in seconds or milliseconds, or an empty value
 * @returns The UTC timestamp in milliseconds, or `null` for invalid or implausibly early dates
 */
function _strictToTimestamp(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    // Upstream can hand us unix-seconds (Yahoo) or unix-ms. Treat anything
    // < 1e12 as seconds; the cutoff is the rough threshold where the
    // unix-seconds representation of dates in the late 2001+ range crosses
    // 1e12 ms. Numbers larger than that are almost certainly already in ms.
    if (!Number.isFinite(value)) return null;
    const ms = value < 1e12 ? value * 1000 : value;
    return ms < PLAUSIBLE_DATE_MIN_MS ? null : ms;
  }
  // ISO "YYYY-MM-DD[ HH:MM:SS…]": take the first 10 chars and parse with
  // Date.UTC so the result is locale-independent.
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) {
    const y = +iso[1];
    const m = +iso[2];
    const d = +iso[3];
    // Date.UTC would silently roll "2024-13-32" into a valid adjacent date.
    // Reject up-front so bad upstream input doesn't masquerade as real data.
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990) return null;
    return Date.UTC(y, m - 1, d);
  }
  // Last resort: locale-formatted string. V8's Date.parse is permissive,
  // so we apply the same >= 1990 sanity bound to reject "garbage" / "0"
  // strings that V8 maps to ~1970-01-01.
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || ms < PLAUSIBLE_DATE_MIN_MS) return null;
  return ms;
}

/**
 * Converts a trade-date value to a UTC timestamp, using a fallback for invalid values.
 *
 * @param value - The trade-date value to convert
 * @param sink - The timestamp to return when conversion fails
 * @returns The converted UTC timestamp or `sink`
 */
function _toTimestamp(value: string | number | null | undefined, sink: number): number {
  return _strictToTimestamp(value) ?? sink;
}

/**
 * Parses a trade-date value for descending chronological sorting.
 *
 * @param value - The trade-date value to parse
 * @returns The UTC timestamp in milliseconds, or `0` for invalid values
 */
export function parseTradeDateMs(value: string | number | null | undefined): number {
  return _toTimestamp(value, 0);
}

/**
 * Converts a trade-date value to UTC milliseconds for ascending date sorting.
 *
 * @param value - The trade-date value to parse
 * @returns The UTC timestamp, or `Number.MAX_SAFE_INTEGER` for invalid values
 */
export function parseTradeDateAsc(value: string | number | null | undefined): number {
  return _toTimestamp(value, Number.MAX_SAFE_INTEGER);
}

/**
 * Strict trade-date parser returning `number | null`. Use this from format
 * helpers and from any caller that wants to distinguish "invalid" from
 * "valid epoch (ms = 0)". Sort code should use `parseTradeDateMs` or
 * `parseTradeDateAsc` instead so the comparator never sees NaN.
 */
export function parseTradeDate(value: string | number | null | undefined): number | null {
  return _strictToTimestamp(value);
}

/**
 * Formats a valid trade date as a locale-aware short month-and-day label.
 *
 * @param value - The trade date to format.
 * @returns The localized month-and-day label, or `null` for an invalid date.
 */
export function formatTradeDateShort(value: string | number | null | undefined): string | null {
  const ms = parseTradeDate(value);
  return ms === null ? null : new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Format as a full locale-aware label (e.g. "8/15/2024" in en-US). */
export function formatTradeDateLocale(value: string | number | null | undefined): string | null {
  const ms = parseTradeDate(value);
  return ms === null ? null : new Date(ms).toLocaleDateString();
}
