import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import { handleBatchQuotes } from "./_router";

/**
 * Route-validation parity for `_router.js`'s batch-quotes handler
 * against the Express twin. Before this spec the serverless copy had no
 * 50-symbol cap, no invalid-ticker rejection, and no dedupe — a large or
 * malformed client list hit Yahoo once per raw entry.
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
    })),
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

describe("api/_router.js handleBatchQuotes validation ↔ Express contract", () => {
  let quote: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mod = (await import("yahoo-finance2")) as any;
    quote = mod.__inst.quote;
    quote.mockClear();
  });

  it("rejects a missing symbols parameter like the Express twin", async () => {
    const { res, statusCalls, getJson } = makeRes();
    await handleBatchQuotes(makeReq({}), res);
    expect(statusCalls).toEqual([400]);
    expect(getJson()).toEqual({ error: "symbols parameter required" });
    expect(quote).not.toHaveBeenCalled();
  });

  it("rejects invalid tickers with the canonical error body", async () => {
    const { res, statusCalls, getJson } = makeRes();
    await handleBatchQuotes(makeReq({ symbols: "AAPL,BAD!" }), res);
    expect(statusCalls).toEqual([400]);
    expect(getJson()).toMatchObject({
      error: "invalid symbol parameter",
      symbols: ["BAD!"],
    });
    expect(quote).not.toHaveBeenCalled();
  });

  it("emits the canonical over-limit error message", async () => {
    const suffix = (n: number) =>
      n < 26
        ? String.fromCharCode(65 + n)
        : String.fromCharCode(65 + Math.floor(n / 26) - 1) +
          String.fromCharCode(65 + (n % 26));
    const many = Array.from({ length: 51 }, (_, i) => `T${suffix(i)}`).join(",");
    const { res, statusCalls, getJson } = makeRes();
    await handleBatchQuotes(makeReq({ symbols: many }), res);
    expect(statusCalls).toEqual([400]);
    expect(String((getJson() as { error: string }).error)).toContain(
      "Maximum is 50",
    );
    expect(quote).not.toHaveBeenCalled();
  });

  it("dedupes and case-folds before hitting Yahoo (unique tickers per run)", async () => {
    const { res, statusCalls, getJson } = makeRes();
    await handleBatchQuotes(makeReq({ symbol: ["zvva", "ZVVA", "ZVVB"] }), res);
    expect(statusCalls).toEqual([]);
    expect(quote).toHaveBeenCalledTimes(2);
    const requested = quote.mock.calls.map((c) => c[0]);
    expect(requested).toContain("ZVVA");
    expect(requested).toContain("ZVVB");
    // null placeholders for unresolvable quotes are preserved in order
    const body = getJson() as { quotes: unknown[] };
    expect(body.quotes).toHaveLength(2);
  });
});
