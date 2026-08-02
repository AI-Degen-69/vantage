# Vantage Next Improvements Plan

Status: Implemented and merged to main
Branch: `feature/next-improvements` (merged)
Base: `main`
Starting commit: `87b15eb`
Completion commit: `473e8ed`

## Objective

Improve Vantage in three connected workstreams:

1. Reduce market-data latency and upstream request pressure.
2. Make the Insights sector heatmap complete and trustworthy when provider data is partial.
3. Reduce the initial browser JavaScript payload through route-level code splitting.

All three workstreams were implemented and merged to main as of commit 473e8ed.

## Why this sequence

The data layer is the shared dependency for Insights, watchlists, earnings, portfolios, and stock pages. Stabilizing request behavior first prevents the heatmap and UI changes from being evaluated against avoidable provider noise. The heatmap then consumes the stabilized data path and curated metadata. Bundle splitting is last because it changes route loading behavior without changing the data contract, making it safer once the feature surface is stable.

```text
CURRENT
  Client routes -> API hooks -> stockService -> Yahoo/FMP/AV
  Insights -> symbols -> batch quotes + heatmap -> profile/chart fan-out
  Initial App import -> every page + chart dependencies in one bundle

WORKSTREAM 1: DATA RELIABILITY
  request coalescing + correct stable batch endpoint
  bounded fallback fan-out + negative/error cache policy
  explicit partial result semantics + service tests

WORKSTREAM 2: HEATMAP QUALITY
  curated sector metadata -> server aggregation
  provider sector lookup only as fallback
  coverage/partial state preserved in response and UI

WORKSTREAM 3: INITIAL LOAD PERFORMANCE
  lazy page imports + localized Suspense fallback
  route/error-boundary verification
  chunk-size measurement

12-MONTH IDEAL
  predictable provider usage, honest data provenance,
  fast first paint, and a measurable freshness/coverage contract
```

## Existing leverage

| Sub-problem | Existing code to reuse |
|---|---|
| Upstream request timeout and throttled logging | `server/services/stockService.ts` `fetchJSON`, `throttledWarn` |
| Per-symbol and aggregate caches | `server/services/stockService.ts` NodeCache entries and TTLs |
| Input validation and max symbol bounds | `server/routes/stock-data.ts` `parseTicker`, `parseSymbolList`, `MAX_SYMBOLS` |
| Typed response contracts | `shared/api.ts` `BatchQuoteResponse`, `SectorHeatmapResponse`, `InsightsTabResponse` |
| Sector aggregation math | `shared/aggregateSectorHeatmap.ts` and `shared/aggregateSectorHeatmap.spec.ts` |
| React Query stale/loading behavior | `client/hooks/useStockData.ts` |
| Existing loading/error/partial UI patterns | `client/pages/Insights.tsx`, `client/components/SectorHeatsheet.tsx` |
| Existing localized dictionaries and key audit | `client/lib/i18n.tsx`, `client/locales/en/translation.json`, `client/locales/he/translation.json` |
| Existing route-level error boundaries | `client/App.tsx` |
| Existing production size signal | `pnpm build`, currently ~906.71 kB main JS chunk |

## Workstream 1: Market-data request reliability

### Problem

With `FMP_USE_STABLE=1`, the documented FMP batch shape is `batch-quote?symbols=A,B,C`, while `stockService.getBatchQuotes` still probes the old path shape and then falls back to one Yahoo request per symbol. Repeated concurrent calls can also duplicate upstream work before cache entries are populated. Profile failures are not cached, so a degraded provider can be retried on every request.

### Outcome

A batch request returns the same ordered `(StockQuote | null)[]` contract, but uses the active provider shape, shares in-flight work, bounds fallback concurrency, and makes provider outages visible without turning one unavailable quote into a whole-request failure.

### Likely files

- `server/services/stockService.ts`
- `server/routes/stock-data.ts` only if response metadata needs to expose coverage
- `shared/api.ts` if a typed coverage/status field is needed
- `docs/endpoints.md`
- New service tests near the server service layer, or an extracted pure helper test if direct network mocking is not established
- `scripts/smoke.mjs` for the live smoke assertions

### Scope

1. Add one explicit active-provider batch URL builder. For stable FMP, use `batch-quote?symbols=...`; retain the legacy v3 path only for the legacy mode.
2. Add an in-flight promise map for quote, profile, chart, and heatmap work where duplicate concurrent calls are possible. Remove entries in `finally` so rejects cannot poison future requests.
3. Cache known-unavailable results briefly, separately from healthy data. Do not cache permanent `null` semantics longer than the chosen outage TTL.
4. Keep fallback concurrency bounded and preserve requested order plus `null` placeholders.
5. Keep provider credentials server-side and avoid exposing upstream error details to clients.
6. Add structured, throttled diagnostics that distinguish provider HTTP failure, timeout, invalid/empty payload, and fallback exhaustion.
7. Define whether the API returns only the existing shape or adds a small typed coverage field. Prefer the existing shape unless the UI cannot honestly represent partial results without metadata.

### Data flow

```text
GET /api/stock-batch-quotes
  -> validate symbols
  -> service batch cache
  -> in-flight promise cache
  -> FMP stable batch OR legacy FMP batch
  -> normalize rows
  -> bounded Yahoo fallback for misses
  -> ordered quotes with nulls
  -> cache result + response
```

### Failure modes

| Failure | Service behavior | Client behavior | Test |
|---|---|---|---|
| Empty symbol list | 400 before service | Existing error contract | Route test or pure parser test |
| Invalid ticker | 400 with invalid list | Existing error contract | Existing/expanded route validation test |
| FMP 404/402/429 | Throttled diagnostic; use fallback | Partial live state, no secret/provider detail | Mock provider response |
| FMP timeout | Abort, diagnostic, fallback | Partial live state | Timeout mock |
| Yahoo miss for one symbol | Preserve `null` at that position | Existing `—`/partial indicator | Ordered result test |
| All providers miss | Return ordered nulls, short negative cache | Mock/empty status as current conventions require | All-miss test |
| Concurrent duplicate batch | One upstream operation, shared result | No visible change except lower latency | Promise coalescing test |
| Provider payload malformed | Reject row, do not fabricate price | Null/partial status | Normalizer test |
| Navigate or retry during in-flight request | Abort client fetch where available; finally clean server map | Query retry remains bounded | Hook/query test if practical |

### Acceptance criteria

- Stable FMP no longer deliberately probes the known-wrong batch path.
- Concurrent identical requests do not multiply upstream calls.
- A single missing quote does not erase successful quotes for other symbols.
- A provider outage does not cause an unbounded retry loop.
- No API key appears in client output or error responses.
- Tests cover success, empty, malformed, timeout, provider failure, fallback, ordering, and coalescing.

## Workstream 2: Insights heatmap data quality

### Problem

`getSectorHeatmap` fans out to `getChart` and `getProfile` for each ticker. The Insights universe already contains curated sector tags, but the heatmap request currently sends only symbols. If FMP profile coverage fails, the heatmap loses sector assignments and may appear empty despite the client already knowing the sectors.

### Outcome

The heatmap uses curated sector metadata as the trusted universe-level fallback, uses provider data only when curated metadata is absent, reports contribution coverage honestly, and avoids unnecessary profile calls for symbols with known sectors.

### Likely files

- `shared/api.ts`
- `server/routes/stock-data.ts`
- `server/services/stockService.ts`
- `client/hooks/useStockData.ts`
- `client/pages/Insights.tsx`
- `client/components/SectorHeatsheet.tsx`
- `shared/aggregateSectorHeatmap.ts` and tests
- Both translation dictionaries if visible status copy changes

### Scope

1. Extend the heatmap request contract with an optional validated symbol-to-sector map or a compact entries payload.
2. Enforce ticker validation and a strict size bound on metadata, reusing the existing symbol parser and max count.
3. Prefer curated sector tags for the requested Insights universe; use provider profile sectors only for missing tags.
4. Include source/coverage semantics in the server result only if the current `withPrice`, `total`, `untagged`, and loading states cannot express the truth.
5. Preserve the existing aggregation math and cache correctness. Include normalized metadata in the heatmap cache key.
6. Make the UI distinguish: no rows yet, rows with partial ticker contribution, and no sector assignment.
7. Add EN/HE translations for any new visible text.

### Data flow

```text
Insights tab response
  -> entries [{symbol, name, sector}]
  -> batch quotes
  -> heatmap request {symbols, sectors?}
  -> server validates metadata
  -> chart history per symbol
  -> sector = curated tag || provider profile tag || untagged
  -> aggregate daily moves
  -> rows + untagged + contribution counts
  -> localized heatmap status
```

### Acceptance criteria

- Heatmap sectors remain grouped when FMP profiles are unavailable but the Insights universe has sector tags.
- A malicious or oversized metadata payload is rejected or safely ignored without changing symbol validation guarantees.
- Heatmap caches never reuse a response for a different sector mapping.
- Missing prices remain visibly partial rather than being treated as zero.
- English and Hebrew show equivalent coverage/empty/loading meaning.
- Existing aggregation tests remain green and new precedence/cache-key cases are covered.

## Workstream 3: Route-level bundle splitting

### Problem

`client/App.tsx` statically imports every page. The production build reports a ~906.71 kB main JS chunk, including route-specific chart and portfolio dependencies for users who have not visited those routes.

### Outcome

The home shell loads quickly, each feature route loads its own page chunk on demand, and loading/error behavior remains localized and accessible.

### Likely files

- `client/App.tsx`
- `client/pages/*` only if a route import has a special dependency issue
- `client/components/Skeleton.tsx` or a small shared route fallback
- `client/lib/i18n.tsx` only if the fallback needs a new localized key
- `vite.config.ts` only if measured chunking needs a narrow configuration adjustment

### Scope

1. Replace static non-shell page imports with `React.lazy` imports.
2. Wrap route content in a shared `Suspense` fallback using existing skeleton conventions.
3. Keep the existing route-level `ErrorBoundary` so lazy-load failures and render failures remain recoverable.
4. Verify direct navigation, back/forward navigation, language switching, and route transitions in both LTR and RTL.
5. Measure initial and route chunk sizes before and after. Do not change bundler strategy unless measurement proves it is needed.
6. Add no new dependency.

### Acceptance criteria

- Initial bundle is materially smaller than the current 906.71 kB main chunk.
- Every route still renders through the existing layout and error boundary.
- Direct URL loads work in dev and production server mode.
- Loading fallback is localized, keyboard-safe, and not a blank screen.
- Build output confirms route chunks rather than one monolithic page chunk.

## Sequencing and delivery

### Slice 1: Data reliability

Implement Workstream 1, add tests, update endpoint documentation and smoke assertions. Run the full validation suite and reviewer before moving to the heatmap.

### Slice 2: Heatmap quality

Implement Workstream 2 on the stabilized batch/data contract. Add aggregation and request-contract tests, update translations/UI states, run full validation and reviewer.

### Slice 3: Bundle splitting

Implement Workstream 3 after the data contract settles. Measure bundle output, manually verify route loading, run full validation and reviewer.

Each slice remains uncommitted until explicitly requested. No push, merge, PR, or deployment is part of this plan.

## Cross-cutting validation

For each approved slice:

```text
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Also run focused tests for the changed pure/service logic and inspect the final diff. Significant changes receive a reviewer pass.

## NOT in scope

- Replacing Yahoo Finance, FMP, or Alpha Vantage.
- Introducing a database, background job queue, observability vendor, or new API gateway.
- Rewriting the stock service or React Query layer.
- Authentication, user accounts, or server-side portfolio persistence.
- Committing, pushing, merging, opening a PR, or deploying.
- Broad visual redesign unrelated to the heatmap states or route loading fallback.

## Premise gate

The plan assumes:

1. The three audited issues are still the highest-value next improvements after the clean baseline audit.
2. Market-data request efficiency should be fixed before heatmap metadata and bundle splitting.
3. Curated Insights sector tags are acceptable as universe metadata when provider sectors are unavailable, provided the UI labels coverage honestly.
4. Route-level lazy loading is preferable to a broader bundler rewrite for this React/Vite app.

Premises confirmed by the user on 2026-08-02. No application code is authorized by premise confirmation alone; the final autoplan approval gate remains open.

## Phase 1: CEO / strategy review

### Premise challenge

1. **The three issues are high-value.** Confirmed baseline validation is healthy (`pnpm typecheck`, `pnpm test` with 206 tests, and `pnpm build` pass), while the audit found a 906.71 kB client entry chunk, avoidable provider fan-out, and heatmap sector loss when profiles are unavailable. This is a reasonable product order, but Workstream 1 must prove it reduces actual active-path work rather than only changing an endpoint string.
2. **Data reliability precedes heatmap quality.** Accepted. Both features share `stockService`, cache behavior, and provider fallbacks. Changing the heatmap first would make it harder to tell whether missing sectors came from metadata or upstream instability.
3. **Curated sector tags are acceptable fallback metadata.** Accepted with an honesty constraint: curated tags describe the editorial universe, not provider-confirmed company classification. The UI must expose coverage/provenance when it matters.
4. **Route-level lazy loading is preferable to a bundler rewrite.** Accepted. `client/App.tsx` statically imports all pages, and Vite already supports route chunks without a new dependency. A bundler rewrite is deferred unless measurement proves lazy loading cannot reach the target.
5. **Stable FMP batch is available.** The repository documentation says `batch-quote?symbols=A,B,C` was observed, while the current service explicitly skips stable batch. This is not a premise to trust blindly. Phase 1 therefore adds a provider-contract verification prerequisite: record endpoint status, plan tier, response shape, and a rollback path before enabling it.

### Existing code leverage

| Problem | Existing leverage | Review conclusion |
|---|---|---|
| Batch request validation | `parseSymbolList`, `MAX_SYMBOLS` in `server/routes/stock-data.ts` | Reuse; add route tests rather than a second validator. |
| Timeout and warning behavior | `fetchJSON`, `throttledWarn` in `server/services/stockService.ts` | Extract classification without exposing provider details. |
| Per-symbol cache | NodeCache entries in `stockService.ts` | Keep healthy and negative entries typed and separately timed. |
| Heatmap math | Pure `aggregateSectorHeatmap` in `shared/` | Preserve; add metadata-precedence tests around it. |
| Client query behavior | `useBatchQuotes`, `useSectorHeatmap` | Add canonical keys and explicit error/partial state. |
| UI vocabulary | `SectorHeatsheet`, existing i18n dictionaries and key audit | Reuse, but remove hardcoded touched strings. |
| Route recovery | `ErrorBoundary` in `client/App.tsx` | Preserve around lazy routes and add a localized Suspense fallback. |

### Dream-state delta

```text
CURRENT                         THIS PLAN                         12-MONTH IDEAL
provider calls can duplicate   canonical work + bounded fallbacks   provider SLOs and cost/freshness dashboard
partial rows look like nulls    explicit coverage/provenance        user can trust every number's source
heatmap asks profiles again     curated tags avoid known lookups    sector taxonomy is versioned and auditable
all pages load at startup       route chunks load on demand         measured fast first paint on slow mobile
```

The plan does not build the 12-month observability dashboard, versioned taxonomy, or broker-grade data provenance. Those remain deliberate follow-up work, not silent promises.

### Implementation alternatives

| Decision | Approach A | Approach B | Decision |
|---|---|---|---|
| Batch provider path | Enable verified stable `batch-quote`; fallback per missing symbol | Keep Yahoo single-quote fan-out and only add coalescing | A if live contract verification passes; otherwise B. This is a feasibility gate, not a blind migration. |
| Work coalescing | Per-operation typed in-flight maps with canonical keys | One generic promise cache abstraction | Choose typed maps. More explicit, easier to audit, and avoids mixing result/TTL semantics. |
| Partial API contract | Keep `quotes: (StockQuote or null)[]` and derive counts client-side | Add `coverage`/`source` metadata | Keep current shape for Slice 1 unless the UX cannot distinguish outage/not-found. Revisit with evidence. |
| Heatmap metadata | Compact symbol-to-sector map in request | New universe endpoint or server-owned duplicate taxonomy | Choose compact validated metadata. No new endpoint or database. |
| Bundle performance | React.lazy + Suspense | Rollup manual chunks/bundler rewrite | Choose React.lazy first; measure before escalating. |

### Temporal interrogation

- **Hour 1:** Add provider seam and URL/key pure helpers; write failing tests for stable/legacy URL selection, ordered normalization, and in-flight cleanup.
- **Hour 2-3:** Implement batch/fallback and negative cache semantics; verify mixed success/miss behavior and route safety.
- **Hour 4:** Run focused tests and inspect diagnostics. If stable provider verification fails, retain the legacy/Yahoo path and ship coalescing/negative caching without forcing an unavailable endpoint.
- **Hour 5-6:** Run the full validation suite and reviewer. Record measured upstream calls, latency, coverage, and any threshold miss before Slice 2.
- **After Slice 1:** Do not start heatmap work if the service contract is unstable or tests cannot isolate provider calls.

### CEO decisions

- **Mechanical:** preserve ordering/null placeholders; verify the active provider contract; keep secrets server-side; bound fallback concurrency; test failure paths.
- **Taste:** whether to add coverage metadata; whether to use verified FMP batch versus optimized Yahoo fallback; whether to ship bundle splitting as Slice 3 or independently after Slice 1. The plan recommends current sequencing because data changes have the widest blast radius.

## Phase 2: Design review

Classifier: **App UI**. Vantage is a dense, task-focused terminal, not a marketing landing page. The existing dark terminal vocabulary, compact tables, and restrained accent colors are the design system to preserve. No `DESIGN.md` exists, so this review uses the existing components and tokens as the source of truth.

### Design scorecard

| Pass | Initial | Reviewed target | Findings / decision |
|---|---:|---:|---|
| 1. Information architecture | 7/10 | 9/10 | Insights hierarchy is sound: tab/universe first, quote coverage second, heatmap as market context, cards last. Add a compact coverage line near the heatmap instead of making users infer denominator from tooltips. |
| 2. Interaction states | 4/10 | 9/10 | Current `SectorHeatsheet` returns `null` for no rows and `Insights` ignores quote/heatmap errors. Add explicit loading, empty, success, stale, partial, provider-error, and retry states. |
| 3. User journey | 6/10 | 8/10 | The user should move from orientation to scan to drill-down without a blank gap. Preserve previous data during refetch, explain partial rows, and offer retry only where recovery is possible. |
| 4. AI slop risk | 8/10 | 8/10 | The existing terminal UI avoids the common marketing/card-grid traps. Do not add decorative cards, gradients, or generic “data unavailable” panels for these slices. |
| 5. Design-system alignment | 6/10 | 8/10 | Reuse `SectorHeatsheet`, skeleton classes, `ErrorBoundary`, and existing tokens. New state copy must go through both dictionaries. |
| 6. Responsive/accessibility | 5/10 | 8/10 | Specify horizontal overflow for the dense heatmap, 44px minimum interactive targets, visible focus, `role=status` for loading, and LTR direction for dates/tickers/numbers in Hebrew. |
| 7. Unresolved decisions | 4/10 | 8/10 | Resolve retry placement, stale-data disclosure, coverage wording, and lazy-chunk failure recovery in implementation acceptance criteria. |

### Information hierarchy and state contract

```text
INSIGHTS VIEW
  1. Universe tabs + search + live coverage badge
  2. Heatmap title + date range + coverage/provenance disclosure
  3. Heatmap grid or state-specific panel
  4. Ticker cards with price and market-cap context
  5. Drill-down navigation to /stock/:ticker
```

| Feature | Loading | Empty | Error | Success | Partial/stale |
|---|---|---|---|---|---|
| Quotes | Existing skeleton cards; no false zeroes | Curated names with `[MOCK]`/no-live state | Inline “prices unavailable” with retry | Live count and price cards | `n/m LIVE`, retain prior cards while fetching |
| Heatmap | Fixed-height skeleton | Explain “not enough priced history” and keep cards usable | Inline provider-error copy and retry | Grid with dates, counts, and source disclosure | Keep old grid, amber stale/fetching marker, untagged count |
| Lazy route | Localized non-blank status with `role=status` | N/A | Existing error boundary with reload/retry | Route page | No layout collapse during chunk load |

Visible strings currently hardcoded in `SectorHeatsheet.tsx` (`loading…`, `untagged`, `symbol(s)`) must be translated when touched. The design task is not a visual redesign; it is making state meaning explicit.

### Design implementation tasks

- **D1 P1:** Add explicit heatmap coverage/error/empty states and retry semantics. Files: `client/pages/Insights.tsx`, `client/components/SectorHeatsheet.tsx`, both locale files. Verify with state fixtures and i18n audit.
- **D2 P1:** Replace touched hardcoded status strings with EN/HE keys and preserve `dir="ltr"` for numeric/ticker/date content. Files: `SectorHeatsheet.tsx`, locale files. Verify `pnpm test` i18n audit.
- **D3 P2:** Define a shared route Suspense fallback with `role="status"`, visible focus-safe markup, and layout stability. Files: `client/App.tsx`, optionally `client/components/Skeleton.tsx`. Verify direct navigation and keyboard smoke checks.

## Phase 3: Engineering review

### Scope challenge and corrections

The current implementation verifies the main risks:

- `getBatchQuotes` at `server/services/stockService.ts:636-680` preserves order, but stable mode intentionally skips FMP batch and a partial FMP array is mapped to null without per-symbol fallback.
- `getProfileValidation` at `:686-695` caches successful profiles only; a provider outage is retried on every call and cache reads cannot distinguish unavailable from not-found.
- `useSectorHeatmap` at `client/hooks/useStockData.ts:454-471` sends symbols only, while `Insights.tsx:80-91` already has `entry.sector` available.
- `SectorHeatsheet.tsx:104-180` has hardcoded visible status strings and hides empty/error heatmap states.
- `App.tsx:13-23` statically imports all pages; route-level splitting is feasible without changing server architecture.

The plan is expanded to include provider seams, typed cache/in-flight keys, explicit route contracts, and deterministic tests. It does not add a database, queue, or observability vendor.

### Dependency graph

```text
React route
  -> useBatchQuotes / useSectorHeatmap
  -> /api route validation
  -> stockService operation
       -> healthy cache lookup
       -> typed in-flight map
       -> provider adapter (FMP/Yahoo/AV)
       -> normalizer + ordered remap
       -> bounded fallback
       -> healthy or negative cache
  -> typed response
  -> state-aware UI + localized copy

Insights entries {symbol, sector}
  -> validated compact sector metadata
  -> heatmap aggregation
  -> coverage/untagged disclosure
```

### Test coverage map

```text
[ROUTE] /api/stock-batch-quotes
  ├─ empty/invalid/duplicate/over-limit input [GAP -> route test]
  ├─ service success + ordered rows [GAP -> service contract test]
  └─ service rejection/no secret leakage [GAP -> route test]
[SERVICE] getBatchQuotes
  ├─ stable/legacy URL [GAP -> pure URL test]
  ├─ complete payload [GAP -> normalizer test]
  ├─ partial payload -> per-symbol fallback [GAP -> provider seam test]
  ├─ null/malformed/timeout/HTTP failure [GAP -> classification tests]
  ├─ canonical concurrent calls + rejection cleanup [GAP -> in-flight tests]
  └─ positive/negative cache expiry [GAP -> fake-timer tests]
[HEATMAP]
  ├─ curated > provider > untagged precedence [existing math + GAP contract test]
  ├─ missing prices stay null [existing aggregation coverage]
  ├─ cache key includes metadata [GAP -> key test]
  └─ UI loading/empty/error/partial/stale [GAP -> pure state/component test]
[ROUTING]
  ├─ lazy chunk emission [GAP -> build artifact check]
  ├─ direct route load and back/forward [GAP -> browser smoke]
  └─ chunk failure -> ErrorBoundary recovery [GAP -> route/browser test]

Coverage before implementation: pure aggregation is tested; all new service,
route, UI-state, and chunk behaviors require tests listed above.
```

### Failure modes registry

| Failure mode | Detection | Rescue | User-visible result | Critical? |
|---|---|---|---|---|
| Stable endpoint unavailable/paid-gated | provider status + contract test | retain legacy/Yahoo path; short negative cache | partial live state, no upstream detail | Yes, feasibility gate |
| FMP partial/malformed payload | schema/normalizer result | fallback only missing symbols; preserve nulls | `n/m LIVE` | Yes |
| Concurrent duplicate request | in-flight hit counter/test | share promise, delete in `finally` | lower latency only | Yes |
| Provider timeout/429 | classified fetch result | bounded fallback and retry policy | stale/partial state with retry | Yes |
| Profile failure cached incorrectly | typed availability sentinel | short negative cache then recovery | provider-error/untagged disclosure | Yes |
| Heatmap metadata invalid/oversized | route validation | reject safely without provider call | localized request error | Yes |
| Lazy chunk fails | ErrorBoundary | reload/retry control | recoverable route error, no whole-app white screen | Yes |
| i18n key missing | static key audit | test failure before ship | no untranslated production copy | No, but blocks slice |

### Engineering decisions

- **Mechanical:** typed provider seam; canonical keys; `finally` cleanup; bounded concurrency; negative-cache expiry; route validation; deterministic tests; no secret leakage.
- **Taste:** coverage metadata stays optional; typed per-operation maps beat a generic cache; provider batch is enabled only after verification; route splitting stays last unless measured risk changes.

### Engineering implementation tasks

- **E1 P1:** Add provider adapter/seam, URL builders, classification, canonical in-flight maps, and test reset hooks. Files: `server/services/stockService.ts`, new server/pure tests. Verify focused Vitest tests.
- **E2 P1:** Implement partial-batch per-symbol fallback, ordered remapping, typed negative caches, and rejection cleanup. Files: `server/services/stockService.ts`, `shared/api.ts` only if needed. Verify provider failure matrix.
- **E3 P1:** Add route contract tests and secret-safety assertions. Files: `server/routes/stock-data.ts`, route test/app factory files. Verify invalid/oversized/service-error responses.
- **E4 P2:** Add heatmap metadata precedence/cache-key tests before Slice 2. Files: `shared/aggregateSectorHeatmap.spec.ts`, service/route tests. Verify curated/provider/untagged cases.
- **E5 P2:** Add build and browser smoke checks for route chunks and lazy-load recovery in Slice 3. Files: `client/App.tsx`, test/smoke scripts as appropriate. Verify 25% entry reduction target.

## Phase 3.5: DX review

Product type: developer-owned React/TypeScript application with a server-side provider integration. Primary persona: a solo developer or small product engineer debugging market-data behavior locally and deploying through the existing Vite/Express build.

### Developer journey map

| Stage | Developer action | Current friction | Plan response |
|---:|---|---|---|
| 1 | Clone and install | PNPM requirement is documented in knowledge, less visible in repo docs | Keep `packageManager`; add plan command notes to endpoint docs if touched. |
| 2 | Start dev server | One-port Vite/Express is a strength | Preserve; no new service. |
| 3 | Configure keys | Provider flags and tier behavior are easy to misunderstand | Document env matrix, endpoint status, fallback order, rollback. |
| 4 | Open Insights | Data may be partial without a clear reason | Add coverage/provenance states. |
| 5 | Read server logs | `fetchJSON` collapses error classes | Add structured fields: operation, provider, failure class, count, duration, fallback. |
| 6 | Run deterministic tests | No existing server service test seam | Add adapter/reset seam and focused tests. |
| 7 | Run full validation | Commands are known but smoke is live-network dependent | Separate deterministic suite from optional smoke. |
| 8 | Deploy | Build has large entry warning and route behavior risk | Measure chunks and verify direct routes. |
| 9 | Recover from outage | No documented rollback or provider disable path | Document `FMP_USE_STABLE` rollback and expected degraded UI. |

### Developer empathy narrative

“I changed one provider URL and now I need to know whether the endpoint is real, paid-gated, malformed, or simply slow. I should be able to run deterministic tests without Yahoo or FMP, see which fallback fired, and understand exactly what the user will see. If I deploy a lazy route and it fails, the app should give me a recoverable screen instead of forcing me to infer a blank page from the browser console.”

### DX scorecard

| Dimension | Score | Review finding |
|---|---:|---|
| 1. Getting started | 8/10 | Existing scripts are clear; provider env setup and live-vs-unit test distinction need docs. |
| 2. API ergonomics | 7/10 | Route names are consistent, but batch and heatmap contracts need explicit canonicalization/coverage docs. |
| 3. Errors/debugging | 4/10 | Current fetch logging does not classify timeout, HTTP, malformed JSON, or fallback exhaustion. |
| 4. Documentation/learning | 6/10 | `docs/endpoints.md` is useful but contains known TODO-style drift and needs rollback/runbook details. |
| 5. Upgrade/migration | 6/10 | Stable/v3 switch exists, but endpoint verification and rollback are not encoded as a tested matrix. |
| 6. Environment/tooling | 7/10 | PNPM/Vite integration is good; provider mocks and cache reset are missing. |
| 7. Community/ecosystem | 5/10 | No public integration surface is in scope; document provider assumptions for future contributors. |
| 8. Measurement/feedback | 3/10 | No latency/call-count baseline is stored; add a repeatable measurement procedure, not a vendor. |
| **Overall** | **6/10** | Good local shape, weak provider observability and recovery documentation. |

TTHW (time to hello world): about 5 minutes for a developer who knows PNPM, about 15 minutes for a new contributor who needs provider keys. Target: under 10 minutes for deterministic tests and local UI, with live keys explicitly optional.

### DX implementation tasks

- **X1 P1:** Update `docs/endpoints.md` with stable/legacy endpoint matrix, tested tier/status, env flags, fallback order, cache policy, diagnostic fields, and rollback instructions. Verify a new contributor can follow it without reading `stockService.ts`.
- **X2 P1:** Document deterministic test setup versus optional `scripts/smoke.mjs`, including credentials, network dependency, timeout, and expected failure interpretation. Files: `docs/endpoints.md`, possibly `README` if present. Verify copy-paste commands.
- **X3 P2:** Add a small measurement recipe for three cold/ten warm 30-symbol samples, reporting median/p95 latency, upstream calls, fallback count, cache hits, and quote coverage. Files: docs or smoke helper. Verify output is actionable without provider secrets.
- **X4 P2:** Ensure errors contain problem, cause category, safe recovery action, and relevant operation context without upstream credentials. Verify with failure tests.

## NOT in scope after review

- Replacing providers, adding a database/queue/observability vendor, or rewriting React Query.
- Building a new taxonomy service or broker integration.
- Adding full browser E2E infrastructure solely for this plan; use the existing test stack plus focused smoke checks unless implementation proves a harness is required.
- Building the 12-month freshness/provenance dashboard now; record metrics first.
- Broad visual redesign, marketing pages, authentication, persistence, deployment, commits, pushes, merges, PRs, or releases.

## Decision audit trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---:|---|---|---|---|---|---|
| 1 | CEO | Use SELECTIVE EXPANSION | Mechanical | P2 | Preserve the three user-selected workstreams while adding only in-blast-radius safeguards. | Full rewrite / scope reduction |
| 2 | CEO | Keep data → heatmap → bundle sequence | Taste | P1/P2 | Shared data behavior is a dependency; bundle work is independent but safer after contracts settle. | Parallel implementation |
| 3 | CEO | Verify stable FMP before enabling | Mechanical | P1/P6 | Docs and code disagree; feasibility must be demonstrated before changing provider behavior. | Blind endpoint switch |
| 4 | CEO | Do not add a database, queue, or vendor | Mechanical | P3/P5 | No need for new infrastructure to solve request coalescing and cache semantics. | Infrastructure expansion |
| 5 | Design | Add explicit heatmap state table | Mechanical | P1/P5 | Current empty/error behavior is indistinguishable and would leave users guessing. | Silent null/blank state |
| 6 | Design | Reuse terminal vocabulary, no visual redesign | Mechanical | P4/P5 | Existing UI already has a coherent dense terminal language. | Generic dashboard cards |
| 7 | Design | Localize all touched visible status copy | Mechanical | P1 | The app is bilingual and the i18n audit already exists. | New hardcoded strings |
| 8 | Engineering | Use typed per-operation in-flight maps | Taste | P5/P3 | Explicit keys/return types are easier to inspect than a generic abstraction. | Generic promise cache |
| 9 | Engineering | Preserve current response shape by default | Taste | P3 | Avoid contract churn unless client state cannot be honest without metadata. | Mandatory coverage schema |
| 10 | Engineering | Add deterministic provider seam before network tests | Mechanical | P1/P5 | Existing tests are pure; live smoke cannot prove failure semantics. | Network-only tests |
| 11 | Engineering | Add route tests and secret-safety assertions | Mechanical | P1 | Route handlers are a public boundary and currently have no focused tests. | Service-only coverage |
| 12 | DX | Keep smoke optional, deterministic tests mandatory | Mechanical | P1/P3 | Smoke depends on credentials/network and is brittle by design. | Treat smoke as unit coverage |
| 13 | DX | Measure actual latency/call-count/coverage | Mechanical | P1/P6 | “Materially faster” and “fewer calls” need reproducible evidence. | Single anecdotal run |
| 14 | Cross-phase | Require 25% initial-entry reduction for Slice 3 | Taste | P1/P3 | A measurable target prevents a lazy-loading change that adds complexity without user value. | Unbounded “materially smaller” |

## Review scores and voice availability

- **CEO:** 8/10 after review. Strategy is sound with the stable-provider verification gate and measurable outcomes added.
- **CEO voices:** Claude/Gemini-style independent review flagged the stable endpoint premise, missing thresholds, and partial-batch semantics. Codex CLI was available but the outside-voice command timed out after 180 seconds; no Codex consensus is claimed.
- **Design:** 8/10 after the state, localization, responsive, and accessibility requirements above. No `DESIGN.md`; existing UI patterns are the reference.
- **Design voice:** repository-backed review identified missing error/empty states and hardcoded touched strings. Codex unavailable by timeout.
- **Engineering:** 8/10 after provider seams, route contracts, cache semantics, failure registry, and test artifact additions.
- **Engineering voice:** repository-backed review verified the batch partial-fallback gap, profile negative-cache gap, heatmap metadata gap, and static route imports. Codex unavailable by timeout.
- **DX:** 6/10. The app is easy to start but provider configuration, diagnostics, deterministic test seams, and measurement docs need work.
- **DX voice:** repository-backed review identified the missing provider runbook, smoke/unit distinction, error taxonomy, and measurement loop. Codex unavailable by timeout.

## Cross-phase themes

1. **Provider contract must be explicit:** CEO, engineering, and DX independently flagged the mismatch between `docs/endpoints.md` and `getBatchQuotes`.
2. **Partial data must be honest:** CEO/design/engineering all flagged that nulls, empty heatmaps, and profile failures currently collapse distinct user experiences.
3. **Deterministic measurement beats live smoke:** engineering and DX both require a provider seam and repeatable latency/call-count/coverage measurement.
4. **No new infrastructure is needed:** all phases favor explicit local changes over a database, queue, or observability vendor.

## Implementation tasks aggregated across phases

- [ ] **E1 (P1, human: ~1 day / CC: ~20 min)** — stock service — Add provider seam, URL builders, typed error classification, and canonical in-flight maps. Files: `server/services/stockService.ts`, focused service tests. Verify deterministic provider mocks and rejection cleanup.
- [ ] **E2 (P1, human: ~1 day / CC: ~20 min)** — batch quotes — Implement verified stable/legacy selection, partial-row fallback, ordered remapping, and typed negative caches. Files: `server/services/stockService.ts`, `docs/endpoints.md`. Verify success/failure/timeout/order tests.
- [ ] **E3 (P1, human: ~4h / CC: ~10 min)** — API routes — Add route contract and secret-safety tests. Files: `server/routes/stock-data.ts`, route test seam. Verify invalid/over-limit/provider-error responses.
- [ ] **D1 (P1, human: ~4h / CC: ~10 min)** — heatmap UI — Add explicit loading/empty/error/partial/stale states and retry semantics. Files: `client/pages/Insights.tsx`, `client/components/SectorHeatsheet.tsx`, both locale files.
- [ ] **X1 (P1, human: ~3h / CC: ~10 min)** — provider docs — Document endpoint matrix, tier verification, env flags, fallback order, diagnostics, rollback, and smoke/unit distinction. Files: `docs/endpoints.md`.
- [ ] **E4 (P2, human: ~4h / CC: ~10 min)** — heatmap contract — Pass curated sectors, validate metadata, include metadata in cache keys, and test precedence. Files: `shared/api.ts`, `server/routes/stock-data.ts`, `server/services/stockService.ts`, `client/hooks/useStockData.ts`, `client/pages/Insights.tsx`, aggregation tests.
- [ ] **D2 (P2, human: ~1h / CC: ~5 min)** — localization — Replace touched hardcoded status strings and preserve RTL numeric direction. Files: `SectorHeatsheet.tsx`, EN/HE dictionaries.
- [ ] **E5 (P2, human: ~4h / CC: ~10 min)** — bundle splitting — Lazy-load routes, add accessible localized Suspense fallback, and verify ErrorBoundary recovery. Files: `client/App.tsx`, optional shared fallback.
- [ ] **X3 (P2, human: ~2h / CC: ~5 min)** — measurement — Add repeatable 30-symbol cold/warm measurement recipe and record the 25% entry-size gate. Files: docs/smoke helper as needed.

## Deferred TODOs

- Versioned sector taxonomy and a freshness/provenance dashboard: deferred because it needs product/data ownership beyond these slices.
- Full browser E2E harness: deferred because the repository has no browser test dependency; add only if focused route smoke cannot verify lazy-load recovery.
- Provider health metrics/alerts: deferred because a vendor or dashboard is outside this branch; first emit structured diagnostics and measure locally.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| CEO Review | `/autoplan` | Scope and strategy | 1 | issues_open | Stable-provider verification, measurable product thresholds, and partial-data honesty added. |
| Codex Review | `/autoplan` | Independent second opinion | 0 | unavailable | CLI timed out after 180 seconds; no Codex findings claimed. |
| Eng Review | `/autoplan` | Architecture and tests | 1 | issues_open | Provider seam, partial fallback, typed negative cache, route contracts, and test artifact added. |
| Design Review | `/autoplan` | UI/UX states | 1 | issues_open | Explicit heatmap states, localization, RTL, accessibility, and lazy-route fallback specified. |
| DX Review | `/autoplan` | Developer workflow | 1 | issues_open | Endpoint/runbook, deterministic-vs-smoke testing, diagnostics, and measurement loop specified. |

- **CROSS-MODEL:** The available repository-backed reviews agree on provider-contract verification, partial-data states, deterministic tests, and measurable thresholds. Codex did not complete, so this is not a two-model consensus.
- **VERDICT:** Plan was approved, implemented, and merged to main (commit 473e8ed).
- **IMPLEMENTATION OUTCOMES:**
  - All three workstreams (market-data reliability, heatmap metadata, route-level bundle splitting) were completed.
  - Stable FMP batch endpoint was successfully verified and integrated via `buildFmpBatchUrl`.
  - Curated sector metadata now flows from Insights universe to heatmap aggregation, preserving sectors when provider profiles are unavailable.
  - Route-level code splitting was implemented, reducing initial bundle size as measured.
