# feat: KV retention sweep + `/api/provider-usage?mode=retention` diagnostic

Vantage's `apiUsageTracker` writes one KV bucket per `(provider, day)` —
`vantage:usage:fmp:2026-08-04` and friends. Free-tier Vercel KV is **30K
writes / 300K reads per month** — without retention, those buckets
(most stale within ~30 days) slowly eat the budget on every SCAN/DEL
operation. This PR closes the leak.

## What shipped

| Layer | File | Δ | What |
|---|---|---|---|
| Store interface | `server/services/apiUsageTracker.ts` | +221 / -2 | `UsageStore.pruneOlderThan(dayISO)` + `LocalMemoryStore`/`VercelKvStore` impls; `pruneOldBucketsIfDue()` with 6h frequency guard; `lastPruneStats` capture; new test seams |
| Store tests | `server/services/usageStore.spec.ts` | +110 | Strict-less prune, 0-prune path, malformed-cutoff throw; VercelKvStore SCAN-cursor-DEL happy path, SCAN-failure fallback, malformed-cutoff throw |
| Tracker tests | `server/services/apiUsageTracker.spec.ts` | +133 | Cutoff-day math, frequency-guard absorption, frequency-guard re-allow after 6h, real LocalMemoryStore deletion, errorMessage capture on thrown prune, `resetPruneStats()` dual-reset semantics |
| Route (local) | `server/routes/stock-data.ts` | +14 | New `?mode=retention` branch in `handleProviderUsage` |
| Route (parity) | `api/_router.js` | +14 | Same `?mode=retention` branch for the Vercel/Netlify router |

Total: **5 files, +492 / -2**.

## How it works

### `pruneOlderThan(cutoffDayISO)` contract

- **Strict `day < cutoff`** (lexicographic YYYY-MM-DD comparison).
- Returns `{ scannedCount, prunedCount }`.
- Throws on malformed cutoff (catches `yesterday`, `2026-13-40`, etc. via a strict regex + `Date.parse` round-trip).
- Public-surface never throws on KV/SCAN failure — instead returns counts and lets `lastPruneStats.errorMessage` carry the diagnostic.

### `LocalMemoryStore` — pure in-process

Iterates `this.map`, deletes keys whose trailing 10 chars parse as
a YYYY-MM-DD earlier than cutoff. O(n) on the keys Map. Free.

### `VercelKvStore` — Upstash SCAN + DEL

```
POST {KV_REST_API_URL}
body: ["SCAN", cursor, "MATCH", "vantage:usage:*", "COUNT", 100]
  → returns [nextCursor, [keys...]]
DEL <keys…>      // batched 100 at a time
```

Cursor loop caps at 50 rounds as a runaway-safety in case SCAN cursor
never converges. SCAN partial failures return scannedCount + 0
prunedCount + log a warn — the diagnostic surfaces the partial
state honestly.

### Frequency-guarded sweep in `hydrationPromise`

```ts
let hydrationPromise: Promise<void> = (async () => {
  const today = todayISO();
  await Promise.all(ALL_PROVIDERS.map(async (p) => { /* hydrate today */ }));
  await pruneOldBucketsIfDue();   // ← runs after today's buckets fill
})();
```

`pruneOldBucketsIfDue()`:
- Skips if `now - lastPruneAttemptAt < 6h` (constant `PRUNE_INTERVAL_MS`).
- `lastPruneAttemptAt` is in-process only — across cold lambdas each
  fresh process will see `lastPruneAttemptAt = 0` and prune on cold
  start, which is the cheapest node in the cold-start cost graph.
- Errors → `lastPruneStats.errorMessage` populated. Never throws.

## Diagnostic: `?mode=retention`

```bash
$ curl 'https://vantage.vercel.app/api/provider-usage?mode=retention'
```

Returns the last sweep + the configuration knobs it runs against:

```json
{
  "lastPrune": {
    "ranAt": 1755000000000,
    "cutoffDayISO": "2026-07-05",
    "scannedCount": 47,
    "prunedCount": 12,
    "storeType": "VercelKvStore",
    "errorMessage": null
  },
  "daysThreshold": 30,
  "intervalMs": 21600000,
  "checkedAt": "2026-08-04T22:00:00.000Z"
}
```

`storeType` switches between `"LocalMemoryStore"` (local dev) and
`"VercelKvStore"` (production) automatically. `errorMessage` only
ever populates if the upstream KV responded non-OK or timed out; the
sweep itself is best-effort and won't fail the request path.

## Test count

| Gate | Before | After |
|---|---|---|
| `pnpm test` | 343/343 across 21 files | **355/355** across 21 files |
| `pnpm typecheck` | exit 0 | exit 0 |
| Diff | — | 5 files, +492/-2 |
| API contract | `apiUsageTracker.recordCall`/`getProviderUsage`/`usageStore.*` | Signature-stable; new method on `UsageStore` (+ `?mode=retention` route shape) |

## Validation: how to verify the retention works

After this lands on production — manual probe:

```bash
# 1. Confirm KV is active
curl 'https://vantage.vercel.app/api/provider-usage?mode=status'
# → { "store": "VercelKvStore", "kvConfigured": true, "ready": true, ... }

# 2. Force a prune by toggling the in-process guard off
#    (for now: just wait or wait for a cold start)
# 3. Run the diagnostic
curl 'https://vantage.vercel.app/api/provider-usage?mode=retention'
# → { "lastPrune": { "scannedCount": N, "prunedCount": M, ... }, ... }
```

For local dev (no KV env vars), `lastPrune.storeType === "LocalMemoryStore"`.

🤖 Generated with [Codebuff](https://codebuff.com)
Co-Authored-By: Codebuff <noreply@codebuff.com>
