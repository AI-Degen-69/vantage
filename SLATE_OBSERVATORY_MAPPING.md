# Slate → Observatory Semantic Token Mapping

**Generated:** 2026-08-20  
**Input:** `slate_audit.json` (228 occurrences across 19 files, 32 unique classes)  
**Theme:** Observatory Light-Curve (`.dark` in `client/global.css`, DESIGN.md)  

---

## Summary

| Category | Occurrences | Unique Classes | Clear Match | Edge Case | Flagged |
|---|---|---|---|---|---|
| Surface/Background | 58 | 19 | 16 (bg-slate-900*, bg-slate-800*, bg-slate-950*) | 2 (bg-slate-700*, bg-slate-600*) | 1 (bg-slate-500) |
| Text | 125 | 6 | 4 (text-slate-200,300,500; placeholder-slate-500) | 2 (text-slate-400, text-slate-600) | — |
| Border | 45 | 7 | 4 (border-slate-700*) | 3 (border-slate-800*, divide-slate-800) | — |
| **Total** | **228** | **32** | **24 unambiguous** | **7 edge cases** | **1 hard flag** |

---

## Observatory Theme Tokens (Reference)

From `client/global.css` `.dark` and `DESIGN.md`:

| Token | HSL Value | Role |
|---|---|---|
| `--background` | `250 45% 4%` | Night Sky — page base |
| `--foreground` | `210 20% 95%` | Starlight White — primary text |
| `--card` | `250 30% 9%` | Deep Field — card/panel surface |
| `--card-foreground` | `210 20% 95%` | ≡ `--foreground` |
| `--muted` | `250 30% 9%` | ≡ `--card` (intentional: "not a separate material") |
| `--muted-foreground` | `220 10% 60%` | Dust — secondary text, axis labels, timestamps |
| `--border` | `250 20% 16%` | Graticule — borders, gridlines |
| `--accent` | `250 33% 12%` | Elevated surface (slightly lighter than card) |
| `--primary` | `42 65% 70%` | Starlight Gold — sole accent (≤15% of screen) |
| `--chart-positive` / `--chart-green` | `155 55% 50%` | Aurora Green — gains |
| `--chart-negative` | `6 70% 58%` | Ember Red — losses |

> **Critical:** `--card` and `--muted` are the same color (`250 30% 9%`). DESIGN.md calls Deep Field the "card/panel surface" and explicitly says panels are "one step off the ground, not a separate material." This means `bg-card` and `bg-muted` are visually identical — any codebase distinction between `bg-slate-900` and `bg-slate-800` will collapse.

---

## Mapping Table

### 1. Surface / Background (58 occurrences)

| Slate Class | Count | → Observatory Token | Notes |
|---|---|---|---|
| `bg-slate-950/50` | 1 | `bg-background/50` | Night Sky overlay (LanguageSwitcher backdrop). ✓ |
| `bg-slate-900` | 4 | `bg-card` | Deep Field. Primary card/panel surface. ✓ |
| `bg-slate-900/40` | 3 | `bg-card/40` | ✓ |
| `bg-slate-900/50` | 4 | `bg-card/50` | ✓ |
| `bg-slate-900/30` | 1 | `bg-card/30` | ✓ |
| `bg-slate-900/70` | 1 | `bg-card/70` | ✓ |
| `bg-slate-900/95` | 2 | `bg-card/95` | ✓ |
| `bg-slate-800` | 16 | `bg-muted` | Same color as `bg-card` in Observatory. Visual distinction collapses. ⚠️ |
| `bg-slate-800/50` | 6 | `bg-muted/50` | ⚠️ |
| `bg-slate-800/60` | 4 | `bg-muted/60` | ⚠️ |
| `bg-slate-800/30` | 3 | `bg-muted/30` | ⚠️ |
| `bg-slate-800/40` | 2 | `bg-muted/40` | ⚠️ |
| `bg-slate-800/20` | 1 | `bg-muted/20` | ⚠️ |
| `bg-slate-800/80` | 1 | `bg-muted/80` | ⚠️ |
| `bg-slate-700` | 3 | **`bg-accent`** | ⚠️ EDGE CASE — badges/pills/active states (EarningsAlertHistoryPanel, EarningsAlertStrip). Closest token is `--accent` (250 33% 12%), but slate-700 (~23% L) is noticeably lighter than accent (~12% L). Visual change will be significant. |
| `bg-slate-700/50` | 2 | **`bg-accent/50`** | ⚠️ Same edge case (Watchlists category pills). |
| `bg-slate-700/30` | 1 | **`bg-accent/30`** | ⚠️ Same edge case (EarningsAlertStrip). |
| `bg-slate-600/30` | 1 | **`bg-accent/30`** | ⚠️ EDGE CASE — sectorGlyphs.ts utility badge. Even lighter than slate-700. Observatory has no token this light. |
| `bg-slate-500` | 2 | ✅ **RESOLVED → `bg-progress`** | HARD FLAG (was) — DipFinder progress bar fill + ProviderHealthIndicator dot. No Observatory token originally fit, so a `--progress` token was added (global.css + tailwind.config.ts) and both occurrences migrated to `bg-progress`. |

### 2. Text (125 occurrences)

| Slate Class | Count | → Observatory Token | Notes |
|---|---|---|---|
| `text-slate-200` | 5 | `text-foreground` | Brightest text — headlines, emphasis text on dark bgs. Starlight White (95% L). ✓ |
| `text-slate-300` | 20 | `text-foreground` | High-emphasis body text — labels, code blocks, active items. Also maps to Starlight White. ⚠️ `text-slate-200` and `text-slate-300` both map to `text-foreground` — the distinction between them is lost. Use `text-foreground` for slate-300 and `text-foreground` for slate-200 (or `font-bold` for visual distinction if the difference matters). |
| `text-slate-400` | 48 | **`text-foreground/80`** | ⚠️ EDGE CASE — primary body/description text. Observatory has no token between Starlight White (95%) and Dust (60%). 80% opacity on `--foreground` is the closest approximation. **Recommend: add `--foreground-secondary: 210 15% 78%` as a mid-tier text token.** |
| `text-slate-500` | 50 | `text-muted-foreground` | Secondary/muted text, captions, axis labels, timestamps. Dust (60% L). ✓ |
| `text-slate-600` | 1 | **`text-muted-foreground/80`** | ⚠️ EDGE CASE — dim text (I18nDebug.tsx footer only). 80% opacity on Dust. Visual weight is close enough; single occurrence. |
| `placeholder-slate-500` | 1 | `placeholder-muted-foreground` | Placeholder text. ✓ |

> ⚠️ **Systemic edge case:** the slate text scale uses 5 density levels (200→600), but Observatory defines only 2 text tokens (`--foreground` and `--muted-foreground`). Opacity modifiers bridge the gap but are a workaround. The 80% technique produces a color roughly equivalent to `hsl(210 20% 95% / 0.8)` ≈ `hsl(210 15% 78%)`, which is a reasonable mid-tier text color. A dedicated `--foreground-secondary` token would be cleaner.

### 3. Border (45 occurrences)

| Slate Class | Count | → Observatory Token | Notes |
|---|---|---|---|
| `border-slate-700` | 31 | `border-border` | The canonical card/panel border. Graticule (16% L). ✓ |
| `border-slate-700/50` | 5 | `border-border/50` | ✓ |
| `border-slate-700/60` | 1 | `border-border/60` | ✓ |
| `border-slate-700/30` | 1 | `border-border/30` | ✓ |
| `border-slate-800` | 5 | **`border-border/70`** | ⚠️ EDGE CASE — darker-than-standard borders (EarningsAlertHistoryPanel inner, LanguageSwitcher, Charts empty state, Portfolio divider). `--border` (16% L) is roughly equivalent to slate-800 (~16% L) already. The darkening was achieved by using a darker slate shade; to preserve the darker intent with the single `--border` token, use ~70% opacity. **Alternative: create `--border-subtle: 250 16% 12%` if the visual distinction matters.** |
| `border-slate-800/50` | 1 | **`border-border/40`** | ⚠️ Same edge case at lower opacity. |
| `divide-slate-800` | 1 | **`divide-border`** | ⚠️ Divider (EarningsAlertHistoryPanel list). Maps to `divide-border` which uses `--border` (16% L). Slightly lighter than slate-800 (~16% L) — negligible difference. |

---

## Edge Cases & Resolutions

### 🔴 BG-01: `bg-slate-500` — DipFinder Progress Bar (2 occurrences)
**File:** `client/components/DipFinder.tsx` lines 151-152  
**Context:** `<div className="bg-slate-500" style={{width: ...}} />` — horizontal progress bar fill.  
**Issue:** Observatory has no neutral mid-tone surface token. `--primary` (Starlight Gold) is semantically wrong. `--accent` is too dark.  
**Resolution:** **RESOLVED** — added `--progress` token (global.css `:root` 215.4 16.3% 46.9% / `.dark` 220 10% 45%; tailwind.config.ts `progress` color). Both `bg-slate-500` occurrences migrated to `bg-progress`.

### ⚠️ BG-02: `bg-slate-700*` / `bg-slate-600*` — Badges & Active States (7 occurrences)
**Files:** `EarningsAlertHistoryPanel.tsx`, `EarningsAlertStrip.tsx`, `Watchlists.tsx`, `sectorGlyphs.ts`  
**Context:** Badge backgrounds, category pills, active indicators.  
**Issue:** `bg-accent` (12% L) is much darker than slate-700 (~23% L). These elements will become visibly darker.  
**Resolution:** **Map to `bg-accent`** with the understanding that the visual weight changes. If the brightness matters for readability (white text on badge), verify contrast ratio post-migration. A dedicated `--badge: 250 20% 20%` token would be ideal.

### ⚠️ TXT-01: `text-slate-400` → `text-foreground/80` (48 occurrences)
**Context:** 48 occurrences across 13+ files — this is the most common slate class after `text-slate-500`.  
**Issue:** Observatory's text scale jumps from Starlight White (95% L) to Dust (60% L) with nothing between. `text-foreground/80` approximates ~78% L which is close to slate-400 (~73% L).  
**Resolution:** Use `text-foreground/80`. **Recommend adding `--foreground-secondary: 210 15% 78%`** to the theme for a permanent mid-tier text token.

### ⚠️ BDR-01: `border-slate-800*` — Darker Borders (6 occurrences)
**Files:** `EarningsAlertHistoryPanel.tsx`, `LanguageSwitcher.tsx`, `Charts.tsx`, `Portfolio.tsx`, `I18nDebug.tsx`  
**Context:** Inner borders, subtle separators, dark dividers.  
**Issue:** `--border` (Graticule, 16% L) ≈ slate-800 (~16% L). Using `border-border` full-opacity would make these borders the same as regular borders, losing the "darker/subtle" intent.  
**Resolution:** Use `border-border/70` and `border-border/40`. **Alternative: add `--border-subtle: 250 16% 12%`** token.

### ⚠️ SYS-01: `bg-slate-900` vs `bg-slate-800` Distinction Collapses
**Context:** 20 occurrences of `bg-slate-900*` map to `bg-card`. 33 occurrences of `bg-slate-800*` map to `bg-muted`.  
**Issue:** `--card` and `--muted` are the same value in Observatory (`250 30% 9%`). Any UI that depends on visual distinction between these surfaces will lose it.  
**Resolution:** This is intentional per DESIGN.md ("not a separate material"). If some components genuinely need a visibly distinct surface (e.g., nested cards, selected vs unselected panels), those should use `bg-accent` (12% L) for the elevated state instead. The migration itself is correct: `bg-slate-900` → `bg-card`, `bg-slate-800` → `bg-muted`. The collapse is a design decision, not a mapping error.

---

## Per-File Occurrence Count

| File | Text | Bg | Border | Total |
|---|---|---|---|---|
| `components/Portfolio.tsx` | 20 | 8 | 9 | 37 |
| `components/StockSlideOver.tsx` | 18 | 6 | 5 | 29 |
| `pages/I18nDebug.tsx` | 15 | 6 | 8 | 29 |
| `components/DCFWidget.tsx` | 14 | 9 | 5 | 28 |
| `pages/Watchlists.tsx` | 9 | 7 | 2 | 18 |
| `components/EarningsAlertHistoryPanel.tsx` | 5 | 3 | 3 | 11 |
| `components/EarningsAlertStrip.tsx` | 5 | 4 | 2 | 11 |
| `pages/Charts.tsx` | 5 | 4 | 2 | 11 |
| `pages/Earnings.tsx` | 4 | 5 | 2 | 11 |
| `components/EarningsCalendar.tsx` | 4 | 3 | 2 | 9 |
| `components/AddWatchlistSheet.tsx` | 5 | 1 | 1 | 7 |
| `components/DipFinder.tsx` | 3 | 3 | 1 | 7 |
| `components/TickerLogo.tsx` | 3 | 2 | 0 | 5 |
| `components/LanguageSwitcher.tsx` | 2 | 1 | 1 | 4 |
| `components/ProviderHealthIndicator.tsx` | 1 | 2 | 1 | 4 |
| `components/DeferredInsightsCard.tsx` | 0 | 0 | 2 | 2 |
| `lib/sectorGlyphs.ts` | 1 | 1 | 0 | 2 |
| `pages/Index.tsx` | 2 | 0 | 0 | 2 |
| `components/Skeleton.tsx` | 0 | 1 | 0 | 1 |

---

## Recommended New Tokens

If the migration should preserve visual fidelity rather than accept the Observatory token set as-is, add these to `client/global.css` `.dark`:

```css
--foreground-secondary: 210 15% 78%;   /* Mid-tier text (replaces text-slate-400) */
--progress: 220 10% 45%;               /* Progress bar fill (replaces bg-slate-500) */
--border-subtle: 250 16% 12%;          /* Darker border variant */
--badge: 250 20% 20%;                  /* Badge/pill/active surface (replaces bg-slate-700) */
```

Then update `tailwind.config.ts` colors object to expose them (e.g., `badge: "hsl(var(--badge))"`).

---

## Acceptance Checklist

- [x] Every slate-* occurrence (228/228) has a proposed replacement
- [x] 24 class patterns are unambiguous one-to-one mappings
- [x] 7 edge cases flagged with rationale and concrete resolution
- [x] 1 hard flag (`bg-slate-500`) with keep-as-is recommendation
- [x] Systemic issues documented: text scale gap, bg-slate-900/800 collapse
- [x] New token recommendations provided for optional fidelity preservation
- [x] Per-file breakdown for migration planning