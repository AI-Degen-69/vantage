/**
 * Per-provider API usage tracker — KV-backed.
 *
 * Reads / writes per-day rolling-window snapshots of upstream call
 * timestamps + a "last rate-limit" timestamp through a usage-store
 * abstraction that defaults to in-process memory and transparently
 * switches to Vercel KV when both `KV_REST_API_URL` and
 * `KV_REST_API_TOKEN` are present. This closes the cross-instance state
 * gap that caused "footer shows 0 while FMP dashboard shows 613".
 *
 * Self-contained: ALL store classes (`LocalMemoryStore`,
 * `VercelKvStore`), the `usageStore` singleton, and the tracker facade
 * live in *this* module. There is intentionally no `./usageStore`
 * sibling because Vercel's API bundler drops unresolved relative-import
 * paths inside serverless functions — keeping everything in one file
 * means the dependency graph is trivial and Vercel ships it whole.
 *
 * `server/services/usageStore.ts` is kept as a 1-line re-export shim
 * for backwards compatibility with the existing unit specs and the
 * dynamic-import paths in `api/_router.js`.
 *
 * Lifecycle:
 *   • Module init eagerly hydrates today's buckets for all three
 *     providers in parallel. Returns a stored `hydrationPromise` so
 *     tests / the `/api/provider-usage` route can `await` a clean
 *     state boundary.
 *   • `recordCall(provider)` / `recordRateLimit(provider)` mutate the
 *     in-process mirror synchronously (so subsequent reads within the
 *     same lambda see the value immediately) and schedule a
 *     fire-and-forget KV write.
 *   • `getProviderUsage(now)` is async and awaits hydration.
 *
 * Free-tier budgets (per docs/data-providers.md):
 *   - FMP           250 calls / 24 h (documented)
 *   - AlphaVantage   25 calls / 24 h (documented)
 *   - Yahoo         200 calls / 1 h  (heuristic; never pushed to)
 */

/* ────────────────────────────  STORE LAYER  ──────────────────────────── */

export type TrackedProvider = "yahoo" | "fmp" | "alphavantage";

/** Snapshot of one provider's bucket — what the store reads/writes atomically. */
export interface BucketSnap {
  /** Epoch-ms call timestamps within the rolling window. */
  timestamps: number[];
  /** Latest observed 429 timestamp (epoch ms); cleared implicitly by window expiry. */
  lastRateLimitAt: number | null;
}

/** Async read/write interface — both adapters satisfy this contract. */
export interface UsageStore {
  load(provider: TrackedProvider, dayISO: string): Promise<BucketSnap>;
  save(provider: TrackedProvider, dayISO: string, snap: BucketSnap): Promise<void>;
}

/**
 * In-process adapter. Default. Holds the latest snapshot per
 * `(provider, day)` in a `Map` keyed by `${provider}:${dayISO}`.
 * Behaves exactly like the original in-process `buckets` map so the
 * unit tests don't have to differentiate between KV and local modes.
 */
export class LocalMemoryStore implements UsageStore {
  private readonly map = new Map<string, BucketSnap>();
  private static key(p: TrackedProvider, dayISO: string): string {
    return `${p}:${dayISO}`;
  }
  async load(p: TrackedProvider, dayISO: string): Promise<BucketSnap> {
    const found = this.map.get(LocalMemoryStore.key(p, dayISO));
    return found ? { timestamps: found.timestamps.slice(), lastRateLimitAt: found.lastRateLimitAt } : { timestamps: [], lastRateLimitAt: null };
  }
  async save(p: TrackedProvider, dayISO: string, snap: BucketSnap): Promise<void> {
    this.map.set(LocalMemoryStore.key(p, dayISO), {
      timestamps: snap.timestamps.slice(),
      lastRateLimitAt: snap.lastRateLimitAt,
    });
  }
  /** Diagnostic peek — for tests only. */
  __peek(p: TrackedProvider, dayISO: string): BucketSnap | null {
    const v = this.map.get(LocalMemoryStore.key(p, dayISO));
    return v ? { timestamps: v.timestamps.slice(), lastRateLimitAt: v.lastRateLimitAt } : null;
  }
  /** Test seam — clears all keys. */
  __clear(): void {
    this.map.clear();
  }
}

/**
 * Vercel KV adapter. Uses the Upstash-style REST endpoint:
 *
 *   POST {KV_REST_API_URL}
 *   Authorization: Bearer {KV_REST_API_TOKEN}
 *   body: ["GET","vantage:usage:{provider}:{day}"]
 *      → returns [null, "<value>"]   (or [null, null] if missing)
 *   body: ["SET","vantage:usage:{provider}:{day}", "{json}"]
 *      → returns [null, "OK"]
 *
 * Errors are swallowed and logged so a flaky KV never breaks a request
 * path — the in-process mirror remains the source of truth for THIS
 * lambda until the next cold-start hydration.
 */
export class VercelKvStore implements UsageStore {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(opts?: { url?: string; token?: string }) {
    this.baseUrl = opts?.url ?? process.env.KV_REST_API_URL ?? "";
    this.token = opts?.token ?? process.env.KV_REST_API_TOKEN ?? "";
    if (!this.baseUrl || !this.token) {
      throw new Error(
        "VercelKvStore requires both KV_REST_API_URL and KV_REST_API_TOKEN env vars (or constructor opts).",
      );
    }
  }

  private keyFor(p: TrackedProvider, dayISO: string): string {
    return `vantage:usage:${p}:${dayISO}`;
  }

  private async exec<T = unknown>(cmd: string, ...args: (string | number)[]): Promise<[unknown, T | null]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const r = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([cmd, ...args]),
        signal: controller.signal,
      });
      if (!r.ok) throw new Error(`KV ${cmd} failed: ${r.status} ${r.statusText}`);
      const arr = (await r.json()) as Array<unknown>;
      return [arr[0] ?? null, (arr[1] as T | null) ?? null];
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async load(p: TrackedProvider, dayISO: string): Promise<BucketSnap> {
    try {
      const [err, value] = await this.exec<string | null>("GET", this.keyFor(p, dayISO));
      if (err || value === null) return { timestamps: [], lastRateLimitAt: null };
      const parsed = JSON.parse(value) as Partial<BucketSnap>;
      return {
        timestamps: Array.isArray(parsed.timestamps)
          ? parsed.timestamps.filter((n): n is number => typeof n === "number")
          : [],
        lastRateLimitAt: typeof parsed.lastRateLimitAt === "number" ? parsed.lastRateLimitAt : null,
      };
    } catch (e) {
      console.warn("[usageStore] KV load failed (returning empty):", e instanceof Error ? e.message : e);
      return { timestamps: [], lastRateLimitAt: null };
    }
  }

  async save(p: TrackedProvider, dayISO: string, snap: BucketSnap): Promise<void> {
    try {
      await this.exec("SET", this.keyFor(p, dayISO), JSON.stringify(snap));
    } catch (e) {
      console.warn("[usageStore] KV save failed:", e instanceof Error ? e.message : e);
    }
  }
}

/**
 * Mutable backing store. Exposed via a delegating proxy so test code
 * can call `__test__.setStoreForTests(...)` to swap the active store
 * for the lifetime of the test, without the caller ever needing to
 * re-import the module.
 */
let _backing: UsageStore = createDefaultStore();

function createDefaultStore(): UsageStore {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      return new VercelKvStore();
    } catch (e) {
      console.warn("[usageStore] Falling back to LocalMemoryStore:", e instanceof Error ? e.message : e);
      return new LocalMemoryStore();
    }
  }
  return new LocalMemoryStore();
}

/**
 * The exported `usageStore` is a delegating proxy whose methods forward
 * to whichever adapter `_backing` currently points at.
 *
 *   await usageStore.load("fmp", day);   // → _backing.load(...)
 *   await usageStore.save("fmp", day, snap);
 */
export const usageStore: UsageStore = {
  load: (provider, day) => _backing.load(provider, day),
  save: (provider, day, snap) => _backing.save(provider, day, snap),
};

/* ────────────────────────────  TRACKER LAYER  ──────────────────────────── */

interface ProviderConfig {
  /** Hard-documented limit if known; informational if heuristic. */
  limit: number;
  /** Rolling window length in ms. */
  windowMs: number;
  /** Whether the limit is the documented free-tier cap or a heuristic. */
  limitHint: "documented" | "heuristic";
}

const PROVIDER_CONFIG: Record<TrackedProvider, ProviderConfig> = {
  fmp: { limit: 250, windowMs: 24 * 60 * 60 * 1000, limitHint: "documented" },
  alphavantage: { limit: 25, windowMs: 24 * 60 * 60 * 1000, limitHint: "documented" },
  // Yahoo: estimate, never push to it. Mark as heuristic so the pill
  // doesn't read as a hard cap.
  yahoo: { limit: 200, windowMs: 60 * 60 * 1000, limitHint: "heuristic" },
};

const ALL_PROVIDERS: TrackedProvider[] = ["fmp", "alphavantage", "yahoo"];

/**
 * In-process mirror — fast read path for THIS lambda instance. Populated
 * from `usageStore.load(...)` on cold start and re-populated lazily when
 * the day rolls over. Mutations are applied synchronously so the very
 * next `getProviderUsage` snapshot reflects them.
 */
interface Mirror {
  /** ISO `YYYY-MM-DD` (UTC). Resets at midnight UTC. */
  day: string;
  /** Timestamps within the rolling window for this provider on this day. */
  timestamps: number[];
  /** Most recent observed 429 timestamp (epoch ms); null when absent. */
  lastRateLimitAt: number | null;
}

const mirrors: Record<TrackedProvider, Mirror | null> = {
  fmp: null,
  alphavantage: null,
  yahoo: null,
};

function todayISO(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

function pruneTimestamps(snap: BucketSnap, windowMs: number, now: number): void {
  const cut = now - windowMs;
  const kept = snap.timestamps.filter((t) => t >= cut);
  if (kept.length !== snap.timestamps.length) snap.timestamps = kept;
}

/* ── Eager hydration on module init ── */

let hydrationPromise: Promise<void> = (async () => {
  const today = todayISO();
  await Promise.all(
    ALL_PROVIDERS.map(async (p) => {
      try {
        const snap = await usageStore.load(p, today);
        // Don't clobber an already-populated mirror (a recordCall may
        // have landed concurrently with hydration).
        const cur = mirrors[p];
        if (cur && cur.day === today && (cur.timestamps.length > 0 || cur.lastRateLimitAt !== null)) {
          return;
        }
        mirrors[p] = { day: today, timestamps: snap.timestamps.slice(), lastRateLimitAt: snap.lastRateLimitAt };
      } catch (e) {
        console.warn(`[apiUsageTracker] hydrate ${p} failed:`, e instanceof Error ? e.message : e);
        mirrors[p] = { day: today, timestamps: [], lastRateLimitAt: null };
      }
    }),
  );
})();

function scheduleFlush(provider: TrackedProvider): void {
  const m = mirrors[provider];
  if (!m) return;
  // Fire-and-forget — read, merge, write to avoid clobbering other instances' timestamps.
  (async () => {
    try {
      const stored = await usageStore.load(provider, m.day);
      // Union the local mirror's timestamps with the stored set, then prune stale ones.
      const cfg = PROVIDER_CONFIG[provider];
      const now = Date.now();
      const merged = Array.from(new Set([...stored.timestamps, ...m.timestamps]));
      const pruned = merged.filter((t) => t >= now - cfg.windowMs);
      // Keep the most recent rate-limit timestamp.
      const lastRateLimitAt =
        stored.lastRateLimitAt !== null && m.lastRateLimitAt !== null
          ? Math.max(stored.lastRateLimitAt, m.lastRateLimitAt)
          : stored.lastRateLimitAt ?? m.lastRateLimitAt;
      await usageStore.save(provider, m.day, { timestamps: pruned, lastRateLimitAt });
    } catch (e) {
      console.warn(`[apiUsageTracker] flush ${provider} failed:`, e instanceof Error ? e.message : e);
    }
  })();
}

async function updateMirror(provider: TrackedProvider, now: number): Promise<Mirror> {
  const today = todayISO(now);
  let m = mirrors[provider];
  if (!m || m.day !== today) {
    // Day rolled over — lazily rehydrate from the store instead of replacing with empty.
    try {
      const snap = await usageStore.load(provider, today);
      m = { day: today, timestamps: snap.timestamps.slice(), lastRateLimitAt: snap.lastRateLimitAt };
    } catch (e) {
      console.warn(`[apiUsageTracker] updateMirror rehydrate ${provider} failed:`, e instanceof Error ? e.message : e);
      m = { day: today, timestamps: [], lastRateLimitAt: null };
    }
    mirrors[provider] = m;
  }
  return m;
}

export const apiUsageTracker = {
  /**
   * Increment the per-day call count. Fire-and-forget async to handle day
   * rollovers (which need to rehydrate from the store), then schedules an
   * async best-effort KV write.
   */
  recordCall(provider: TrackedProvider, now: number = Date.now()): void {
    const cfg = PROVIDER_CONFIG[provider];
    updateMirror(provider, now).then((m) => {
      m.timestamps.push(now);
      pruneTimestamps(m, cfg.windowMs, now);
      scheduleFlush(provider);
    }).catch((e) => {
      console.warn(`[apiUsageTracker] recordCall ${provider} failed:`, e instanceof Error ? e.message : e);
    });
  },
  /**
   * Mark the provider as currently rate-limited. Same async-update-
   * mirror + async-flush-to-KV shape.
   */
  recordRateLimit(provider: TrackedProvider, now: number = Date.now()): void {
    updateMirror(provider, now).then((m) => {
      m.lastRateLimitAt = now;
      scheduleFlush(provider);
    }).catch((e) => {
      console.warn(`[apiUsageTracker] recordRateLimit ${provider} failed:`, e instanceof Error ? e.message : e);
    });
  },
};

const PROVIDER_LABELS: Record<TrackedProvider, string> = {
  fmp: "FMP",
  alphavantage: "AlphaVantage",
  yahoo: "Yahoo Finance",
};

function buildEntry(provider: TrackedProvider, now: number) {
  const cfg = PROVIDER_CONFIG[provider];
  const m = mirrors[provider];
  const snap: BucketSnap = m
    ? { timestamps: m.timestamps.slice(), lastRateLimitAt: m.lastRateLimitAt }
    : { timestamps: [], lastRateLimitAt: null };
  // Always prune timestamps against the rolling window before calculating used,
  // regardless of whether the day matches — ensures stale prior-day entries
  // cannot affect the reported count.
  pruneTimestamps(snap, cfg.windowMs, now);

  const used = snap.timestamps.length;
  const remaining = Math.max(0, cfg.limit - used);
  const usedPct = Math.min(100, (used / cfg.limit) * 100);
  const oldestInWindow = snap.timestamps[0] ?? null;
  const resetsAtMs = oldestInWindow !== null ? oldestInWindow + cfg.windowMs : null;
  return {
    provider,
    label: PROVIDER_LABELS[provider],
    used,
    limit: cfg.limit,
    usedPct,
    remaining,
    windowMs: cfg.windowMs,
    windowLabel: cfg.windowMs === 24 * 60 * 60 * 1000 ? "24h" : "1h",
    resetsAt: resetsAtMs ? new Date(resetsAtMs).toISOString() : null,
    secondsToReset: resetsAtMs ? Math.max(0, Math.floor((resetsAtMs - now) / 1000)) : null,
    isRateLimited: snap.lastRateLimitAt !== null && now - snap.lastRateLimitAt < cfg.windowMs,
    lastRateLimitAt: snap.lastRateLimitAt ? new Date(snap.lastRateLimitAt).toISOString() : null,
    limitHint: cfg.limitHint,
  };
}

/**
 * Return the per-provider usage snapshot. Each entry is ordered so the
 * documented free-tier providers (FMP / AV) come first — the
 * interpretive pill leads with a true count.
 *
 * Async because the tracker awaits cold-start KV hydration on
 * serverless cold starts; first request after a cold start costs ~50ms
 * for the cross-instance hydrate, subsequent ones are sync.
 */
export async function getProviderUsage(
  now: number = Date.now(),
  opts: { awaitHydration?: boolean } = {},
): Promise<{
  checkedAt: string;
  entries: ReturnType<typeof buildEntry>[];
}> {
  if (opts.awaitHydration !== false) {
    await hydrationPromise;
  }
  return {
    checkedAt: new Date(now).toISOString(),
    entries: [
      buildEntry("fmp", now),
      buildEntry("alphavantage", now),
      buildEntry("yahoo", now),
    ],
  };
}

/* ── Test seams ── */

export const __test__ = {
  /**
   * Reset in-process mirrors only. Does NOT touch the backing
   * `usageStore` — tests that swap stores (`setStoreForTests(...)`)
   * need their swap to survive a `reset()` so they can prove
   * cross-instance persistence. Callers that want BOTH mirror and
   * store reset should chain `await __test__.reset()` followed by
   * `__test__.resetStore()`.
   *
   * `VI. unstubAllEnvs()` in afterEach between tests will already
   * reset env vars to their pre-stub state, so test specs that
   * `vi.stubEnv("KV_REST_API_URL", "https://…")` between runs
   * should chain `__test__.resetStore()` to pick up the change.
   */
  async reset(now: number = Date.now()): Promise<void> {
    const today = todayISO(now);
    for (const key of ALL_PROVIDERS) {
      mirrors[key] = { day: today, timestamps: [], lastRateLimitAt: null };
    }
  },
  configSnapshot(): Record<TrackedProvider, ProviderConfig> {
    return JSON.parse(JSON.stringify(PROVIDER_CONFIG));
  },
  /** Resolve once module-init hydration finishes. */
  waitForHydration(): Promise<void> {
    return hydrationPromise;
  },
  /** Diagnostic: read a provider's mirror without triggering hydration. */
  peekMirror(provider: TrackedProvider): Mirror | null {
    const m = mirrors[provider];
    return m ? { day: m.day, timestamps: m.timestamps.slice(), lastRateLimitAt: m.lastRateLimitAt } : null;
  },
  /** Replace the active backing store for tests. */
  setStoreForTests(s: UsageStore): void {
    _backing = s;
  },
  /** Return the active backing store (used by `?mode=status` route). */
  current(): UsageStore {
    return _backing;
  },
  /** Reset the backing store to the env-detected default. */
  resetStore(): void {
    _backing = createDefaultStore();
  },
};
