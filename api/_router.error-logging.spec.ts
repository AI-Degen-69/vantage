import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import {
  handleBatchQuotes,
  handleFxRates,
  handleSmaDistances,
} from "./_router";

/**
 * Observability contract — upstream failures inside per-item catch
 * blocks used to vanish without a trace (found while debugging an
 * apiUsageTracker throw that made every SMA row silently null). Failed
 * items must still degrade gracefully (null entries / empty rates) but
 * MUST emit a throttled console.warn so outages are diagnosable.
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
    historical: vi.fn(async () => {
      throw new Error("history down");
    }),
    quote: vi.fn(async () => {
      throw new Error("yahoo down");
    }),
  };
  const YF = class {
    constructor() {
      return inst;
    }
  };
  return { default: YF, __inst: inst };
});

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

describe("per-item failure paths warn instead of vanishing", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("FMP_KEY", "test-fmp-key");
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("SMA rows degrade to the exact null row and warn once per symbol", async () => {
    const first = makeRes();
    await handleSmaDistances(makeReq({ symbols: "AAPL" }), first.res);
    expect(first.statusCalls).toEqual([]);
    expect(first.getJson()).toEqual({
      rows: [
        {
          symbol: "AAPL",
          sma200: null,
          distancePct: null,
          sampleSize: 0,
          price: null,
        },
      ],
    });
    // Throttle contract: a second failure for the same key inside the
    // window stays silent.
    const second = makeRes();
    await handleSmaDistances(makeReq({ symbols: "AAPL" }), second.res);
    expect(second.getJson()).toEqual(first.getJson());
    const smaWarns = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes("sma history failed for AAPL"),
    );
    expect(smaWarns).toHaveLength(1);
  });

  it("batch quotes keep null placeholders but warn on quote failure", async () => {
    const { res, statusCalls, getJson } = makeRes();
    await handleBatchQuotes(makeReq({ symbols: "AAPL" }), res);
    expect(statusCalls).toEqual([]);
    expect(getJson()).toEqual({ quotes: [null] });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("yahoo quote failed for AAPL"),
      expect.anything(),
    );
  });

  it("FX rates skip both failed pairs with exactly one warning each", async () => {
    const { res, statusCalls, getJson } = makeRes();
    await handleFxRates(makeReq({ currencies: "USD,ILS" }), res);
    expect(statusCalls).toEqual([]);
    expect(getJson()).toMatchObject({ rates: { USDUSD: 1 } });
    const fxWarns = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes("fx pair failed for"),
    );
    // USDILS=X and ILSUSD=X — one throttled warn per failed pair.
    expect(fxWarns).toHaveLength(2);
  });

  it("re-allows a key after its throttle window expires", async () => {
    vi.useFakeTimers();
    try {
      const t0 = new Date("2026-08-24T12:00:00.000Z");
      vi.setSystemTime(t0);
      const first = makeRes();
      await handleSmaDistances(makeReq({ symbols: "QQQ" }), first.res);
      expect(warnSpy.mock.calls.length).toBe(1);
      vi.setSystemTime(new Date(t0.getTime() + 61_000));
      const second = makeRes();
      await handleSmaDistances(makeReq({ symbols: "QQQ" }), second.res);
      expect(warnSpy.mock.calls.length).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never silences a first warning, even past the hard map cap", async () => {
    // Sustained sweep of unique, non-expired keys: eviction must keep
    // memory bounded WITHOUT dropping any first-time warning. Symbols
    // must satisfy the shared route contract ([A-Z]{1,5}) — digit-bearing
    // tickers 400 before ever reaching the warn path.
    const count = 600;
    const letter = (i: number) => String.fromCharCode(65 + (i % 26));
    const symbols = Array.from({ length: count }, (_, i) =>
      [
        "W",
        letter(i),
        letter(Math.floor(i / 26)),
        letter(Math.floor(i / 676)),
      ].join(""),
    );
    let warned = 0;
    for (const sym of symbols) {
      warnSpy.mockClear();
      await handleSmaDistances(makeReq({ symbols: sym }), makeRes().res);
      if (
        warnSpy.mock.calls.some((c) =>
          String(c[0]).includes(`sma history failed for ${sym}`),
        )
      ) {
        warned += 1;
      }
    }
    expect(warned).toBe(count);
  });

  it("checks the throttle BEFORE evicting when the map is full", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
      // Fill the map to exactly its hard cap with unique keys.
      for (let i = 0; i < 512; i += 1) {
        await handleSmaDistances(
          makeReq({
            symbols: `F${i.toString(36).toUpperCase().padStart(3, "0")}`,
          }),
          makeRes().res,
        );
      }
      warnSpy.mockClear();
      // Repeat a key that is in-map and still fresh. The throttle check
      // must win over eviction: no new warning AND no collateral eviction.
      await handleSmaDistances(makeReq({ symbols: "F000" }), makeRes().res);
      expect(
        warnSpy.mock.calls.filter((c) =>
          String(c[0]).includes("sma history failed for F000"),
        ),
      ).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
