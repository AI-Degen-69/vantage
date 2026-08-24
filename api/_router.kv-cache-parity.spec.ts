import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __test__ as tsKv } from "../server/helpers/kvJsonCache";
import { kvJsonCache as jsKv } from "./_router";

/**
 * Parity tripwire — `api/_router.js` ships a hand-written JS twin of
 * `server/helpers/kvJsonCache.ts` so the Vercel serverless runtime can
 * share the KV-backed cache semantics without sibling-TS imports.
 * docs/data-providers.md §1b mandates lock-step, and drift here caused
 * production incident hotfix 5dd48b0 (Upstash `{result}` envelope parsed
 * as a miss serverless-side only).
 *
 * This spec runs identical scenarios against BOTH implementations and
 * asserts the same observable outcome, so any future edit to one copy
 * that breaks agreement fails CI here.
 */

function makeTsSide() {
  const exec = vi.fn();
  const cache = new tsKv.VercelKvJsonCache({ exec } as never);
  return {
    cache,
    /** Prime what the fake upstream will answer on the next GET probe. */
    nextUpstashResult(value: unknown, err: unknown = null) {
      exec.mockResolvedValueOnce([err, value]);
    },
    probes: () => exec.mock.calls.length,
    sets: () => exec.mock.calls.filter((c) => c[0] === "SET"),
  };
}

function makeJsSide() {
  vi.stubEnv("KV_REST_API_URL", "https://kv.example.test");
  vi.stubEnv("KV_REST_API_TOKEN", "test-token");
  // Every KV REST call records its parsed command; responses come from
  // a FIFO queue of canned Upstash envelopes.
  const commands: unknown[][] = [];
  const answers: unknown[] = [];
  const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
    commands.push(JSON.parse(String(init?.body)));
    const answer = answers.length > 0 ? answers.shift() : { result: "OK" };
    return new Response(JSON.stringify(answer), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    async get(key: string) {
      return jsKv.getJSON(key);
    },
    async set(key: string, value: unknown, ttl: number) {
      await jsKv.setJSON(key, value, ttl);
    },
    nextUpstashResult(value: unknown, err: unknown = null) {
      answers.push(err !== null ? { error: err } : { result: value });
    },
    probes: () => fetchMock.mock.calls.length,
    setCommands: () => commands.filter((cmd) => cmd[0] === "SET"),
    lastSetCommand(): unknown[] | undefined {
      return this.setCommands().at(-1);
    },
  };
}

describe("api/_router.js kvJsonCache ↔ server/helpers/kvJsonCache.ts parity", () => {
  let ts: ReturnType<typeof makeTsSide>;
  let js: ReturnType<typeof makeJsSide>;

  beforeEach(() => {
    ts = makeTsSide();
    js = makeJsSide();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("parses a stringified-JSON KV hit into an object on both sides", async () => {
    const payload = { segments: [{ name: "iPhone", revenue: 200e9 }] };
    ts.nextUpstashResult(JSON.stringify(payload));
    js.nextUpstashResult(JSON.stringify(payload));
    await expect(ts.cache.get("seg")).resolves.toEqual(payload);
    await expect(js.get("seg")).resolves.toEqual(payload);
  });

  it("treats a null result as a miss on both sides", async () => {
    ts.nextUpstashResult(null);
    js.nextUpstashResult(null);
    await expect(ts.cache.get("missing")).resolves.toBeNull();
    await expect(js.get("missing")).resolves.toBeNull();
  });

  it("swallows an Upstash {error} envelope and returns null on both sides", async () => {
    ts.nextUpstashResult(null, "WRONGTYPE");
    js.nextUpstashResult(null, "WRONGTYPE");
    await expect(ts.cache.get("bad")).resolves.toBeNull();
    await expect(js.get("bad")).resolves.toBeNull();
  });

  it("writes SET with EX ttl clamped to ≥1s on both sides", async () => {
    await ts.cache.set("k", { v: 1 }, 0); // 0 must clamp to 1
    await js.set("k", { v: 1 }, 0);
    const tsCmd = ts.sets()[0];
    expect(tsCmd?.[0]).toBe("SET");
    expect(Number(tsCmd?.[4])).toBe(1);
    expect(js.lastSetCommand()).toEqual([
      "SET",
      "k",
      JSON.stringify({ v: 1 }),
      "EX",
      1,
    ]);
  });

  it("hydrates a local mirror so the second read never re-probes KV", async () => {
    const payload = { rateLimited: true };
    ts.nextUpstashResult(JSON.stringify(payload));
    js.nextUpstashResult(JSON.stringify(payload));

    await ts.cache.get("lock");
    await js.get("lock");

    // Mirror hit — no additional upstream probes.
    await expect(ts.cache.get("lock")).resolves.toEqual(payload);
    await expect(js.get("lock")).resolves.toEqual(payload);
    expect(ts.probes()).toBe(1);
    expect(js.probes()).toBe(1);
  });
});
