# Plan 003 — Route page headers through PageHeader (F3)

- **Repo:** vantage
- **Executor worktree:** `C:/Users/Tiger/Agents\Projects\vantage-exec` (branch `gflow/improve-exec`)
- **Git commit stamp:** `03ab10182da1415b3c42491f3d5caa2e68cb23d5`
- **Audit finding:** F3 (HIGH confidence, M effort)
- **Depends on:** `PageHeader` already exists (`client/components/PageHeader.tsx`) — no change needed there.

## Goal
Five page routes render a hand-rolled `<h1 className="text-3xl font-bold text-foreground">` with no eyebrow, no `font-display`, no status badge — inconsistent with the 3 routes that already use the shared `PageHeader`. Route all six through `PageHeader` for a single header language.

## In scope — exact edits
For each file: add `import PageHeader from "@/components/PageHeader";` if not already present, then replace the standalone `<h1>` page-title block with `<PageHeader ... />`.

### client/pages/Earnings.tsx (L119)
Old: `          <h1 className="text-3xl font-bold text-foreground">{t("nav.earnings")}</h1>`
New: `          <PageHeader eyebrow={t("nav.earnings")} title={t("nav.earnings")} className="mb-8" />`

### client/pages/Watchlists.tsx (L148)
Old: `          <h1 className="text-3xl font-bold text-foreground">{t("nav.watchlists")}</h1>`
New: `          <PageHeader eyebrow={t("nav.watchlists")} title={t("nav.watchlists")} className="mb-8" />`

### client/pages/Portfolios.tsx (L13)
Old: `        <h1 className="text-3xl font-bold text-foreground">{t("portfolio.title")}</h1>`
New: `        <PageHeader eyebrow={t("portfolio.title")} title={t("portfolio.title")} className="mb-8" />`

### client/pages/Screener.tsx (L366)
Old: `        <h1 className="text-3xl font-bold tracking-tight">Market Screener</h1>`
New: `        <PageHeader eyebrow="Market Screener" title="Market Screener" className="mb-8" />`

### client/pages/NotFound.tsx (L20)
Old: `        <h1 className="text-4xl font-bold mb-4">{t("notfound.title")}</h1>`
New: `        <PageHeader eyebrow={t("notfound.title")} title={t("notfound.title")} className="mb-8" />`

### client/pages/I18nDebug.tsx (L40)
Old: `        <h1 className="text-2xl font-bold text-foreground">`
New: `        <PageHeader eyebrow="i18n Debug" title="i18n Debug" className="mb-8" />`

## Notes
- `PageHeader` renders a `<header>` with flex; replacing a bare `<h1>` inside an existing container is safe.
- If the `<h1>` is wrapped in a flex row with a sibling action button, move that button into `PageHeader`'s `actions` prop instead of deleting it.
- Keep each page's surrounding layout; only swap the heading element.

## Verification gates
1. `pnpm typecheck` → exit 0.
2. `pnpm test` → pass.
3. `pnpm build:client` → succeeds.
4. **Positive:**
   - `grep -rln "PageHeader" client/pages` → should list Earnings, Watchlists, Portfolios, Screener, NotFound, I18nDebug, Charts, Insights (8 files).
   - `grep -rnE "<h1" client/pages` → MUST return NO matches (all page titles now via `PageHeader`).

## STOP
- If a page's `<h1>` is embedded in complex layout you cannot safely detach → STOP and report that file specifically; do NOT delete content.
- Do not alter `PageHeader.tsx` itself.
