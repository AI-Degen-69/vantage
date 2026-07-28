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
