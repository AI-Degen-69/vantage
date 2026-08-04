import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LocalMemoryStore,
  VercelKvStore,
  __test__ as usageStoreTest,
  type BucketSnap,
  type TrackedProvider,
} from "./usageStore";

/** Two instantiations of every test below share a single fetch mock so
 *  the recorded URLs/bodies are easy to assert against. */
function mockFetch(response: () => Promise<unknown>) {
  return vi.fn(async (_url: string, init?: RequestInit) => ({
    ok: true,
    status: 200,
    json: response,
    text: async () => JSON.stringify(response),
    headers: init?.headers,
  }));
}

beforeEach(() => {
  // `resetStore()` (NOT `reset()`) — `reset()` is mirror-only in the
  // refactored apiUsageTracker; the spec exercises the store layer, so
  // we reset only the default-backing-store side here.
  usageStoreTest.resetStore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("LocalMemoryStore", () => {
  it("returns an empty bucket for an unseen (provider, day)", async () => {
    const s = new LocalMemoryStore();
    const snap = await s.load("fmp", "2026-08-04");
    expect(snap).toEqual({ timestamps: [], lastRateLimitAt: null });
  });

  it("round-trips a save → load", async () => {
    const s = new LocalMemoryStore();
    await s.save("fmp", "2026-08-04", { timestamps: [1, 2, 3], lastRateLimitAt: 9 });
    const loaded = await s.load("fmp", "2026-08-04");
    expect(loaded.timestamps).toEqual([1, 2, 3]);
    expect(loaded.lastRateLimitAt).toBe(9);
  });

  it("isolates buckets per provider per day", async () => {
    const s = new LocalMemoryStore();
    await s.save("fmp", "2026-08-04", { timestamps: [1], lastRateLimitAt: null });
    await s.save("alphavantage", "2026-08-04", { timestamps: [2, 3], lastRateLimitAt: null });
    await s.save("fmp", "2026-08-05", { timestamps: [4], lastRateLimitAt: null });
    const f1 = await s.load("fmp", "2026-08-04");
    const a1 = await s.load("alphavantage", "2026-08-04");
    const f2 = await s.load("fmp", "2026-08-05");
    expect(f1.timestamps).toEqual([1]);
    expect(a1.timestamps).toEqual([2, 3]);
    expect(f2.timestamps).toEqual([4]);
  });

  it("returns defensive copies — mutating the caller's array doesn't corrupt the store", async () => {
    const s = new LocalMemoryStore();
    await s.save("fmp", "2026-08-04", { timestamps: [1, 2, 3], lastRateLimitAt: null });
    const loaded = await s.load("fmp", "2026-08-04");
    loaded.timestamps.push(99);
    loaded.timestamps.length = 0;
    const reloaded = await s.load("fmp", "2026-08-04");
    expect(reloaded.timestamps).toEqual([1, 2, 3]);
  });
});

describe("VercelKvStore — happy path", () => {
  it("save() POSTs the Upstash SET command with the JSON-serialized bucket", async () => {
    const recorded: Array<{ url: string; init: RequestInit | undefined }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        recorded.push({ url, init });
        return {
          ok: true,
          status: 200,
          json: async () => [null, "OK"],
          text: async () => "[null,\"OK\"]",
        };
      }),
    );

    const s = new VercelKvStore({ url: "https://kv.example/", token: "test-token" });
    await s.save("fmp", "2026-08-04", { timestamps: [100, 200], lastRateLimitAt: 50 });

    expect(recorded).toHaveLength(1);
    expect(recorded[0].url).toBe("https://kv.example/");
    expect(recorded[0].init?.method).toBe("POST");
    expect((recorded[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    const body = JSON.parse(recorded[0].init?.body as string);
    expect(body[0]).toBe("SET");
    expect(body[1]).toBe("vantage:usage:fmp:2026-08-04");
    expect(JSON.parse(body[2])).toEqual({ timestamps: [100, 200], lastRateLimitAt: 50 });
  });

  it("load() POSTs the Upstash GET command and parses the JSON body", async () => {
    const sample: BucketSnap = { timestamps: [10, 20, 30], lastRateLimitAt: 7 };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [null, JSON.stringify(sample)],
        text: async () => JSON.stringify([null, JSON.stringify(sample)]),
      })),
    );

    const s = new VercelKvStore({ url: "https://kv.example", token: "tok" });
    const loaded = await s.load("fmp", "2026-08-04");
    expect(loaded).toEqual(sample);
  });

  it("returns an empty bucket when the key does not exist (Upstash returns `[null, null]`)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [null, null],
        text: async () => "[null,null]",
      })),
    );

    const s = new VercelKvStore({ url: "https://kv.example", token: "tok" });
    const loaded = await s.load("alphavantage", "2026-08-04");
    expect(loaded).toEqual({ timestamps: [], lastRateLimitAt: null });
  });

  it("falls back to an empty bucket when the stored value is malformed JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [null, "not-json{{"],
        text: async () => JSON.stringify([null, "not-json{{"]),
      })),
    );
    // Should warn but not throw, and return [] / null.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = new VercelKvStore({ url: "https://kv.example", token: "tok" });
    const loaded = await s.load("yahoo", "2026-08-04");
    expect(loaded).toEqual({ timestamps: [], lastRateLimitAt: null });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("filters non-number timestamps out of the parsed payload", async () => {
    const real = { timestamps: [1, "bad", 3, null, 5], lastRateLimitAt: 9 };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [null, JSON.stringify(real)],
        text: async () => "",
      })),
    );
    const s = new VercelKvStore({ url: "https://kv.example", token: "tok" });
    const loaded = await s.load("fmp", "2026-08-04");
    expect(loaded.timestamps).toEqual([1, 3, 5]);
    expect(loaded.lastRateLimitAt).toBe(9);
  });

  it("throws if instantiated without URL+token (constructor guard)", () => {
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    expect(() => new VercelKvStore()).toThrow(/KV_REST_API_URL/);
  });
});

describe("VercelKvStore — failure modes", () => {
  it("returns [] / null and logs when KV responds non-OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => {
          throw new Error("no body");
        },
        text: async () => "",
      })),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = new VercelKvStore({ url: "https://kv.example", token: "tok" });
    const loaded = await s.load("fmp", "2026-08-04");
    expect(loaded).toEqual({ timestamps: [], lastRateLimitAt: null });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("save() swallows non-OK responses (best-effort, never throws to caller)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        json: async () => ({}),
        text: async () => "",
      })),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = new VercelKvStore({ url: "https://kv.example", token: "tok" });
    await expect(
      s.save("fmp", "2026-08-04", { timestamps: [1], lastRateLimitAt: null }),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("default-store factory (KV env detection)", () => {
  it("falls back to LocalMemoryStore when KV env vars are missing", async () => {
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    usageStoreTest.reset();
    // After reset() the factory re-reads env → fresh LocalMemoryStore.
    const current = usageStoreTest.current();
    expect(current).toBeInstanceOf(LocalMemoryStore);
  });

  it("returns VercelKvStore when both KV env vars are present", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://kv.example");
    vi.stubEnv("KV_REST_API_TOKEN", "test-token");
    usageStoreTest.resetStore();
    const current = usageStoreTest.current();
    expect(current).toBeInstanceOf(VercelKvStore);
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
  });

  it("silently falls back to LocalMemoryStore when only one KV env var is set", async () => {
    // The factory's outer `if (URL && TOKEN)` short-circuits when TOKEN
    // is missing — so construction is never attempted and no warn is
    // logged. This matches the documented env-var contract; the warn
    // path only fires for construction errors inside the try/catch.
    vi.stubEnv("KV_REST_API_URL", "https://kv.example");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    usageStoreTest.resetStore();
    expect(usageStoreTest.current()).toBeInstanceOf(LocalMemoryStore);
    vi.stubEnv("KV_REST_API_URL", "");
  });

  it("constructs VercelKvStore via opts even when env vars are empty (test override path)", async () => {
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    usageStoreTest.resetStore();
    // The `__test__.setStoreForTests` path uses the singleton as-is
    // (doesn't re-run the factory); the constructor-opts path can
    // deliver explicit url+token even when env is empty.
    const store = new VercelKvStore({ url: "https://kv.example", token: "explicit-token" });
    expect(store).toBeInstanceOf(VercelKvStore);
  });
});
