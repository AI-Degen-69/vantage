# Project Knowledge — builder-io-vantage-design

## What This Is

A bilingual (English / Hebrew) stock-analysis web app built on top of the
**Fusion Starter** template. Dark "Bloomberg Terminal"-style UI with SP-style
insights, earnings calendar, DCF widget, watchlists, and a single-company
profile view. Real market data is fetched server-side from FMP, Alpha Vantage,
and Logo.dev, with mock fallbacks for fields unavailable on the free tier.

## Tech Stack

- **Package manager**: `pnpm` (project is locked to `pnpm@10.14.0` via
  `packageManager` field — use pnpm, not npm/yarn)
- **Frontend**: React 18 + React Router 6 (SPA mode) + TypeScript + Vite +
  TailwindCSS 3 + Radix UI primitives + Lucide React icons
- **Charts**: recharts (BarChart, AreaChart, LineChart via Bar/Area/Line with
  linearGradient fills in ChartModal)
- **Backend**: Express 5 integrated into the Vite dev server (single port, hot
  reload both sides)
- **Data fetching (client)**: TanStack Query (`@tanstack/react-query`) via
  `client/hooks/useStockData.ts`
- **i18n**: `i18next` + `react-i18next`; translations in
  `client/locales/{en,he}/translation.json`; RTL handled by `dir="ltr"` on
  numeric/English fields
- **Validation**: `zod` on server responses
- **Caching**: `node-cache` for upstream API responses in
  `server/services/stockService.ts`
- **Testing**: Vitest (`pnpm test`)

## Path Aliases (tsconfig + vite)

- `@shared/*` → `shared/` — types shared by client and server
- `@/*` → `client/` — frontend code

## Key Code Locations

```
client/
  App.tsx                         # SPA router (React Router 6) - add new routes above the "*" catch-all
  main.tsx                        # Bootstrap (React mount + i18n + QueryClient)
  pages/                          # One file per route (Index, Insights, Watchlists, Portfolios, Charts, Earnings)
  components/                     # Feature widgets - every "real-data" widget takes `{ ticker }` and pulls hooks
    InsightsCard.tsx              # SP-style ticker list with peRatio / discount ribbons
    CompanyProfile.tsx            # Description, insider trades, analyst estimates, employee count, news
    DCFWidget.tsx                 # Forward return / fair value card
    DipFinder.tsx                 # 200-day SMA distance bar chart with center baseline
    EarningsCalendar.tsx          # Mon-Fri grid, uses useEarningsCalendar + mock fallback
    ChartModal.tsx                # Recharts BarArea/Line modal with gradient fills
    Portfolio.tsx                 # Portfolio holdings + add-position dialog
    TopBar.tsx, Sidebar.tsx,
    LanguageSwitcher.tsx
  components/ui/                  # Pre-built Radix shadcn-style primitives (do not rewrite; reuse via cn())
  hooks/useStockData.ts           # All TanStack Query hooks (useStockOverview, useStockAnalyst, etc.)
  lib/
    mockData.ts                   # Mocks for company profile, analyst estimates, news, insider trades, employee count
    utils.ts                      # cn() helper (clsx + tailwind-merge)
  locales/{en,he}/translation.json # All user-visible strings
  global.css                      # Tailwind theme + design tokens (add new colors here, then tailwind.config.ts)

server/
  index.ts                        # Express setup, mounts routes, also serves the SPA in prod
  routes/
    stock-data.ts                 # /api/stock-data — proxies FMP + Alpha Vantage with caching
    company-logo.ts               # /api/logo — Logo.dev lookup with fallback
    demo.ts                       # /api/demo (template example)
  services/
    stockService.ts               # Upstream fetching + node-cache TTL strategy (KEEP server-side: API keys)

shared/
  api.ts                          # Shared response interfaces between client and server

docs/
  endpoints.md                    # Reference list of FMP endpoints and the fields each one returns
```

## Commands

```bash
pnpm install
pnpm dev              # Start Vite + Express on one port (8080) with HMR
pnpm build            # Build client (dist/spa) + server (dist/server)
pnpm start            # Run the production server (dist/server/node-build.mjs)
pnpm typecheck        # tsc only; no emit
pnpm test             # Vitest --run
pnpm format.fix       # Prettier write
```

The `dev` script is `vite`, which boots the integrated server (see
`vite.config.ts` + `vite.config.server.ts`). One port, both sides.

## Conventions & "Gotchas"

1. **API keys live on the server, not the client.** Never move `FMP_KEY`,
   `AV_KEY`, or `LOGO_DEV_TOKEN` into client code. They are read in
   `server/services/stockService.ts` and proxied through `/api/*` routes.
   Frontend only fetches `/api/...` endpoints.
2. **Mock-first data shape.** Every `useStock*` hook returns data shaped to
   match the UI even on API failure — components check `!data || empty` and
   fall back to `lib/mockData.ts`. Show a `[MOCK]` badge (yellow) whenever
   mock data is rendered so users know the source.
3. **Reuse `cn()` for conditional classes.** It's defined in
   `client/lib/utils.ts` — do not hand-roll clsx + twMerge calls.
4. **UI primitives live in `client/components/ui/`.** These are pre-installed
   shadcn/Radix wrappers. Reuse them; do not replace them with custom markup.
5. **Bilingual: every visible string goes through i18n.** Add keys to BOTH
   `client/locales/en/translation.json` and `client/locales/he/translation.json`.
   For Hebrew/RTL, numeric and English ticker/financial values should carry
   `dir="ltr"` so they don't get mirrored.
6. **Spas with new routes: edit `client/App.tsx`** and add the `<Route>` ABOVE
   the `<Route path="*" element={<NotFound />} />` catch-all.
7. **New API route pattern**: declare a shared interface in `shared/api.ts`
   (optional), implement a handler in `server/routes/<name>.ts` typed as
   `RequestHandler`, then register it in `server/index.ts` under `/api/...`.
   Use `zod` to validate upstream data if the shape is variable (FMP varies).
8. **Theme/design tokens**: add new Tailwind colors via `client/global.css`
   first, then `tailwind.config.ts`. Do not hardcode hex colors in components
   unless they already exist as tokens.
9. **Cache upstream calls.** Use `node-cache` (TTL ~5–15 min) on FMP/AV
   responses inside `server/services/stockService.ts` — free-tier rate limits
   are tight.
10. **FMP field casing**: FMP returns mixed `camelCase` and `PascalCase`
    keys; defensive code should check both (`data?.peRatio || data?.PERatio`).
11. **Recharts gradients**: each chart that uses gradients needs a unique
    `<defs id="…">` (typically `colorValue-bar-${metric.name}`) to avoid
    collisions across charts in the same modal.
12. **Hot reload caveat**: if a server route signature changes mid-edit, just
    saving the route file is enough — the Vite dev server restarts the
    Express middleware automatically.

## Branch & Working-State Notes

- Working branch: `feature/vantage-design` (uncommitted modifications in many
  files, plus untracked `docs/`, `server/services/`, and `.freebuff/` —
  ignore those last two; they are tooling artifacts).
- Recent diffs show FMP integration being wired in across
  `CompanyProfile.tsx`, `EarningsCalendar.tsx`, `DCFWidget.tsx`,
  `InsightsCard.tsx`, `Portfolio.tsx`, plus chart polish in
  `ChartModal.tsx` and a center-baseline + axis ticks fix in
  `DipFinder.tsx`. When extending, keep the `[MOCK]` badge convention for any
  data sourced from `lib/mockData.ts`.
