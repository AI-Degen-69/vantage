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

/**
 * Compact money formatter with a K tier and locale-grouped small values —
 * the canonical implementation for market caps, insider trade values, and
 * similar always-positive magnitudes. Consolidates the drifted copies that
 * used to live in `Insights.tsx` (T2/B1/M1, no negatives) and
 * `CompanyProfile.tsx` (B2/M2/K1, no `$`, no non-finite guard).
 *
 * Returns null for non-finite input so callers can render em-dashes.
 */
export function formatMoneyCompact(
  value: unknown,
  decimals = 2,
): string | null {
  // Explicit null/undefined mean "no data" — Number(null) is 0, so the
  // generic coercion below would silently render "$0".
  if (value === null || value === undefined) return null;
  const n = finite(value);
  if (n === null) return null;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs < 1e3) return `${sign}$${Math.round(abs).toLocaleString()}`;
  const tier =
    abs >= 1e12
      ? ([1e12, "T"] as const)
      : abs >= 1e9
        ? ([1e9, "B"] as const)
        : abs >= 1e6
          ? ([1e6, "M"] as const)
          : ([1e3, "K"] as const);
  return `${sign}$${(abs / tier[0]).toFixed(decimals)}${tier[1]}`;
}
