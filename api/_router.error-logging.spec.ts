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

  it("SMA rows degrade to null but warn on per-symbol failure", async () => {
    const { res, statusCalls } = makeRes();
    await handleSmaDistances(makeReq({ symbols: "AAPL" }), res);
    expect(statusCalls).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("sma history failed for AAPL"),
      expect.anything(),
    );
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

  it("FX rates skip failed pairs but warn per pair", async () => {
    const { res, statusCalls, getJson } = makeRes();
    await handleFxRates(makeReq({ currencies: "USD,ILS" }), res);
    expect(statusCalls).toEqual([]);
    expect(getJson()).toMatchObject({ rates: { USDUSD: 1 } });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("fx pair failed for"),
      expect.anything(),
    );
  });
});
