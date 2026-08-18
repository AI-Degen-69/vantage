/**
 * client/lib/format.ts
 *
 * Pure, side-effect-free display formatters. Kept separate from the React
 * components that consume them so they stay deterministic and unit-testable.
 */

/** Coerce a value to a finite number, or null when it isn't finite. */
export function finite(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compact money formatter. Returns null for non-finite input so callers can
 * render an "unavailable" state. Negative values keep the minus sign before
 * the currency symbol (-$4.80B, not $-4.80B).
 */
export function formatMoney(value: unknown, digits = 2): string | null {
  const n = finite(value);
  if (n === null) return null;
  const abs = Math.abs(n);
  const suffix = abs >= 1e12 ? "T" : abs >= 1e9 ? "B" : abs >= 1e6 ? "M" : "";
  const divisor = abs >= 1e12 ? 1e12 : abs >= 1e9 ? 1e9 : abs >= 1e6 ? 1e6 : 1;
  const sign = n < 0 ? "-" : "";
  return `${sign}$${(abs / divisor).toFixed(suffix ? digits : 2)}${suffix}`;
}
