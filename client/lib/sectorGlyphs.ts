// Hebrew sector glyph map. Used by `TickerLogo`'s Tier-3 fallback after both
// Logo.dev CDN tiers (`/ticker/<X>` and `/name/<companyName>`) return 404.
// Tier-3 renders a single Hebrew letter tinted to the sector's color, so
// RTL readers get a culturally-appropriate avatar instead of the English
// 2-letter initials fallback.
//
// FMP stable API returns these sector strings; the keys here MUST match them
// verbatim (case-insensitive). Add a new key if a previously-unseen sector
// surfaces — never collapse to "other" automatically, as that hides tax
// classification that's load-bearing for portfolio analysis.

export interface SectorGlyph {
  /** Single Hebrew letter rendered inside the tile. */
  letter: string;
  /** Background + text Tailwind classes tinted to the sector. */
  color: string;
}

/**
 * Tinted sector palette. Pairs chosen for legibility on Vantage's slate-800
 * tile (`bg-slate-800` is the default surface; sector glyph replaces it).
 * Tints favor muted shades (e.g. /20 alpha, /40 text-color) so the letter
 * reads as the dominant element.
 */
export const HEBREW_SECTOR_GLYPHS: Record<string, SectorGlyph> = {
  // ── Mega-cap staples ────────────────────────────────────────────
  "Technology": { letter: "ט", color: "bg-blue-500/20 text-blue-300" },
  "Healthcare": { letter: "ב", color: "bg-emerald-500/20 text-emerald-300" },
  "Financial Services": { letter: "פ", color: "bg-amber-500/20 text-amber-300" },

  // ── Consumer ───────────────────────────────────────────────────
  "Consumer Cyclical": { letter: "צ", color: "bg-pink-500/20 text-pink-300" },
  "Consumer Defensive": { letter: "כ", color: "bg-rose-500/20 text-rose-300" },

  // ── Communication / media ──────────────────────────────────────
  "Communication Services": { letter: "ת", color: "bg-violet-500/20 text-violet-300" },

  // ── Heavy industry ─────────────────────────────────────────────
  "Energy": { letter: "א", color: "bg-orange-500/20 text-orange-300" },
  "Industrials": { letter: "ת", color: "bg-stone-500/20 text-stone-300" },
  "Materials": { letter: "ח", color: "bg-lime-500/20 text-lime-300" },

  // ── Real assets ────────────────────────────────────────────────
  "Real Estate": { letter: "נ", color: "bg-cyan-500/20 text-cyan-300" },
  "Utilities": { letter: "ש", color: "bg-yellow-500/20 text-yellow-300" },

  // ── ETFs (commonly surfaced through /stable/profile) ───────────
  // ETFs often return `sector: ""` (no tagged sector). When the universe
  // table shows an ETF, the TickerLogo falls through to initials tier
  // rather than matching against the curated map.
};

/**
 * Look up the Hebrew glyph for a given sector string. Case-insensitive.
 * Returns `null` for unknown / empty sectors — caller should fall back to
 * the English initials tier rather than substitute a meaningless letter.
 */
export function getSectorGlyph(sector: string | undefined | null): SectorGlyph | null {
  if (!sector) return null;
  const trimmed = sector.trim();
  if (!trimmed) return null;
  // FMP returns sector strings in Title Case ("Technology"), but be defensive
  // against occasional Pascal/lower variations.
  for (const [key, glyph] of Object.entries(HEBREW_SECTOR_GLYPHS)) {
    if (key.toLowerCase() === trimmed.toLowerCase()) return glyph;
  }
  return null;
}
