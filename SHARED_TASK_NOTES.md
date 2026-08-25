# Self-Improve Loop — Shared Notes

Quota: 3 iterations. Branch base: `main` (03ab101). Verification: `pnpm test` + `pnpm typecheck` (repo is TS/vitest; pytest/ruff/shadow_run from goal template do not apply).

## Constraint
Working tree on `gflow/improve-skill` carries ~29 dirty WIP files (design sweep) — never stage/commit them; candidates must avoid those paths.

## Ranked candidate backlog (from improve-codebase-architecture exploration)

1. **[DONE → PR #27]** Collapse triplicated symbols-guard chain (`server/routes/stock-data.ts`) + fix unreachable array-reject in `parseSectorMeta`. Strength: Strong.
2. **Yahoo quote normalizer TS↔JS twin drift** — `stockService.ts` `yahooQuote()` guards ms-vs-s epoch on `earningsTimestamp`; `api/_router.js` `normalizeQuote()` multiplies `*1000` unconditionally → year-52k dates on Vercel for ms inputs. Extract shared self-contained `server/services/yahooQuoteShape.ts` + parity spec (pattern: `api/_router.classify.spec.ts`). Strength: Strong.
3. **[DONE → PR #29]** INSIGHTS_UNIVERSES drift — `api/_router.js` hand-copied 3 tabs vs canonical 9 in `server/services/insightsUniverses.ts`; labels now single-sourced via `insightsTabLabels`; parity spec pins lock-step. Known limitation documented: trending tab curated-only serverless (no FMP movers twin).
4. Extract pure metric-mapping core (`extract`, Yahoo quoteSummary→metrics mapper, `classifyFmp`) out of 205-line `getMetrics` into `metricsMapping.ts` + table tests. Strength: Strong (bigger).
5. Pull pure aggregation helpers out of `client/hooks/useStockData.ts` into `client/lib/batchQuotes.ts`. Strength: Worth exploring.
6. Dedupe `isIsoDate`/`isValidDayISO`; `handleFxRates` lenient-parse semantics. Strength: Worth exploring.

## Iteration log
- **Iter 1** ✅ branch `improve/loop-iter-1-symbols-guard`, tag `loop-iter-1-symbols-guard`, PR https://github.com/AI-Degen-69/vantage/pull/27 — CodeRabbit APPROVED, zero actionable comments; 473/473 tests, typecheck clean. Lesson learned: repo has `strictNullChecks:false` → negated boolean-discriminant checks (`!x.ok`) don't narrow; use explicit `=== false`.
- **Iter 2** ✅ branch `improve/loop-iter-2-yahoo-quote-parity`, tag `loop-iter-2-yahoo-parity`, PR https://github.com/AI-Degen-69/vantage/pull/28 — shared `server/services/yahooQuoteShape.ts`; parity spec 8/8, 475/475 total, build clean. First review CHANGES_REQUESTED (1 Minor + 1 Trivial, both valid) → fixed in single batch commit 80c6fdb → re-review APPROVED. Gotcha: `Number(null) === 0` — force direct yield path via `undefined`, and normalizeDividendYield now uses toFiniteNumber so null/'' stay absent.
- **Iter 3** ✅ branch `improve/loop-iter-3-insights-parity`, tag `loop-iter-3-insights-parity`, PR https://github.com/AI-Degen-69/vantage/pull/29 — deleted stale 3-tab INSIGHTS_UNIVERSES copy; Vercel now serves all 9 canonical tabs; labels single-sourced via `insightsTabLabels`. Parity spec 6/6 red→green, suite green, CI green. Self-review clean. ⏳ CodeRabbit review PENDING (hourly quota exhausted at time of push — apply standard protocol when it lands: fix Critical/High/Major + valid points, skip nits, 1 batch commit).

## Quota status: night-run in progress. Completed: iters 1–3 (PRs #27-#29) + 4–9:
- **Iter 4** ✅ PR #30 — metricsMapping pure core. **Stacked on #28**.
- **Iter 5** ✅ PR #31 — earnings-calendar/FX route validation + seams. CodeRabbit round 2: currency-dedupe Major + boundary/mock Minors → fixed in batch d4acce0.
- **Iter 6** ✅ PR #32 — mergeBatchQuoteResponses seam. APPROVED.
- **Iter 7** ✅ PR #33 — kvJsonCache parity tripwire. CodeRabbit CHANGES_REQUESTED (singleton mirror state across retries) → fixed via per-run unique keys f23e439.
- **Iter 8** ✅ PR #34 — symbolsQuery.ts shared parser; SMA twin drift killed (invalid tickers, error strings, dedupe, NaN window). **Stacked on #27**.
- **Iter 9** ✅ PR #35 — earnings calendar implemented on Vercel router (was unconditional `[]` stub — serverless users saw an empty calendar!). CodeRabbit: 12s FMP deadline Major + vacuous cache assertion Minor → fixed batch 9e977bb.
- **Iter 10** ✅ PR #36 — throttledWarn on silent per-item catches (yahoo quote / SMA / FX pairs). CodeRabbit: unbounded `_lastWarned` growth Major (dynamic keys accumulate for process lifetime during outages) → bounded prune past 512 entries + throttle-contract tests. Fixed batch 1f05236.
- **Iter 11** ✅ PR #37 — batch quotes through shared parseSymbolsQuery (was: no cap, no invalid-ticker check, no dedupe serverless-side). **Stacked on #34**.
- **Iter 12** ✅ PR #38 — bounded throttledWarn in stockService (twin of the JS fix). CodeRabbit round 2 caught O(N²) scans + unbounded fresh-sweep growth → amortized sweep + hard-cap oldest-eviction (1d8f6c9), mirrored to _router.js on #36 (e115d30) with a 600-unique-key survival test.

## Branch topology
Off main: #27,#28,#29,#31,#33,#35 · Stacked: #30→#28, #34→#27, #37→#34. Merge order: #27,#28 first, then stacked ones auto-retarget.

## Review status at wrap
APPROVED: #27, #28, #29 ✓(late), #32, #33, #36 ✓(round 2), #38 ✓(round 2). Fixed-post-review awaiting re-review: #30 (2 Majors: ROE/ROA percent normalization + mislabeled P/E & P/S fallbacks removed), #31, #34 (Trivial: observable windowSize), #35, #36 (ordering fix fe585f0), #37 (ordered placeholder test). Pending quota: none outstanding — all 12 PRs reviewed; re-reviews queued on fix pushes.
Protocol when reviews land: fix Critical/High/Major + valid points, skip nits, ONE batch commit each.
Tip: when quota stalls a review, posting `@coderabbitai review` as a PR comment re-queues it (worked for all four stragglers).

## Composition-patterns run (React lens, React 18 → react19 rules N/A)
- **N1** ✅ PR #39 — `presentQuoteRow` seam; killed 3× copy-pasted quote-row derivation. Review round 2 (non-finite pct normalization incl. signal-grid meter) → fixed → **APPROVED**.
- **N2** ✅ PR #40 — `formatMoneyCompact` canonical. Review: formatter-null must map to em-dash at call site → fixed (`?? "—"` on result). Awaiting re-review.
- **N3** ✅ PR #41 — `isProviderStatus` predicate. **APPROVED**, zero comments.

### Remaining composition backlog
1. Insights.tsx triple universe-list render (~470 dup lines incl. two display:none variants) — full consolidation into one variant component exceeds bounded budget; row-seam from N1 is step 1.
2. CompanyProfile 675-line monolith: extract `buildEstimateRows`/`normalizeInsiderRows` to lib + split sections with owned queries (Strong).
3. DataStatusBadge `compact`+`iconOnly` booleans → explicit size enum w/ back-compat shim (9 call sites).
4. fetchJSON duplicate in useEarningsAlerts.ts vs useStockData.ts (needs a lib home decision).
5. TopBar Pill `language` prop → read useI18n() directly (trivial).
6. metricFields precedence helper (`ratios ?? metrics` knowledge ×5 sites) — blocked until StockFundamentalsStrip WIP lands.
