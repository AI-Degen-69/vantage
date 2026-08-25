# Plan 004 — Replace off-palette slate-* with theme tokens (F2)

- **Repo:** vantage
- **Executor worktree:** `C:/Users/Tiger/Agents\Projects\vantage-exec` (branch `gflow/improve-exec`)
- **Git commit stamp:** `03ab10182da1415b3c42491f3d5caa2e68cb23d5`
- **Audit finding:** F2 (HIGH confidence, L effort) — 244 `slate-*` occurrences across 20 files.
- **Run AFTER plan 001** so financial-sign reds are already canonical; this plan handles only `slate-*`.

## Goal
The Observatory theme defines semantic surface/text/border tokens (`--card`, `--muted`, `--border`, `--muted-foreground`, `--chart-*`) but ~244 hardcoded `slate-*` classes bypass them. Replace them with the equivalent theme token so the dark theme can be retuned in one place.

## Canonical mapping (apply mechanically; opacity modifiers transfer onto the theme token)
| slate token | replace with |
|---|---|
| `text-slate-500` | `text-muted-foreground` |
| `text-slate-400` | `text-muted-foreground` |
| `text-slate-300` | `text-foreground/80` |
| `text-slate-600` | `text-muted-foreground` |
| `text-slate-200` | `text-foreground/90` |
| `text-slate-700` | `text-muted-foreground` |
| `text-slate-800` | `text-foreground/70` |
| `text-slate-900` | `text-foreground/60` |
| `border-slate-700` | `border-border` |
| `border-slate-800` | `border-border` |
| `border-slate-600` | `border-border` |
| `bg-slate-700` | `bg-muted` |
| `bg-slate-800` | `bg-card` |
| `bg-slate-900` | `bg-card` |
| `bg-slate-800/20` | `bg-card/20` |
| `bg-slate-800/30` | `bg-card/30` |
| `bg-slate-800/40` | `bg-card/40` |
| `bg-slate-800/50` | `bg-card/50` |
| `bg-slate-800/60` | `bg-card/60` |
| `bg-slate-800/80` | `bg-card/80` |
| `bg-slate-900/30` | `bg-card/30` |
| `bg-slate-900/40` | `bg-card/40` |
| `bg-slate-900/50` | `bg-card/50` |
| `bg-slate-900/70` | `bg-card/70` |
| `bg-slate-900/95` | `bg-card/95` |
| `bg-slate-700/30` | `bg-muted/30` |
| `bg-slate-700/40` | `bg-muted/40` |
| `bg-slate-700/50` | `bg-muted/50` |
| `bg-slate-700/60` | `bg-muted/60` |
| `bg-slate-600/30` | `bg-muted/30` |

## In-scope files (replace `slate-*` per mapping above; do NOT touch other colors)
client/components/AddWatchlistSheet.tsx
client/components/DCFWidget.tsx
client/components/DeferredInsightsCard.tsx
client/components/DipFinder.tsx
client/components/EarningsAlertHistoryPanel.tsx
client/components/EarningsAlertStrip.tsx
client/components/EarningsCalendar.tsx
client/components/LanguageSwitcher.tsx
client/components/Portfolio.tsx
client/components/ProviderHealthIndicator.tsx
client/components/Skeleton.tsx
client/components/StockSlideOver.tsx
client/components/TickerLogo.tsx
client/lib/sectorGlyphs.ts
client/pages/Charts.tsx
client/pages/Earnings.tsx
client/pages/I18nDebug.tsx
client/pages/Index.tsx
client/pages/Watchlists.tsx

**Only `slate-*` tokens are replaced.** Decorative/other hardcoded colors (emerald/rose in `sectorGlyphs.ts`, `bg-blue-500`/`text-blue-400` in Charts `DualRange`, `red-*`/`green-*` financial-sign handled by plan 001) are NOT in scope here.

## Verification gates
1. `pnpm typecheck` → exit 0.
2. `pnpm test` → pass.
3. `pnpm build:client` → succeeds.
4. **Positive:** `grep -rnoE "slate-(50|100|200|300|400|500|600|700|800|900)(/[0-9.]+)?" client --include=*.tsx --include=*.ts | grep -v node_modules` → MUST return NO matches.

## STOP conditions
- If a `slate` token is used inside a hardcoded gradient (e.g. `from-slate-800 to-slate-900`) or an inline style where a theme token would break the visual → STOP and report that occurrence rather than replacing blindly.
- If build fails → STOP and report.
- Do NOT alter `chart-*` token usages, only `slate-*`.
