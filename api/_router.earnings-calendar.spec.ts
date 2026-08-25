import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";

/**
 * Contract tests for `_router.js`'s earnings-calendar handler against
 * the Express twin (`server/routes/stock-data.ts` +
 * `stockService.getEarningsCalendar`). The handler used to be a stub
 * returning `[]` unconditionally — Vercel deployments served an
 * always-empty calendar while local dev showed real FMP data.
 *
 * The router reads FMP_USE_STABLE at module scope, so every test loads
 * the module fresh via dynamic import after stubbing the env — this way
 * both the stable (`earnings-calendar`) and legacy (`earning_calendar`)
 * endpoint variants are covered regardless of the runner's environment.
 */

vi.mock("../server/services/apiUsageTracker.js", () => ({
  default: {
    recordCall: vi.fn(),
    recordRateLimit: vi.fn(),
    getProviderReport: vi.fn(() => ({})),
    hydrationPromise: Promise.resolve(),
  },
}));

vi.mock("yahoo-finance2", () => {
  const inst = {
    historical: vi.fn(async () => []),
    quote: vi.fn(async (symbol: string) => ({
      symbol,
      regularMarketPrice: 100,
      marketCap: 2_000_000_000_000,
    })),
  };
  const YF = class {
    constructor() {
      return inst;
    }
  };
  return { default: YF, __inst: inst };
});

async function loadHandler(legacyEndpoint = false) {
  vi.resetModules();
  vi.stubEnv("FMP_USE_STABLE", legacyEndpoint ? "0" : "1");
  return (await import("./_router")).handleEarningsCalendar;
}

function makeRes() {
  const statusCalls: number[] = [];
  let jsonBody: unknown;
  const res = {
    status(status: number) {
      statusCalls.push(status);
      return res;
    },
    json(body: unknown) {
      jsonBody = body;
      return res;
    },
  } as unknown as Response;
  return { res, statusCalls, getJson: () => jsonBody };
}

const makeReq = (query: Record<string, unknown>) => ({ query }) as any;

describe("api/_router.js handleEarningsCalendar ↔ Express contract", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("FMP_KEY", "test-fmp-key");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects non-ISO dates like the Express twin", async () => {
    const handleEarningsCalendar = await loadHandler();
    const { res, statusCalls, getJson } = makeRes();
    await handleEarningsCalendar(
      makeReq({ from: "nope", to: "2026-08-24" }),
      res,
    );
    expect(statusCalls).toEqual([400]);
    expect(getJson()).toEqual({
      error: "from and to must be valid YYYY-MM-DD dates",
    });
  });

  it("rejects ranges outside 0-31 days like the Express twin", async () => {
    const handleEarningsCalendar = await loadHandler();
    const long = makeRes();
    await handleEarningsCalendar(
      makeReq({ from: "2026-08-01", to: "2026-09-15" }),
      long.res,
    );
    expect(long.statusCalls).toEqual([400]);
    expect(long.getJson()).toEqual({
      error: "date range must be between 0 and 31 days",
    });

    const reversed = makeRes();
    await handleEarningsCalendar(
      makeReq({ from: "2026-08-24", to: "2026-08-20" }),
      reversed.res,
    );
    expect(reversed.statusCalls).toEqual([400]);
  });

  it("serves an empty calendar when FMP is not configured", async () => {
    const handleEarningsCalendar = await loadHandler();
    vi.stubEnv("FMP_KEY", "");
    const { res, statusCalls, getJson } = makeRes();
    await handleEarningsCalendar(
      makeReq({ from: "2026-08-01", to: "2026-08-24" }),
      res,
    );
    expect(statusCalls).toEqual([]);
    expect(getJson()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches FMP, normalizes events, and enriches market caps from quotes", async () => {
    const handleEarningsCalendar = await loadHandler();
    fetchMock.mockImplementation(
      async (url: unknown) =>
        new Response(
          JSON.stringify([
            {
              symbol: "AAPL",
              date: "2026-08-27",
              epsEstimated: 1.51,
              eps: 1.57,
              revenueEstimated: 89_000_000_000,
              revenue: 91_000_000_000,
            },
            // duplicate symbol — enrichment must dedupe upstream quote calls
            { symbol: "aapl", date: "2026-08-28" },
          ]),
          { status: 200 },
        ),
    );
    const { res, statusCalls, getJson } = makeRes();
    await handleEarningsCalendar(
      makeReq({ from: "2026-08-01", to: "2026-08-24" }),
      res,
    );
    expect(statusCalls).toEqual([]);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("earnings-calendar");
    expect(url).toContain("from=2026-08-01");
    expect(url).toContain("to=2026-08-24");
    const events = getJson() as Array<Record<string, unknown>>;
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      symbol: "AAPL",
      date: "2026-08-27",
      epsEstimated: 1.51,
      eps: 1.57,
      revenue: 91_000_000_000,
      marketCap: 2_000_000_000_000,
      time: "bmo",
    });
    // missing fields normalize to null, never undefined
    expect(events[1]?.eps).toBeNull();
  });

  it("caches the range so a repeat call does not re-hit FMP", async () => {
    const handleEarningsCalendar = await loadHandler();
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify([{ symbol: "AAPL", date: "2026-08-27" }]), {
          status: 200,
        }),
    );
    const first = makeRes();
    await handleEarningsCalendar(
      makeReq({ from: "2026-08-02", to: "2026-08-23" }),
      first.res,
    );
    const second = makeRes();
    await handleEarningsCalendar(
      makeReq({ from: "2026-08-02", to: "2026-08-23" }),
      second.res,
    );
    expect(second.statusCalls).toEqual([]);
    // Quote enrichment goes through the mocked Yahoo SDK, not global
    // fetch — so every global-fetch call here is an FMP request, and
    // the second handler call must serve from cache (exactly one).
    const fmpFetches = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("financialmodelingprep"),
    );
    expect(fmpFetches).toHaveLength(1);
  });

  it("falls back to the legacy earning_calendar endpoint when FMP_USE_STABLE=0", async () => {
    const handleEarningsCalendar = await loadHandler(true);
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify([{ symbol: "AAPL", date: "2026-08-27" }]), {
          status: 200,
        }),
    );
    const { res, statusCalls, getJson } = makeRes();
    await handleEarningsCalendar(
      makeReq({ from: "2026-08-01", to: "2026-08-24" }),
      res,
    );
    expect(statusCalls).toEqual([]);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("api/v3/earning_calendar");
    expect(url).not.toContain("earnings-calendar");
    const events = getJson() as Array<Record<string, unknown>>;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ symbol: "AAPL", date: "2026-08-27" });
  });
});
