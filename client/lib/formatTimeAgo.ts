/**
 * client/lib/formatTimeAgo.ts
 *
 * Pure helper that converts a Unix-seconds timestamp into a localized
 * "X minutes ago" string via the active i18n dictionary.
 *
 * Bucket choices (CLDR-aligned but pragmatic for an equity newsfeed):
 *   - < 60s          → "just now"
 *   - < 60 minutes   → minutes (one / two / other)
 *   - < 24 hours     → hours   (one / two / other)
 *   - < 7 days       → days    (one / two / other)
 *   - < 4.5 weeks    → weeks   (one / two / other)
 *   - < 12 months    → months  (one / two / other)
 *   - ≥ 12 months    → years   (one / two / other)
 *
 * The function reaches into the dictionary directly so a single import can
 * be reused from any component, without requiring the React provider. The
 * dictionary read here is the SAME one `useI18n().t` reads (en / he), so the
 * plural suffix chosen matches whatever the active language expects.
 *
 * NOTE: This module intentionally does NOT depend on `useI18n()` — callers
 * pass `t` in explicitly so the helper is usable in:
 *   - row-level React components (just call `t = useI18n().t`)
 *   - utility functions (pass a closure that selects the right dict)
 *   - the I18nDebug page (renders both languages to compare)
 */

export type SecondsAgoInput = number | string | null | undefined;

export interface FormatTimeAgoOptions {
  /**
   * Override the "now" reference point. Defaults to `Date.now()`. The tests
   * pass a fixed value so they don't drift across runs.
   */
  now?: number;
}

/**
 * Computes the floor-difference in seconds between `value` and `now`, handling
 * all input shapes (number unix-seconds, number milliseconds, ISO string,
 * null/undefined). Returns `null` for invalid or implausible inputs.
 */
function toUnixSeconds(value: SecondsAgoInput, now: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  let ms: number;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    // Same threshold used in lib/finance.ts: < 1e12 → seconds, otherwise ms.
    ms = value < 1e12 ? value * 1000 : value;
  } else {
    // String. Accept ISO date-time only here.
    const t = Date.parse(value);
    if (!Number.isFinite(t)) return null;
    ms = t;
  }
  // Disallow implausible timestamps (< 1990 epoch) so a typo or empty string
  // doesn't render "X hours ago" for a date in the 1970s.
  if (!Number.isFinite(ms) || ms < Date.UTC(1990, 0, 1)) return null;
  // Future timestamps: clamp to 0 ("just now") rather than rendering "-3 hours".
  const diffSec = Math.floor((now - ms) / 1000);
  return diffSec < 0 ? 0 : diffSec;
}

/**
 * Bucket boundaries (in seconds). Kept as exported constants so the I18nDebug
 * page can label its preview chips and so the tests can verify any future
 * boundary tweaks in one place.
 */
export const TIME_AGO_BUCKETS = {
  /** Anything strictly less than this is "just now". */
  justNowMax: 60,
  /** Strictly less than this is "minutes ago". */
  hourMin: 60 * 60,
  /** Strictly less than this is "hours ago". */
  dayMin: 24 * 60 * 60,
  /** Strictly less than this is "days ago". */
  weekMin: 7 * 24 * 60 * 60,
  /** Strictly less than this is "weeks ago". */
  /** Approximate 4.5-week month boundary so a 35-day-old item is "5 weeks" rather than "1 month". */
  monthMin: Math.round(31.5 * 24 * 60 * 60),
  /** Strictly less than this is "months ago". */
  yearMin: 365 * 24 * 60 * 60,
} as const;

/**
 * Formats a timestamp as a localized time-ago label. The dictionary lookup
 * uses the suffix pattern documented in the ICU/i18n module, so the chosen
 * plural form respects the active language's grammar (e.g. Hebrew _two).
 *
 * @param value - Unix seconds, unix milliseconds, or ISO date string. Null/undefined → null.
 * @param t - The dictionary lookup function. Use `useI18n().t` in components; pass a custom closure in tests.
 * @param opts - Optional override for the "now" reference.
 * @returns The localized label, or `null` for invalid input.
 */
export function formatTimeAgo(
  value: SecondsAgoInput,
  t: (key: string, vars?: Record<string, string | number>) => string,
  opts: FormatTimeAgoOptions = {},
): string | null {
  const now = opts.now ?? Date.now();
  const diffSec = toUnixSeconds(value, now);
  if (diffSec === null) return null;

  if (diffSec < TIME_AGO_BUCKETS.justNowMax) return t("timeAgo.justNow");
  if (diffSec < TIME_AGO_BUCKETS.hourMin) {
    const m = Math.floor(diffSec / 60);
    return t("timeAgo.minutesAgo", { count: m });
  }
  if (diffSec < TIME_AGO_BUCKETS.dayMin) {
    const h = Math.floor(diffSec / (60 * 60));
    return t("timeAgo.hoursAgo", { count: h });
  }
  if (diffSec < TIME_AGO_BUCKETS.weekMin) {
    const d = Math.floor(diffSec / (24 * 60 * 60));
    return t("timeAgo.daysAgo", { count: d });
  }
  if (diffSec < TIME_AGO_BUCKETS.monthMin) {
    const w = Math.floor(diffSec / (7 * 24 * 60 * 60));
    return t("timeAgo.weeksAgo", { count: w });
  }
  if (diffSec < TIME_AGO_BUCKETS.yearMin) {
    const months = Math.floor(diffSec / (30 * 24 * 60 * 60));
    return t("timeAgo.monthsAgo", { count: months });
  }
  const years = Math.floor(diffSec / (365 * 24 * 60 * 60));
  return t("timeAgo.yearsAgo", { count: years });
}
