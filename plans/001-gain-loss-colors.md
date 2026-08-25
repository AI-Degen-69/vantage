# Plan 001 — Canonicalize gain/loss (financial-sign) colors (F1)

- **Repo:** vantage
- **Executor worktree:** `C:/Users/Tiger/Agents/Projects/vantage-exec` (branch `gflow/improve-exec`)
- **Git commit stamp (drift check):** `03ab10182da1415b3c42491f3d5caa2e68cb23d5`
- **Audit finding:** F1 (HIGH confidence, M effort)
- **Dependencies:** none. Run BEFORE plan 004 (slate sweep) so financial-sign reds are gone first.

## Goal
Replace hardcoded gain/loss Tailwind colors (`red-400` / `green-400` / `red-500` / `green-500` / `emerald-500` / `amber-400`) used for **FINANCIAL SIGN** (price up/down, beats/misses, position-in-range) with the themed chart tokens, so dark-mode theming works and the site reads consistently. Canonical tokens:
- positive: `text-chart-positive` (and `bg-chart-positive`, `bg-chart-positive/20`)
- negative: `text-chart-negative` (and `bg-chart-negative`, `bg-chart-negative/20`)
- positional-mid: `text-chart-amber` / `bg-chart-amber` (was `amber-400`)
- `text-chart-green` / `bg-chart-green` MAY be kept where already used (equivalent to `chart-positive`, already on-palette).

## In scope — exact edits
All paths are under the worktree root. Replace ONLY the listed occurrences (financial-sign ternaries/classes).

### client/pages/Index.tsx
- L394: `quoteData.change >= 0 ? "text-chart-green" : "text-red-400"` → `quoteData.change >= 0 ? "text-chart-green" : "text-chart-negative"`
- L403: `quoteData.changesPercentage >= 0 ? "text-chart-green" : "text-red-400"` → `quoteData.changesPercentage >= 0 ? "text-chart-green" : "text-chart-negative"`
- L569-574 (`barColor`): `? "bg-chart-green" : finalPct >= 33 ? "bg-amber-400" : "bg-red-400"` → `? "bg-chart-green" : finalPct >= 33 ? "bg-chart-amber" : "bg-chart-negative"`
- L575-580 (`textColor`): `? "text-chart-green" : finalPct >= 33 ? "text-amber-400" : "text-red-400"` → `? "text-chart-green" : finalPct >= 33 ? "text-chart-amber" : "text-chart-negative"`
- L581-586 (`arrowColor`): same pattern as `textColor` → replace `text-amber-400`→`text-chart-amber`, `text-red-400`→`text-chart-negative`

### client/pages/Charts.tsx
- L129: `(quoteData?.change ?? 0) >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"` → `(quoteData?.change ?? 0) >= 0 ? "bg-chart-positive/20 text-chart-positive" : "bg-chart-negative/20 text-chart-negative"`
- L238 (DualRange low label): `text-red-400 font-medium` → `text-chart-negative font-medium`
- L244 (DualRange high label): `text-green-400 font-medium` → `text-chart-positive font-medium`

### client/components/StockSlideOver.tsx
- L134: `quote.change >= 0 ? "text-chart-green" : "text-red-400"` → `"text-chart-green" : "text-chart-negative"`
- L141: `quote.changePercent >= 0 ? "bg-chart-green/20 text-chart-green" : "bg-red-400/20 text-red-400"` → `"bg-chart-positive/20 text-chart-positive" : "bg-chart-negative/20 text-chart-negative"`
- L153: `quote.afterHoursChange != null && quote.afterHoursChange >= 0 ? "text-chart-green" : "text-red-400"` → `"text-chart-green" : "text-chart-negative"`
- L167: `priceChange.ytd >= 0 ? "text-chart-green" : "text-red-400"` → `"text-chart-green" : "text-chart-negative"`
- L175: `priceChange["1Y"] >= 0 ? "text-chart-green" : "text-red-400"` → `"text-chart-green" : "text-chart-negative"`
- L183: `priceChange["3Y"] >= 0 ? "text-chart-green" : "text-red-400"` → `"text-chart-green" : "text-chart-negative"`

### client/components/Portfolio.tsx
- L328, L334, L363, L370, L456, L462: each `>= 0 ? "text-green-400" : "text-red-400"` → `>= 0 ? "text-chart-positive" : "text-chart-negative"`

### client/components/DipFinder.tsx
- L116: `text-red-400/50` → `text-chart-negative/50`
- L118: `text-green-400/50` → `text-chart-positive/50`
- L130: `bg-emerald-500` → `bg-chart-positive`
- L155: `bg-red-500` → `bg-chart-negative`
- L163: `bg-green-500` → `bg-chart-positive`
- L171: `isNegative ? "text-red-400" : "text-green-400"` → `isNegative ? "text-chart-negative" : "text-chart-positive"`

### client/components/EarningsCalendar.tsx
- L54: `ev.surprise === "beat" ? "text-green-400" : ev.surprise === "miss" ? "text-red-400" : ""` → `ev.surprise === "beat" ? "text-chart-positive" : ev.surprise === "miss" ? "text-chart-negative" : ""`

## Out of scope (DO NOT touch — error / destructive / decorative semantics)
- `client/components/AddWatchlistSheet.tsx` (L245,247,282,300) — validation ERROR states
- `client/components/ProviderHealthIndicator.tsx` (L34,35) — degraded/error banner
- `client/components/StockFundamentalsStrip.tsx` (L117) — alert badge
- `client/pages/Watchlists.tsx` (L235,325) — delete/destructive hover
- `client/components/ui/toast.tsx` (L78) — toast component internals
- `client/lib/utils.spec.ts` (L6) — test fixture
- `client/lib/sectorGlyphs.ts` (L42,43) — decorative sector chips

## Verification gates (run in worktree, after `pnpm install`)
1. `pnpm typecheck` → exit 0, no new errors.
2. `pnpm test` → all vitest specs pass (swapped classes are string literals; no logic change).
3. `pnpm build:client` → build succeeds.
4. **Positive check:** the following must return NO matches:
   `grep -rnoE "text-red-400|text-green-400|bg-red-500|bg-green-500|bg-emerald-500" client/pages client/components | grep -vE "AddWatchlistSheet|ProviderHealthIndicator|StockFundamentalsStrip|Watchlists.tsx|ui/toast|sectorGlyphs|utils.spec"`

## STOP conditions
- If `pnpm install` / build fails for environment reasons unrelated to your edits → STOP and report (do not workaround).
- If any in-scope file does not match the exact old string (line shifted) → STOP and report the discrepancy; do NOT guess.
- Never edit an out-of-scope file. If you believe an out-of-scope file is actually a financial-sign color → STOP and report instead of editing.
