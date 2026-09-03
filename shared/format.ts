/**
 * shared/format.ts
 *
 * Canonical number formatters shared by the Express server, the Vercel
 * router, and the client SPA. Consolidates the drifted formatLargeNumber
 * copies that used to live in server/services/stockAggregator.ts and
 * client/components/StockSlideOver.tsx (dead code there).
 *
 * Sign convention matches client/lib/format.ts: the minus sign goes before
 * the currency symbol (-$4.80M, never $-4.80M).
 */

export interface FormatLargeNumberOptions {
  /** Omit the leading "$" for count-style values like average volume. */
  omit$?: boolean;
}

/**
 * Compact large-number formatter with K/M/B/T tiers and two decimals.
 * Null/undefined/non-finite input renders an em-dash so callers can show
 * an "unavailable" state instead of leaking NaN or $0 for missing data.
 *
 * Tier boundaries intentionally match the legacy copies this replaces:
 * values below 1e6 land in the K tier even when rounding pushes the
 * rendered magnitude to 1000.00K (no tier promotion), and values below
 * 1,000 render via locale formatting with at most 2 fraction digits
 * ("500", "999.9") — matching the former stockAggregator copy.
 */
export function formatLargeNumber(
  num: number | null | undefined,
  opts: FormatLargeNumberOptions = {},
): string {
  const { omit$ = false } = opts;
  if (num == null || !Number.isFinite(num)) return "—";
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  const prefix = omit$ ? "" : "$";
  if (abs === 0) return `${prefix}0`;
  if (abs >= 1e12) return `${sign}${prefix}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${prefix}${(abs / 1e3).toFixed(2)}K`;
  // Legacy parity: sub-1,000 values render like toLocaleString with at
  // most 2 fraction digits (no forced trailing zeros). Values here are
  // below 1,000 so no locale grouping applies and runtimes agree.
  return `${sign}${prefix}${abs.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}
