# Plan 005 — Author DESIGN.md (F6, resolves F5)

- **Repo:** vantage
- **Executor worktree:** `C:/Users/Tiger/Agents\Projects\vantage-exec` (branch `gflow/improve-exec`)
- **Git commit stamp:** `03ab10182da1415b3c42491f3d5caa2e68cb23d5`
- **Audit finding:** F6 (MED confidence, M effort). Also resolves F5 (the 5 dangling `DESIGN.md` references now point to a real doc).

## Goal
Create repo-root `DESIGN.md` documenting the existing **Observatory Light-Curve** design system so the dangling references (`global.css:63`, `tailwind.config.ts:94,99`, `ChartModal.tsx`, `InsightsCard.tsx`) point to a real source of truth. Capture ONLY what is already encoded in `global.css` / `tailwind.config.ts` — do NOT invent new rules.

## Exact deliverable
Create `DESIGN.md` at repo root with these sections (values copied verbatim from the `.dark` block in `global.css` and `tailwind.config.ts`):

1. **Theme name:** Observatory Light-Curve. Dark-only (`html` forced `.dark` in `global.css`).
2. **Color tokens (dark):** list `--background` (Night Sky), `--foreground` (Starlight White), `--card` (Deep Field), `--primary` (Starlight Gold, `42 65% 70%`), `--muted-foreground` (Dust), `--border` (Graticule), `--destructive` (distinct from loss red), and the full `--chart-*` palette (green/positive = Aurora Green, negative = Ember Red, amber = Warning, accent = Starlight Gold).
3. **Accent rule:** primary (gold) used as ≤15% of any screen.
4. **Financial-sign tokens (canonical):** gain/loss MUST use `text-chart-positive` / `text-chart-negative` (and bg variants), never raw `red-*`/`green-*`. (This is the contract established by plan 001.)
5. **Two-tier corner language:** structural panels use `--radius` (10px) generally, but instrument-like panels use `rounded-panel` = 2px (see `tailwind.config` `borderRadius.panel`).
6. **The Earned Glow Rule:** the only shadow (`boxShadow.glow`) attaches to a live/selected/active signal; never ambient elevation.
7. **Typography:** display = Heebo → Space Grotesk → Inter (loaded in `global.css`); sans = same stack; mono = JetBrains Mono. Headings use `font-display`.
8. **References:** note that `global.css` and `tailwind.config.ts` cite this file.

## Verification gates
1. File exists: `test -f DESIGN.md && echo ok`
2. Contains the canonical tokens: `grep -q "text-chart-positive" DESIGN.md && grep -q "Earned Glow" DESIGN.md && grep -q "two-tier" DESIGN.md` → all true.
3. No build needed (docs only); `pnpm typecheck` still passes (no code change).

## STOP
- Do NOT modify `global.css` / `tailwind.config.ts` in this plan (that is F4 / out of scope here).
- Do NOT invent colors not present in `global.css`.
