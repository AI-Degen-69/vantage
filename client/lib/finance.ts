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
 * Internal Rate of Return via bisection.
 * Returns null signal plus a reason so the UI can render an honest `[MOCK]`
 * when the bracket is malformed (e.g. the cashflows are all-positive).
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

/** Compound Annual Growth Rate. (end / start)^(1/years) - 1. */
export function cagr(startValue: number, endValue: number, years: number): number | null {
  if (startValue <= 0 || years <= 0 || !Number.isFinite(startValue) || !Number.isFinite(endValue)) return null;
  const ratio = endValue / startValue;
  if (ratio <= 0) return null;
  return Math.pow(ratio, 1 / years) - 1;
}

function dailyReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const cur = closes[i];
    if (prev > 0 && cur > 0) out.push(cur / prev - 1);
  }
  return out;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** Annualized volatility of daily returns (stdev × √tradingDays). */
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

/** Sharpe ratio using the per-day risk-free approximation. */
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

/** Sortino ratio (downside-deviation denominator only). */
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
 * Compute total return over a price-only series (no cashflows needed) for
 * fast UI badges. Equivalent to (final - first) / first.
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

function _toTimestamp(value: string | number | null | undefined, sink: number): number {
  return _strictToTimestamp(value) ?? sink;
}

/**
 * Sort-friendly trade-date parser for DESCENDING (latest first). Unparseable
 * inputs sink to `0` so they appear at the bottom of any recent-first list
 * and the comparator `b - a` never yields NaN.
 */
export function parseTradeDateMs(value: string | number | null | undefined): number {
  return _toTimestamp(value, 0);
}

/**
 * Sort-friendly trade-date parser for ASCENDING (oldest first). Unparseable
 * inputs sink to `Number.MAX_SAFE_INTEGER` so they appear at the bottom
 * of an oldest-first list and the comparator `a - b` stays stable.
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
 * Format as a short locale-aware label ("Aug 15" in en-US, "15 באוג׳" in he-IL).
 * Ideal for in-row tables (insider trades, earnings events) where the year
 * is redundant. Returns null on invalid input so callers render their own
 * placeholder ("Recent", "—", etc.).
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
