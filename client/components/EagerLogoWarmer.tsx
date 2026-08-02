import { useEffect, useMemo, useRef } from "react";

import { useWatchlistsContext } from "@/hooks/useWatchlists";
import { useI18n } from "@/lib/i18n";
import {
  getLogoDevUrl,
  getLogoDevNameUrl,
  getCachedTier,
  setCachedTier,
} from "@/lib/logoDev";

/**
 * Soft ceiling on the per-mount warm-up batch. Logo.dev's image CDN has
 * no documented rate limit, but browsers cap concurrent connections
 * per origin at ~6. A 24-symbol batch leaves a few slots for the rest
 * of the page's own network activity (TanStack Query calls, news fetch,
 * etc.) while still warming most of a typical row count.
 *
 * Symbols beyond this cap fall back to the on-demand probe path of
 * `TickerLogo`'s own 4-tier ladder — the cache still benefits them once
 * they finally render somewhere, just later.
 */
const MAX_WARMER_SYMBOLS = 24;

/**
 * Renders nothing. Mounted inside the Watchlists route to pre-resolve
 * Logo.dev tier assignments for every row so the brand art (or sector
 * glyph for HE users) is already painted by the time the user navigates
 * to /insights, /stock/<ticker>, or opens a slide-over.
 *
 * The 4-tier ladder in `TickerLogo.tsx` is what shows logos at first
 * paint. `EagerLogoWarmer` is what makes that show INSTANT (no
 * initials → image transition, no onError → name → onError → sector
 * dance) for the symbols the user actively keeps on a watchlist.
 *
 * Probing strategy per symbol:
 *   1. Skip if `sessionStorage.vantage.logoTier.<TICKER>` already cached.
 *   2. Probe `/ticker/<TICKER>` via `new Image()` — never decoed visually.
 *        - `onload` → write `{ tier: "ticker" }`.
 *        - `onerror` (404 from `fallback=404`) → advance.
 *   3. Read the company name from `entry.name` (already validated at
 *      AddWatchlistSheet creation time via /api/stock-overview). Probe
 *      `/name/<companyName>` similarly.
 *        - `onload` → write `{ tier: "name", companyName }`.
 *        - `onerror` → both CDN tiers missed.
 *   4. EN-locale users: settle on `{ tier: "initials" }` so the next
 *      visit reads the cache without re-probing.
 *      HE-locale users: write NO cache here. `TickerLogo` owns the
 *      sector-glyph tier-3 decision (it has access to `useStockProfile`
 *      which knows the sector) and will re-resolve on its own.
 *
 * Race / lifecycle:
 *   - All probes fire concurrently; the browser's connection pool and
 *     `Image()`'s `referrerPolicy="no-referrer"` keep things polite.
 *   - `inFlightRef` prevents re-probing the same symbol during fast
 *     navigation churn (a user rapidly adding and removing items
 *     shouldn't queue 50 probes for one ticker).
 *   - Probes for symbols the user removes from the watchlist mid-flight
 *     still complete; their positive result writes a useful cache
 *     entry — the watchlist removal isn't a signal that Logo.dev has
 *     forgotten the brand.
 *
 * @returns Always `null` — this component is purely a side-effect host.
 */
export default function EagerLogoWarmer() {
  const wl = useWatchlistsContext();
  const { lang } = useI18n();

  // Build a flat, de-duplicated, capped roster of candidates we want
  // warm. Active list first (the user's current focus), fall through to
  // the system list for symbols the active list doesn't already cover.
  const candidates = useMemo<
    Array<{ readonly symbol: string; readonly name: string | null }>
  >(() => {
    const out: Array<{ symbol: string; name: string | null }> = [];
    const seen = new Set<string>();

    const activeSym = wl.active?.symbols ?? [];
    for (const e of activeSym) {
      if (!e.symbol) continue;
      const upper = e.symbol.toUpperCase().trim();
      if (!upper || seen.has(upper)) continue;
      seen.add(upper);
      out.push({ symbol: upper, name: e.name?.trim() || null });
    }

    const sysSym = wl.systemList?.symbols ?? [];
    for (const e of sysSym) {
      if (!e.symbol) continue;
      const upper = e.symbol.toUpperCase().trim();
      if (!upper || seen.has(upper)) continue;
      seen.add(upper);
      out.push({ symbol: upper, name: e.name?.trim() || null });
    }

    return out.slice(0, MAX_WARMER_SYMBOLS);
    // `wl.active?.symbols` and `wl.systemList?.symbols` are reference-
    // stable when their contents are unchanged (the underlying singleton
    // store only mutates reference on actual mutations), so this memo
    // doesn't recompute every render. We DO want it to recompute when
    // the user adds or removes symbols, which it does correctly.
  }, [wl.active?.symbols, wl.systemList?.symbols]);

  // Dependency key for the warmup effect. We deliberately use a string
  // join instead of the array reference so the effect doesn't re-fire
  // when the candidate list is rebuilt to the SAME content (e.g. when
  // the store ticks non-symbol metadata).
  const candidateKey = useMemo(
    () => candidates.map((c) => `${c.symbol}|${c.name ?? ""}`).join(","),
    [candidates],
  );

  // Module-scope set so probes for the same symbol launched twice in
  // close succession are de-duped. Survives re-renders via the ref.
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (candidates.length === 0) return;

    const probeImage = (url: string | null): Promise<"ok" | "fail"> =>
      new Promise((resolve) => {
        if (!url) {
          resolve("fail");
          return;
        }
        const img = new Image();
        // Mirror `TickerLogo`'s `<img>` privacy choice so we don't leak
        // tickers as referrers if Logo.dev ever adds analytics.
        img.referrerPolicy = "no-referrer";
        img.onload = () => resolve("ok");
        img.onerror = () => resolve("fail");
        img.src = url;
      });

    const probeOne = async (entry: {
      readonly symbol: string;
      readonly name: string | null;
    }) => {
      const upper = entry.symbol;

      if (inFlightRef.current.has(upper)) return;
      inFlightRef.current.add(upper);
      try {
        // Skip if a previous mount already wrote a tier for this ticker.
        if (getCachedTier(upper)) return;

        // Tier 1: ticker-shaped probe.
        const tier1 = await probeImage(getLogoDevUrl(upper, "md"));
        if (tier1 === "ok") {
          setCachedTier(upper, { tier: "ticker" });
          return;
        }

        // Tier 1 failed → try the brand-name shape using the watchlist
        // entry's cached companyName (no extra round-trip to
        // /api/stock-overview). WatchlistSymbolEntry.name is populated
        // by AddWatchlistSheet's validation against /api/stock-overview,
        // so when it's present we trust it.
        if (entry.name) {
          const tier2 = await probeImage(getLogoDevNameUrl(entry.name, "md"));
          if (tier2 === "ok") {
            setCachedTier(upper, { tier: "name", companyName: entry.name });
            return;
          }
        }

        // Both CDN tiers missed (or no name available).
        // EN-locale: cache as 'initials'. The next visit reads this
        // directly and skips the probe chain.
        //
        // HE-locale: do NOT cache. `TickerLogo` will re-resolve on
        // mount via its own ladder, hitting Logo.dev again. This is
        // intentional — the sector-glyph tier-3 path lives in
        // `TickerLogo` (it has `useStockProfile` access) and we don't
        // want the cache to short-circuit it.
        if (lang !== "he") {
          setCachedTier(upper, { tier: "initials" });
        }
      } finally {
        inFlightRef.current.delete(upper);
      }
    };

    // Fire-and-forget; we don't block render on probes. The browser
    // connection pool naturally serializes this to ~6 active in flight.
    void Promise.allSettled(candidates.map((c) => probeOne(c)));
    // We CAN'T just depend on `candidates` because the array reference
    // can change without the candidates changing (parent re-renders,
    // etc.). `candidateKey` is the stable string.
  }, [candidateKey, lang, candidates]);

  return null;
}
