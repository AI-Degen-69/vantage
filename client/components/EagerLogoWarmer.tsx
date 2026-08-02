import { useEffect, useMemo, useRef } from "react";

import {
  getCachedTier,
  getLogoDevNameUrl,
  getLogoDevUrl,
  setCachedTier,
  type LogoDevSize,
} from "@/lib/logoDev";
import { useI18n } from "@/lib/i18n";

/**
 * Route-aware logo warmer. Each route already has a hook-backed
 * symbol-set it loaded for its own purposes (`useInsightsTab`'s entries,
 * `useWatchlists()`'s active list, `?ticker=` URL params, etc). The warmer
 * mounts once per page and passively consumes that set as a prop — no
 * route detection logic, no extra fetches.
 *
 * Strategy:
 *   1. Read `sessionStorage["vantage.logoTier.<TICKER>"]` for each symbol.
 *      Skip the entire probe chain if the entry is one of:
 *        `{tier:"ticker"} | {tier:"name",companyName} | {tier:"sector"} | {tier:"initials"}`.
 *   2. If `namesBySymbol[symbol]` is present, fire BOTH tier-1
 *      (`/ticker/<X>`) AND tier-2 (`/name/<companyName>`) in parallel
 *      via `new Image()` + onLoad/onError. The faster response wins;
 *      both results write to the same sessionStorage key.
 *   3. If no company name is known, fire only tier-1; `TickerLogo` will
 *      climb the onError chain reactively once it mounts.
 *
 * Render lifecycle:
 *   `useEffect` runs on every change to `(symbols, namesBySymbol)`.
 *   - Tab switch on `/insights` → new symbols → effect fires → probes for
 *     the new tab's tickers.
 *   - Active-list change on `/watchlists` → new symbols → effect fires.
 *   - URL change on `/charts?ticker=X` → symbols change → effect fires.
 *
 * Capacity:
 *   Default cap is 24 symbols so we leave headroom in the browser's
 *   per-origin connection pool even on HTTP/1.1. Logo.dev is HTTP/2
 *   multiplexed so concurrent requests don't queue, but PageSpeed Insights
 *   flags >50 concurrent image requests as a memory-pressure risk on
 *   mobile. Bump `cap` if a route needs more (e.g. a Trending tab with 40
 *   tickers); the browser still handles it gracefully.
 */

interface EagerLogoWarmerProps {
  /**
   * Symbols to warm. Order doesn't matter; the warmer dedupes.
   * When undefined/empty, no probes fire (the route hasn't loaded its
   * symbol set yet — e.g. the useInsightsTab query is still pending).
   */
  symbols: string[] | undefined;
  /**
   * Optional symbol→companyName map. When present, the warmer speculatively
   * fires BOTH `/ticker/<X>` AND `/name/<companyName>` so any path through
   * TickerLogo's onError chain finds its probe already resolved.
   *
   * Sources by route (kept here as a comment so future readers wire
   * correctly when adding new routes):
   *   /insights     → `tabData.entries`: InsightsTabResponse[].name
   *   /watchlists   → `active.symbols[].name` (validated at Add-sheet time)
   *   /charts       → not provided (single ticker; TickerLogo applies name
   *                    tier reactively after `useStockProfile` resolves)
   *   /stock/<X>    → not provided; the active ticker is the only consumer.
   */
  namesBySymbol?: Record<string, string>;
  cap?: number;
  /** Tile size for the CDN URL — must match the eventual <TickerLogo> size. */
  size?: LogoDevSize;
}

/**
 * Headless warmer — renders nothing. The component's only job is to
 * dispatch parallel `Image()` probes as a mount-time side effect.
 */
export default function EagerLogoWarmer({
  symbols,
  namesBySymbol,
  cap = 24,
  size = "md",
}: EagerLogoWarmerProps) {
  const { lang } = useI18n();

  // Deduped symbol list, capped, with cache already filtered out. Memoized
  // so the effect's deps don't churn between renders of the same dataset.
  const toWarm = useMemo(() => {
    if (!symbols || symbols.length === 0) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of symbols) {
      const sym = String(raw ?? "").trim().toUpperCase();
      if (!sym || seen.has(sym)) continue;
      seen.add(sym);
      // Skip if any cached tier is already recorded for this symbol —
      // re-probing on a cache-hit would burn CDN quota and over-write
      // proven tier assignments with potentially-flaky re-resolves.
      if (getCachedTier(sym)) continue;
      out.push(sym);
      if (out.length >= cap) break;
    }
    return out;
  }, [symbols, cap]);

  // In-flight ticker tracker: a Set of symbols already being probed in this
  // effect run, so we don't dispatch duplicate probes when a parent re-
  // renders with an identical symbol list but a fresh effect closure.
  const inFlightRef = useRef<Set<string> | null>(null);
  if (inFlightRef.current === null) {
    inFlightRef.current = new Set();
  }

  useEffect(() => {
    if (toWarm.length === 0) return;
    const inflight = inFlightRef.current;
    if (!inflight) return;

    for (const symbol of toWarm) {
      // Skip if a probe is already in-flight for this symbol from a
      // previous effect run (parent re-render case). The inflight Set
      // persists across renders.
      if (inflight.has(symbol)) continue;

      const tickerUrl = getLogoDevUrl(symbol, size);
      const companyName = namesBySymbol?.[symbol]?.trim() ?? "";
      const nameUrl = companyName ? getLogoDevNameUrl(companyName, size) : null;

      // Helper: bind onLoad/onError to an Image() that fires a CDN probe
      // without rendering anything visually. We mark in-flight before
      // construction to keep the loop reentrant-safe.
      const fireProbe = (
        url: string | null,
        onSuccess: () => void,
        onFail: () => void,
      ): void => {
        if (!url) {
          onFail();
          return;
        }
        const img = new Image();
        img.referrerPolicy = "no-referrer";
        img.onload = () => onSuccess();
        img.onerror = () => onFail();
        img.src = url;
      };

      // ── Tier-1: /ticker/<symbol> ──────────────────────────────
      // If `/ticker/<X>` resolves, cache `{tier:"ticker"}` and SKIP the
      // speculative tier-2 probe for this symbol — `/ticker` already
      // proved the brand. Speculatively firing tier-2 in parallel would
      // either be wasted work (tier-1 hit) OR risk a later-arriving
      // tier-2 success clobbering the working tier-1 cache entry on
      // re-mount (TickerLogo would then skip the proven fast path).
      fireProbe(
        tickerUrl,
        () => {
          inflight.add(symbol); // mark in-flight AFTER scheduling so races
          setCachedTier(symbol, { tier: "ticker" });
          inflight.delete(symbol);
        },
        // fail: try speculative tier-2 if name available
        () => {
          if (!nameUrl) {
            // No name to fall forward with — DON'T write the cache.
            // TickerLogo will fire tier-2 reactively once
            // useStockProfile resolves. Letting the warmer cache
            // "initials" pre-emptively would lock out the HE sector
            // glyph tier (for HE users).
            inflight.delete(symbol);
            return;
          }
          // ── Tier-2: /name/<companyName> ────────────────────────
          fireProbe(
            nameUrl,
            () => {
              setCachedTier(symbol, { tier: "name", companyName });
              inflight.delete(symbol);
            },
            () => {
              // Probe miss. Leave the cache untouched — same reason
              // as above. The eventual TickerLogo mount will resolve
              // the final tier (sector for HE, initials for EN) and
              // cache from inside its own onError chain.
              inflight.delete(symbol);
            },
          );
        },
      );
    }

    // No `lang` dep: locale toggle shouldn't re-fire the warmer. The
    // tier-resolve logic doesn't branch by lang; HE behavior lives
    // strictly inside TickerLogo's terminal-tier resolution. Including
    // `lang` here would re-probe already-cached symbols on every locale
    // switch, wasting CDN quota.
    //
    // Note: probes in flight when the component unmounts are NOT
    // cancelled — there's no clean Image()-abort API. They will still
    // land and `setCachedTier` is idempotent, so the result is harmless.
    // Cleanup of `inFlightRef` would orphan future probe results but
    // their cache writes are still valid, so dropping the cleanup is
    // the better trade-off.
  }, [toWarm, namesBySymbol, size]);

  // No JSX — purely a side-effect host.
  return null;
}
