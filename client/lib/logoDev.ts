// Logo.dev integration. The publishable key (`pk_…`) is SAFE to ship client-
// side per Logo.dev's docs — it's literally what the key prefix means.
//
// We hit Logo.dev's CDN directly from the browser instead of proxying
// through the Vercel `/api/company-logo` route. Reasons:
//   - One fewer env var to misconfigure at deploy time.
//   - Vercel's edge cache was masking 404s as black monograms.
//   - Direct CDN -> browser is faster than CDN -> Vercel cold start -> image byte stream.
//
// Reference: https://www.logo.dev/docs/logo-images/introduction

const PUBLISHABLE_KEY = "pk_d2iRMqLAQCWhvkLPXuyShQ";

const ATTRIBUTION_URL = "https://www.logo.dev/";

/** Pixel sizes matching `TickerLogo.tsx`'s sm/mg/lg CSS boxes. Combined with
 *  `retina=true` on the CDN this gives 2× device-pixel coverage natively
 *  without forcing the browser to downsample an over-sized asset. */
const SIZE_MAP = {
  sm: 32,
  md: 48,
  lg: 64,
} as const;

export type LogoDevSize = keyof typeof SIZE_MAP;

/** Shared query-param block for both ticker- and name-tier calls. */
const COMMON_PARAMS = {
  token: PUBLISHABLE_KEY,
  format: "png",
  // Vantage is always dark-themed UI; force `theme=dark` so the logos we
  // receive are designed for dark backgrounds regardless of the user's
  // OS `prefers-color-scheme`. Without this, a user with OS light-mode +
  // Vantage's dark slate tile would get light-bg logos that bleed visibly.
  theme: "dark",
  retina: "true",
  fallback: "404", // Plain 404 on missing entries so the client's <img onError> advances
} as const;

/**
 * Build a Logo.dev CDN URL for a given ticker.
 *
 * @param ticker - Stock ticker (e.g. `AAPL`, `AIR.PA`). Empty/whitespace returns `null`.
 * @param size - Tile size to render (`sm` | `md` | `lg`); scaled to retina by Logo.dev.
 * @returns A fully-qualified URL string, or `null` when the ticker is empty.
 */
export function getLogoDevUrl(ticker: string, size: LogoDevSize = "md"): string | null {
  const trimmed = String(ticker ?? "").trim().toUpperCase();
  if (!trimmed) return null;
  const sizePx = SIZE_MAP[size] ?? SIZE_MAP.md;
  const params = new URLSearchParams({ ...COMMON_PARAMS, size: String(sizePx) });
  return `https://img.logo.dev/ticker/${encodeURIComponent(trimmed)}?${params.toString()}`;
}

/**
 * Build a Logo.dev CDN URL keyed by company name (brand-shaped substitution).
 * Useful when Logo.dev doesn't have a ticker entry but DOES know the brand
 * (e.g. recent IPOs, delisted tickers, regional tickers like `AAPL.MX`).
 *
 * Probe-verified brand hits:
 *   - "/name/Apple"                 → 200 image/png
 *   - "/name/Microsoft"             → 200 image/png
 *   - "/name/Nvidia"                → 200 image/png
 *   - "/name/Lockheed%20Martin"     → 200 image/png
 *   - "/name/3M"                    → 200 image/png
 *   - "/name/ZZZ_No_Such_Company"   → 404 application/json (onError → initials)
 *
 * @param companyName - The company name as returned by upstream APIs.
 *   Empty/whitespace returns `null` so callers can skip the `<img>` entirely.
 * @param size - Tile size; matches `getLogoDevUrl`'s scale.
 * @returns A fully-qualified URL string, or `null` when the input is empty.
 */
export function getLogoDevNameUrl(companyName: string, size: LogoDevSize = "md"): string | null {
  const trimmed = String(companyName ?? "").trim();
  if (!trimmed) return null;
  const sizePx = SIZE_MAP[size] ?? SIZE_MAP.md;
  const params = new URLSearchParams({ ...COMMON_PARAMS, size: String(sizePx) });
  return `https://img.logo.dev/name/${encodeURIComponent(trimmed)}?${params.toString()}`;
}

/** The Logo.dev homepage — used for the free-tier attribution link. */
export function getLogoDevAttributionUrl(): string {
  return ATTRIBUTION_URL;
}

// ───────────────────────────────────────────────────────────────────────────
// Session-storage tier cache. `TickerLogo` consults this on mount to skip
// probes we've already resolved for the lifetime of the tab. The cache is
// scoped to the tab (sessionStorage, not localStorage) so a closed tab
// re-resolves against fresh CDN state on next open.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Resolved tier for a given ticker — what we cache so we don't reprobe.
 * - `"ticker"` succeeded at `/ticker/<TICKER>`. Skip name/sector probes.
 * - `"name"`   succeeded at `/name/<companyName>`. We store companyName so
 *   re-mounts can rebuild the URL with the same input.
 * - `"sector"` (HE only) — no CDN image, render the Hebrew glyph forever.
 * - `"initials"` — no CDN ever served us anything, fall through to text.
 */
export type CachedTier =
  | { readonly tier: "ticker" }
  | { readonly tier: "name"; readonly companyName: string }
  | { readonly tier: "sector" }
  | { readonly tier: "initials" };

const CACHE_PREFIX = "vantage.logoTier.";

function cacheKey(ticker: string): string {
  return `${CACHE_PREFIX}${ticker.toUpperCase()}`;
}

/** Read the cached tier for `ticker`. Returns `null` when there's no entry,
 *  the entry is malformed, or `sessionStorage` is unavailable (private mode
 *  on some browsers silently throws). All read errors fall through — never
 *  a blocker for the UI. */
export function getCachedTier(ticker: string): CachedTier | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(cacheKey(ticker));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    switch (parsed.tier) {
      case "ticker":
        return { tier: "ticker" };
      case "name":
        return typeof parsed.companyName === "string"
          ? { tier: "name", companyName: parsed.companyName }
          : null;
      case "sector":
        return { tier: "sector" };
      case "initials":
        return { tier: "initials" };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/** Persist the resolved tier for `ticker`. Idempotent and silent on failure
 *  (private-mode browsers, quota-exceeded — both treated as "no cache"). */
export function setCachedTier(ticker: string, value: CachedTier): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(cacheKey(ticker), JSON.stringify(value));
  } catch {
    /* swallow — caching is a perf hint, not correctness */
  }
}

