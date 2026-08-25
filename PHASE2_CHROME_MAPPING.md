# Phase 2 — Chrome → Observatory Semantic Token Mapping

**Generated:** 2026-08-20
**Input:** grep of `(bg|text|border|ring|shadow|...)-(blue|green|red|amber|sky|zinc|stone|purple|gray)-[0-9]` in client/
**Predecessor:** SLATE_OBSERVATORY_MAPPING.md (Phase 1 — slate-* → tokens)
**Theme:** Observatory Light-Curve (`.dark` in `client/global.css`, DESIGN.md)

---

## Summary

| Color Family | Occurrences | Mapping Strategy |
|---|---|---|
| Blue (chrome/buttons/focus) | 38 | `bg-primary`, `focus:border-ring`, `focus:ring-ring` |
| Blue (emphasis/badges) | 28 | `text-chart-blue`, `bg-chart-blue/*` |
| Green (gain) | 13 | `text-chart-positive`, `bg-chart-positive/*` |
| Red (loss) | 39 | `text-chart-negative`, `bg-chart-negative/*` |
| Red (system/error) | 8 | `bg-destructive/*`, `text-destructive` (ProviderHealthIndicator, toast) |
| Amber (warnings/ratings) | 24 | `text-chart-amber`, `bg-chart-amber/*` |
| Purple (earnings timing) | 5 | `text-chart-purple`, `bg-chart-purple/*` |
| Sky (info strips) | 9 | `text-chart-blue`, `bg-chart-blue/*` (info), `bg-chart-cyan/*` (sector) |
| Zinc (sector badge) | 2 | `bg-chart-purple/*` |
| Stone (sector badge) | 2 | `bg-chart-orange/*` |
| Gray (NotFound page) | 3 | `bg-background`, `text-muted-foreground`, `text-primary` |
| **Total** | **~122** | |

---

## Observatory Theme Tokens (Reference)

From `client/global.css` `.dark` and `tailwind.config.ts`:

| Token | HSL Value | Role |
|---|---|---|
| `--primary` | `42 65% 70%` | Starlight Gold — sole accent, ≤15% of screen |
| `--primary-foreground` | `250 45% 4%` | Night Sky — text on gold |
| `--ring` | `42 65% 70%` | Starlight Gold — focus rings |
| `--destructive` | `350 75% 60%` | Form/system errors (distinct from loss) |
| `--destructive-foreground` | `0 0% 100%` | White text on destructive |
| `--chart-positive` | `155 55% 50%` | Aurora Green — gains |
| `--chart-negative` | `6 70% 58%` | Ember Red — losses |
| `--chart-blue` | `200 60% 60%` | Nebula Blue — multi-series |
| `--chart-cyan` | `190 65% 58%` | Cyan — multi-series |
| `--chart-purple` | `265 45% 62%` | Deep Space Violet — multi-series |
| `--chart-amber` | `38 92% 60%` | Warning Amber |
| `--chart-orange` | `32 85% 58%` | Orange — multi-series |
| `--chart-accent` | `42 65% 70%` | Starlight Gold (chart alias) |

> **Critical rules from DESIGN.md:**
> - **The Instrument, Not Alarm Rule:** `--chart-negative` (Ember Red) and `--chart-positive` (Aurora Green) are for gain/loss semantics only. Form/system errors use `--destructive`.
> - **The One Light Rule:** `--primary` (Starlight Gold) appears on ≤15% of any screen. Blue-400 emphasis text that is purely decorative/differentiating uses `--chart-blue` (Nebula Blue), not `--primary`.

---

## Mapping Table

### 1. Gain/Loss — Green → chart-positive, Red → chart-negative

| Chrome Class | → Observatory Token | Semantics |
|---|---|---|
| `text-green-400` | `text-chart-positive` | Gain readout (Portfolio, DCFWidget, DipFinder, EarningsCalendar, StockSlideOver, Watchlists, Charts, Index) |
| `text-green-400/50` | `text-chart-positive/50` | Gain axis label (DipFinder) |
| `text-red-400` | `text-chart-negative` | Loss readout (Portfolio, DCFWidget, DipFinder, EarningsCalendar, StockSlideOver, Watchlists, Charts, Index, AddWatchlistSheet) |
| `text-red-400/50` | `text-chart-negative/50` | Loss axis label (DipFinder) |
| `bg-green-500/20` + `text-green-400` | `bg-chart-positive/20` + `text-chart-positive` | Gain badge (Charts, Index) |
| `bg-red-500/20` + `text-red-400` | `bg-chart-negative/20` + `text-chart-negative` | Loss badge (Charts, Index) |
| `bg-green-500` | `bg-chart-positive` | Progress bar right half (DipFinder) |
| `bg-red-500` | `bg-chart-negative` | Progress bar left half (DipFinder) |
| `bg-red-500/15` + `text-red-300` + `border-red-500/30` | `bg-chart-negative/15` + `text-chart-negative` + `border-chart-negative/30` | Error status badge (AddWatchlistSheet) |
| `bg-red-500/10` + `text-red-300` + `border-red-500/30` | `bg-chart-negative/10` + `text-chart-negative` + `border-chart-negative/30` | Error message banner (AddWatchlistSheet) |
| `bg-red-400/20` + `text-red-400` | `bg-chart-negative/20` + `text-chart-negative` | Loss badge (StockSlideOver) |
| `bg-red-400` | `bg-chart-negative` | Dot indicator (Index.tsx) |
| `border-red-500/30` + `bg-red-500/5` + `text-red-500` | `border-chart-negative/30` + `bg-chart-negative/5` + `text-chart-negative` | Bearish signal strip (StockFundamentalsStrip) |

**Already partially migrated (StockSlideOver):** Some lines use `text-chart-green` already — keep those; only replace `text-red-400` → `text-chart-negative` and `bg-red-400/20` → `bg-chart-negative/20`.

### 2. Blue Chrome Buttons & Active States → primary

| Chrome Class | → Observatory Token | Context |
|---|---|---|
| `bg-blue-600` + `text-white` | `bg-primary` + `text-primary-foreground` | Toggle/button active (DCFWidget, Earnings.tsx, LanguageSwitcher, I18nDebug) |
| `bg-blue-600` + `hover:bg-blue-700` + `text-white` | `bg-primary` + `hover:bg-primary/90` + `text-primary-foreground` | Primary CTA buttons (Portfolio, EarningsAlertStrip) |
| `group-hover:bg-blue-600` + `group-hover:text-white` | `group-hover:bg-primary` + `group-hover:text-primary-foreground` | TickerLogo hover (2 occurrences) |
| `border-blue-500` + `ring-2` + `ring-blue-500/40` + `shadow-lg` + `shadow-blue-500/20` | `border-ring` + `ring-2` + `ring-ring/40` + `shadow-lg` + `shadow-ring/20` | Selected earnings day (EarningsCalendar) |
| `bg-blue-600` + `text-white` + `border-blue-500` | `bg-primary` + `text-primary-foreground` + `border-primary/50` | I18nDebug active tab |

### 3. Focus Rings → ring tokens

| Chrome Class | → Observatory Token | Context |
|---|---|---|
| `focus:border-blue-500` | `focus:border-ring` | Input/select focus (DCFWidget ×5, DipFinder, Portfolio ×3, Earnings.tsx, AddWatchlistSheet) |
| `focus:ring-blue-500` | `focus:ring-ring` | Checkbox/radio focus (Portfolio, Earnings.tsx) |

### 4. Blue Badges & Chips → chart-blue

| Chrome Class | → Observatory Token | Context |
|---|---|---|
| `bg-blue-500/15` + `text-blue-400` + `border-blue-500/30` | `bg-chart-blue/15` + `text-chart-blue` + `border-chart-blue/30` | Badge/chip (AddWatchlistSheet, ChartModal ×2, RevenueSegmentsCard ×2) |
| `bg-blue-500/10` + `text-blue-400` + `border-blue-500/20` | `bg-chart-blue/10` + `text-chart-blue` + `border-chart-blue/20` | Chart badge (Index.tsx) |
| `bg-blue-500/10` + `text-blue-400` + `border-blue-500/30` | `bg-chart-blue/10` + `text-chart-blue` + `border-chart-blue/30` | "View Full Analysis" button (StockSlideOver) — ⚠️ EDGE: this is a CTA, but the badge styling is clearly a chip, not a primary button. `bg-chart-blue/*` preserves the blue. |
| `bg-blue-500/15` + `text-blue-300` + `border-blue-500/40` | `bg-chart-blue/15` + `text-chart-blue` + `border-chart-blue/40` | Watchlist active tab (Watchlists) |
| `bg-blue-500` | `bg-chart-blue` | Badge counter (EarningsAlertHistoryPanel), slider dot (Charts.tsx) |
| `bg-blue-500` + `ring-2` + `ring-blue-500/30` | `bg-chart-blue` + `ring-2` + `ring-chart-blue/30` | Range slider handle (Charts.tsx) |
| `bg-blue-400` | `bg-chart-blue` | Blue dot indicator (Index.tsx) |

### 5. Blue Emphasis Text → chart-blue or primary

| Chrome Class | → Observatory Token | Rationale |
|---|---|---|
| `text-blue-400` (data readouts: beta, correlation, sharpe, treynor, DCF forwardReturn) | `text-chart-blue` | Colored for differentiation, not accent. ⚠️ `text-primary` would be Starlight Gold — violates One Light Rule for these locations. |
| `text-blue-400` (StockSlideOver Loader2 spinner) | `text-chart-blue` | Loading indicator — not accent. |
| `text-blue-400` (Index.tsx, Watchlists.tsx emphasis text) | `text-chart-blue` | Data emphasis. |
| `text-blue-300` (I18nDebug, AddWatchlistSheet, Watchlists) | `text-chart-blue` | Lighter blue emphasis. |
| `text-blue-400` (StockSlideOver "View Full Analysis" link) | `text-primary` | This is a CTA / action link — Starlight Gold is appropriate. |
| `hover:bg-blue-500/20` (StockSlideOver "View Full Analysis") | `hover:bg-primary/20` | Hover state on CTA. |
| `hover:text-blue-400` (Watchlists, Portfolio links) | `hover:text-primary` | Interactive hover — Starlight Gold. |
| `group-hover:text-blue-400` (DipFinder, Watchlists) | `group-hover:text-primary` | Interactive hover. |
| `bg-blue-900/20` (I18nDebug) | `bg-chart-blue/10` | Active row highlight. |
| `bg-blue-500/10` (Watchlists drag hover) | `bg-chart-blue/10` | Drag hover highlight. |
| `hover:text-red-400` (Watchlists) | `hover:text-chart-negative` | Delete hover — loss semantics. |
| `hover:text-red-300` (Watchlists) | `hover:text-chart-negative` | Delete hover. |

### 6. Amber → chart-amber

| Chrome Class | → Observatory Token | Context |
|---|---|---|
| `text-amber-300` + `bg-amber-500/10` + `border-amber-500/30` | `text-chart-amber` + `bg-chart-amber/10` + `border-chart-amber/30` | Warning/info banner (AddWatchlistSheet, I18nDebug) |
| `bg-amber-500/15` + `text-amber-300` | `bg-chart-amber/15` + `text-chart-amber` | Rating badge (AddWatchlistSheet, EarningsAlertHistoryPanel, EarningsAlertStrip) |
| `bg-amber-500/20` + `text-amber-400` | `bg-chart-amber/20` + `text-chart-amber` | Earnings timing badge (EarningsAlertStrip, EarningsCalendar) |
| `bg-amber-500` | `bg-chart-amber` | DipFinder range marker |
| `bg-amber-400` | `bg-chart-amber` | ProviderHealthIndicator warning dot, Index.tsx dot |
| `text-amber-400` | `text-chart-amber` | Portfolio readouts, Index.tsx, Screener.tsx |
| `text-amber-300` + `bg-amber-500/10` | `text-chart-amber` + `bg-chart-amber/10` | Portfolio badge |

### 7. Purple → chart-purple

| Chrome Class | → Observatory Token | Context |
|---|---|---|
| `bg-purple-500/20` + `text-purple-400` | `bg-chart-purple/20` + `text-chart-purple` | "After Close" earnings timing (EarningsAlertStrip, EarningsCalendar) |
| `bg-purple-500/15` + `text-purple-300` | `bg-chart-purple/15` + `text-chart-purple` | Earnings item badge (EarningsAlertStrip) |

### 8. Sky → chart-blue / chart-cyan

| Chrome Class | → Observatory Token | Context |
|---|---|---|
| `text-sky-300` + `bg-sky-500/10` + `border-sky-500/20` | `text-chart-blue` + `bg-chart-blue/10` + `border-chart-blue/20` | BatchQuote fallback hint |
| `bg-sky-950/50` + `border-sky-700/60` + `text-sky-200` | `bg-chart-blue/15` + `border-chart-blue/30` + `text-chart-blue` | ProviderHealthIndicator `known_restriction` banner |
| `bg-sky-400` | `bg-chart-blue` | ProviderHealthIndicator info dot |
| `hover:text-sky-100` | `hover:text-chart-blue` | ProviderHealthIndicator link hover |
| `bg-sky-600/30` + `text-sky-200` | `bg-chart-cyan/30` + `text-chart-cyan` | Utilities sector badge (sectorGlyphs.ts) — ⚠️ `--chart-cyan` is the closest Observatory token for sky hues. |

### 9. Zinc / Stone → chart-* palette

| Chrome Class | → Observatory Token | Context |
|---|---|---|
| `bg-zinc-600/30` + `text-zinc-200` | `bg-chart-purple/30` + `text-chart-purple` | Industrials sector badge (sectorGlyphs.ts) |
| `bg-stone-600/30` + `text-stone-200` | `bg-chart-orange/30` + `text-chart-orange` | Real Estate sector badge (sectorGlyphs.ts) |

### 10. ProviderHealthIndicator — System Error/Warning → destructive

Per **The Instrument, Not Alarm Rule**: these are system health indicators, not gain/loss. Use `--destructive` for error, `--chart-amber` for warning, `--chart-blue` for info.

| Chrome Class | → Observatory Token | Context |
|---|---|---|
| `bg-red-950/60` + `border-red-700/60` + `text-red-200` | `bg-destructive/15` + `border-destructive/30` + `text-destructive/80` | Error banner |
| `bg-red-500` | `bg-destructive` | Error dot |
| `bg-amber-950/50` + `border-amber-700/60` + `text-amber-200` | `bg-chart-amber/15` + `border-chart-amber/30` + `text-chart-amber` | Warning banner |
| `bg-amber-400` | `bg-chart-amber` | Warning dot |

### 11. Toast → destructive

| Chrome Class | → Observatory Token | Context |
|---|---|---|
| `group-[.destructive]:text-red-300` | `group-[.destructive]:text-destructive-foreground/80` | Toast close button |
| `group-[.destructive]:hover:text-red-50` | `group-[.destructive]:hover:text-destructive-foreground` | Toast close hover |
| `group-[.destructive]:focus:ring-red-400` | `group-[.destructive]:focus:ring-destructive` | Toast close focus ring |
| `group-[.destructive]:focus:ring-offset-red-600` | `group-[.destructive]:focus:ring-offset-destructive` | Toast close focus offset |

### 12. NotFound → semantic tokens

| Chrome Class | → Observatory Token | Context |
|---|---|---|
| `bg-gray-100` | `bg-background` | Page background (light-mode default, but app is dark-only; this page is the shadcn default) |
| `text-gray-600` | `text-muted-foreground` | Description |
| `text-blue-500` + `hover:text-blue-700` | `text-primary` + `hover:text-primary/80` | Back link |

### 13. sectorGlyphs.ts → chart-* palette

| Chrome Class | → Observatory Token | Sector |
|---|---|---|
| `bg-blue-600/30` + `text-blue-200` | `bg-chart-blue/30` + `text-chart-blue` | Technology |
| `bg-amber-600/30` + `text-amber-200` | `bg-chart-amber/30` + `text-chart-amber` | Consumer Cyclical |
| `bg-zinc-600/30` + `text-zinc-200` | `bg-chart-purple/30` + `text-chart-purple` | Industrials |
| `bg-stone-600/30` + `text-stone-200` | `bg-chart-orange/30` + `text-chart-orange` | Real Estate |
| `bg-sky-600/30` + `text-sky-200` | `bg-chart-cyan/30` + `text-chart-cyan` | Utilities |

### 14. utils.spec.ts — test values

| Chrome Class | → Observatory Token | Context |
|---|---|---|
| `text-red-500` | `text-chart-negative` | Test input for `cn()` — tests class merging, not color semantics |
| `bg-blue-500` | `bg-chart-blue` | Test input for `cn()` |

---

## Edge Cases & Resolutions

### ⚠️ EDGE-01: `text-blue-400` → `text-primary` vs `text-chart-blue`
**Context:** 18 occurrences of `text-blue-400` across 10 files.
**Issue:** `text-primary` is Starlight Gold (warm gold), not blue. Using it everywhere would violate The One Light Rule (≤15% of screen).
**Resolution:** Use `text-chart-blue` (Nebula Blue) for data readouts and decorative emphasis. Use `text-primary` only for interactive elements (links, CTAs, hovers). See mapping table §5 for per-occurrence decisions.

### ⚠️ EDGE-02: StockSlideOver "View Full Analysis" button — `bg-blue-500/10`
**Context:** `StockSlideOver.tsx:267` — styled as a chip/badge but functionally a CTA.
**Resolution:** Keep `bg-chart-blue/10` for the chip styling (it's visually a blue badge, not a gold button). The `text-blue-400` → `text-primary` on this element makes it a gold-text CTA on a blue chip background — acceptable.

### ⚠️ EDGE-03: ProviderHealthIndicator — `--destructive` for error states
**Context:** `bg-red-950/60` is a very dark red background. `--destructive` is `350 75% 60%` — a pinkish red. Using `bg-destructive/15` will produce a lighter, pinker tint.
**Resolution:** This is intentional per The Instrument, Not Alarm Rule. The error banner should read as a system error, not a stock loss. The pinker tint is the correct semantic shift.

### ⚠️ EDGE-04: sectorGlyphs — 5 distinct hues
**Context:** The sector badge system requires 5 distinct colors. Observatory has 9 chart-* tokens.
**Resolution:** Map to the closest chart-* hue: blue→blue, amber→amber, sky→cyan, zinc→purple, stone→orange. This is the one place that legitimately needs multiple hues.

### ⚠️ EDGE-05: DipFinder progress bar — `bg-red-500` + `bg-green-500`
**Context:** These are functional progress bar fills, similar to the `bg-slate-500` keeps from Phase 1.
**Resolution:** Map to `bg-chart-negative` and `bg-chart-positive`. Unlike the slate-500 progress bar (which had no token), these have clear semantic matches.

---

## Per-File Occurrence Count

| File | Occurrences |
|---|---|
| `components/Portfolio.tsx` | 18 |
| `components/StockSlideOver.tsx` | 11 |
| `components/DCFWidget.tsx` | 9 |
| `components/AddWatchlistSheet.tsx` | 13 |
| `components/DipFinder.tsx` | 9 |
| `components/ProviderHealthIndicator.tsx` | 10 |
| `components/EarningsAlertStrip.tsx` | 8 |
| `components/EarningsCalendar.tsx` | 6 |
| `components/ChartModal.tsx` | 4 |
| `components/RevenueSegmentsCard.tsx` | 4 |
| `components/TickerLogo.tsx` | 2 |
| `components/EarningsAlertHistoryPanel.tsx` | 2 |
| `components/BatchQuoteFallbackHint.tsx` | 1 |
| `components/LanguageSwitcher.tsx` | 1 |
| `components/StockFundamentalsStrip.tsx` | 1 |
| `components/ui/toast.tsx` | 1 |
| `lib/sectorGlyphs.ts` | 5 |
| `lib/utils.spec.ts` | 1 |
| `pages/Index.tsx` | 8 |
| `pages/Charts.tsx` | 5 |
| `pages/Earnings.tsx` | 2 |
| `pages/I18nDebug.tsx` | 5 |
| `pages/Watchlists.tsx` | 8 |
| `pages/NotFound.tsx` | 2 |
| `pages/Screener.tsx` | 1 |

---

## Intentional Keeps (unchanged)

| Chrome Class | Location | Reason |
|---|---|---|
| `bg-slate-500` | DipFinder.tsx:152, ProviderHealthIndicator.tsx:44 | Phase 1 keeps — pending `--progress` token (VERIFICATION_REPORT.md §5.2) |

---

## Acceptance Checklist

- [ ] Every blue/green/red/amber/sky/zinc/stone/purple/gray occurrence has a proposed replacement
- [ ] Edge cases flagged with rationale
- [ ] No intentional keeps beyond the 2 documented `bg-slate-500` holds
- [ ] After replacement: grep returns zero chrome classes in client/
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build:client` passes
- [ ] Changes staged, not committed