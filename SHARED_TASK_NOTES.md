# Shared Task Notes

Cross-agent improvement backlog. Highest-priority unaddressed candidate feeds the
next loop iteration. New candidates are appended at the bottom.

---

## Iteration 1 — Candidate Cards (generated 2026-09-03)

### Candidate 1 — Dedupe `formatLargeNumber`, fix negative-money rendering (Strong)

- **Area / Files**: `shared/format.ts` (new), `server/services/stockAggregator.ts`, `client/components/StockSlideOver.tsx`, `shared/format.spec.ts` (new)
- **Problem**: Two drifted copies of `formatLargeNumber` exist: `StockSlideOver.tsx:13` (client) and `stockAggregator.ts:24` (server). The client copy is dead code (zero call sites). The server copy is live at ~12 call sites, and every caller wraps the result in `` `$${...}` `` — so negative FCF renders as `$-4.80M` (sign after the currency symbol) instead of `-$4.80M`. This is the exact bug class the canonical `client/lib/format.ts` `formatMoney` already fixed client-side ("-$4.80B, not $-4.80B"), still live server-side.
- **Solution**: Extract a canonical `shared/format.ts` with `formatLargeNumber(num, opts?)` — handles negatives with sign-before-`$`, null → "—", 0 → "$0", K/M/B/T tiers with 2 decimals, optional `omit$`for raw volume counts.`stockAggregator.ts`imports it via`@shared/format`(alias already used by server and client) and drops its private copy and hand-rolled`$`wrapping;`StockSlideOver.tsx` deletes its dead copy.
- **Benefits**: Kills a drift vector (this repo has fixed formatMoney drift 3× before: PRs #40, #28, #41), fixes a user-visible rendering bug (negative values inside financial profile blocks), moves a pure formatter to the shared layer where both runtimes can test it.
- **Strength Badge**: `Strong`
- **Scope**: ~3 files, well under 120 changed lines. Machine-decidable: unit specs on tier boundaries (999.99K→1.00M promotion, negatives, null, 0) + full suite green + prettier clean.

### Candidate 2 — Split `client/lib/i18n.tsx` god module (2,566 lines) (Worth exploring)

- **Area / Files**: `client/lib/i18n.tsx` → locale data modules (`locales/` dir already exists but appears unused by the provider)
- **Problem**: Provider, hook, ICU engine glue, and (likely) large inline translation tables live in one 2,566-line file. Any key edit touches the same file as the React context machinery, causing noisy diffs and slow tooling.
- **Solution**: Move per-language string tables to `client/locales/<lang>.ts`, keep provider/hook in `i18n.tsx`. Type the tables against the en dictionary.
- **Benefits**: Smaller diffs, faster HMR on copy edits, typed locale parity.
- **Strength Badge**: `Worth exploring`
- **Scope risk**: Mechanical but wide — likely touches imports across most pages. Needs its own iteration with care.

### Candidate 3 — Decompose `server/services/stockService.ts` (2,757 lines) (Worth exploring)

- **Area / Files**: `server/services/stockService.ts`
- **Problem**: Single module aggregates FMP/Yahoo/Finnhub logic for stocks, quotes, metrics, insider trades, revenue segmentation, provider health, trending movers. Seven colocated spec files suggest the seams already exist but the implementation stayed monolithic.
- **Solution**: Extract cohesive sub-services along the existing spec-file seams (availability, fmpMetrics, providerHealth, revenueSegmentation, trendingMovers, yahooMetricsMapping).
- **Benefits**: Testability, merge-conflict reduction, clearer ownership per provider concern.
- **Strength Badge**: `Worth exploring`
- **Scope risk**: Refactor-only, but this is the hottest server file; needs strong parity tests before moving code.

### Candidate 4 — Cover `ChartModal.tsx` interaction paths (Speculative)

- **Area / Files**: `client/components/ChartModal.tsx` (1,700 lines; one locked-banner spec only)
- **Problem**: Largest client component has minimal spec coverage relative to its surface (range switching, metric selection, modal close/focus behaviors).
- **Solution**: Add interaction specs for range/metric switches and modal lifecycle using existing happy-dom + testing-library patterns.
- **Benefits**: Regression safety on the most-used feature surface.
- **Strength Badge**: `Speculative`
- **Scope risk**: UI interaction specs can be brittle; needs careful selectors.

### Candidate 5 — `useStockData.ts` (891 lines) hook decomposition (Speculative)

- **Area / Files**: `client/hooks/useStockData.ts`
- **Problem**: One hook aggregates quote/fundamentals/insider/news fetch orchestration; unclear which consumers depend on which slice.
- **Solution**: Split into composable hooks per data slice with a thin facade for compatibility.
- **Benefits**: Narrower re-render surface, targeted tests.
- **Strength Badge**: `Speculative`
- **Scope risk**: Every consumer uses the facade; behavior parity must be verified.
