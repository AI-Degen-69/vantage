# Shared Task Notes

Cross-agent improvement backlog. Highest-priority unaddressed candidate feeds the
next loop iteration. New candidates are appended at the bottom.

---

## Iteration 1 — Candidate Cards (generated 2026-09-03)

### Candidate 1 — Dedupe `formatLargeNumber`, fix negative-money rendering (Strong) — ✅ COMPLETED in iteration 1 (PR #54)

> Implemented as `shared/format.ts` + `shared/format.spec.ts`, wired into
> `stockAggregator.ts` (private copy deleted, `$` wrapping removed) and
> `StockSlideOver.tsx` (dead copy deleted). Kept the inherited no-promotion
> tier boundary for parity: 999,999 renders as `$1000.00K`, NOT `$1.00M`.

- **Area / Files**: `shared/format.ts` (new), `server/services/stockAggregator.ts`, `client/components/StockSlideOver.tsx`, `shared/format.spec.ts` (new)
- **Problem**: Two drifted copies of `formatLargeNumber` exist: `StockSlideOver.tsx:13` (client) and `stockAggregator.ts:24` (server). The client copy is dead code (zero call sites). The server copy is live at ~12 call sites, and every caller wraps the result in `` `$${...}` `` — so negative FCF renders as `$-4.80M` (sign after the currency symbol) instead of `-$4.80M`. This is the exact bug class the canonical `client/lib/format.ts` `formatMoney` already fixed client-side ("-$4.80B, not $-4.80B"), still live server-side.
- **Solution**: Extract a canonical `shared/format.ts` with `formatLargeNumber(num, opts?)` — handles negatives with sign-before-`$`, null → "—", 0 → "$0", K/M/B/T tiers with 2 decimals, optional `omit$`for raw volume counts.`stockAggregator.ts`imports it via`@shared/format`(alias already used by server and client) and drops its private copy and hand-rolled`$`wrapping;`StockSlideOver.tsx` deletes its dead copy.
- **Benefits**: Kills a drift vector (this repo has fixed formatMoney drift 3× before: PRs #40, #28, #41), fixes a user-visible rendering bug (negative values inside financial profile blocks), moves a pure formatter to the shared layer where both runtimes can test it.
- **Strength Badge**: `Strong`
- **Scope**: ~3 files, well under 120 changed lines. Machine-decidable: unit specs on tier boundaries (incl. the inherited no-promotion boundary 999,999 → $1000.00K, negatives, null, 0) + full suite green + prettier clean.

### Candidate 2 — Split `client/lib/i18n.tsx` god module (2,566 lines) (Worth exploring) — 🔶 IN PROGRESS: dictionary slice completed in iteration 2 (PR #55)

> Iteration 2 extracted the en/he string tables verbatim into
> `client/lib/i18n/dictionaries.ts` with `i18n.tsx` re-exporting them
> (public API stable, all 39 importers untouched; parity pinned by a new
> dictionaries.spec.ts, including the 10 legitimate Hebrew-dual `_two`
> keys). Remaining slice: plural/ICU/provider logic split — deferred to a
> future iteration.

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

### Candidate 6 — Decide zero-valued metric semantics in stockAggregator (Worth exploring)

- **Area / Files**: `server/services/stockAggregator.ts` (quickStats guards), possibly backend consumers
- **Problem**: Truthiness guards (`marketCap ? ... : "—"`) render a literal `0` as "—" even though `formatLargeNumber` can render `$0`. Flagged by CodeRabbit on PR #54; deliberately deferred because the behavior is pre-existing and changing it alters API response semantics, which exceeds a refactor PR's parity contract.
- **Solution**: Decide whether 0 is meaningful data (e.g., breakeven FCF) or indistinguishable from missing data in these provider feeds. If meaningful, switch guards to `value != null` and add a spec pinning `0 → "$0"` through `aggregateStockData`'s shaping.
- **Benefits**: Correct rendering for edge-case companies; removes a silent truthiness trap for future call sites.
- **Strength Badge**: `Worth exploring`
- **Scope risk**: Semantic change to API output; needs a product call on whether `0` and "no data" are distinguishable in the FMP/Yahoo feeds.

---

## Iteration log

### Iteration 1 (2026-09-03) — completed

- **Candidate implemented**: 1 (canonical `formatLargeNumber`) → PR #54 (`improve/loop-iter-1-format-large-number`, tag `loop-iter-1-20260903-181400`).
- **Verification**: 597/597 tests (58 files, +8 new), `tsc` clean, `pnpm build:server` clean, prettier clean on touched files.
- **CodeRabbit**: 2 Minor findings — backlog card staleness (fixed in this PR), zero-guard semantics (deferred → Candidate 6).
- **Next**: highest-priority unaddressed candidate is 2 (i18n god-module split), needs a bounded slice to fit the ≤3-file loop scope.

### Iteration 2 (2026-09-03) — completed

- **Candidate implemented**: 2, dictionary slice → PR #55 (`refactor/loop-iter-2-i18n-dict-extraction`, tag `loop-iter-2-20260903-184000`). `client/lib/i18n.tsx` 2,566 → 467 lines; dictionaries verbatim into `client/lib/i18n/dictionaries.ts` with stable re-exports.
- **Verification**: 593/593 tests (59 files, +4 new, 0 deleted), `tsc` clean, `pnpm build:client` clean; pre-existing 619-line i18n.spec.ts passes unchanged.
- **CodeRabbit**: APPROVED, zero inline findings.
- **Discovery for next iteration**: the seconds-vs-ms timestamp heuristic (`value < 1e12 ? value * 1000 : value`) is duplicated at 4 sites — `client/lib/finance.ts:198`, `client/lib/formatTimeAgo.ts:49`, `server/services/stockService.ts:729` and `:741`. Same cross-runtime dedupe shape as Candidate 1.
- **Next**: timestamp dedupe (small, bounded) or stockService decomposition (Candidate 3, larger).
