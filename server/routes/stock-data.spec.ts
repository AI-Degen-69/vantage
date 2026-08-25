import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import {
  handleBatchQuotes,
  handleEarningsCalendar,
  handleFxRates,
  handleSectorHeatmap,
  handleSmaDistances,
} from "./stock-data";

function fakeQuote(symbol: string) {
  return {
    symbol,
    name: "",
    price: 100,
    change: 0,
    changesPercentage: 0,
    previousClose: undefined,
    dayLow: undefined,
    dayHigh: undefined,
    yearLow: undefined,
    yearHigh: undefined,
    priceAvg50: undefined,
    priceAvg200: undefined,
    marketCap: undefined,
    volume: undefined,
    avgVolume: undefined,
    exchange: undefined,
    sharesOutstanding: undefined,
    eps: undefined,
    pe: undefined,
    earningsAnnouncement: null,
  };
}

vi.mock("../services/stockService", () => ({
  stockService: {
    getBatchQuotes: vi.fn(async (symbols: string[]) => ({
      quotes: symbols.map(fakeQuote),
    })),
    getSectorHeatmap: vi.fn(async () => ({
      days: [],
      rows: [],
      untagged: [],
      generatedAt: "2026-08-02T00:00:00.000Z",
    })),
    getEarningsCalendar: vi.fn(async (from: string, to: string) => [
      { symbol: "AAPL", date: from },
    ]),
    getFxRates: vi.fn(async (currencies: string[]) => ({
      rates: Object.fromEntries(currencies.map((c) => [c, 1])),
      fetchedAt: "2026-08-24T00:00:00.000Z",
      source: "yahoo",
    })),
    getSmaDistancesFor: vi.fn(
      async (symbols: string[], windowSize: number) => ({
        window: windowSize,
        results: symbols.map((symbol) => ({
          symbol,
          price: 100,
          sma: 95,
          distancePct: 5,
        })),
      }),
    ),
  },
}));

import { stockService } from "../services/stockService";
const mockedBatch = vi.mocked(stockService.getBatchQuotes);
const mockedHeatmap = vi.mocked(stockService.getSectorHeatmap);
const mockedCalendar = vi.mocked(stockService.getEarningsCalendar);
const mockedFx = vi.mocked(stockService.getFxRates);
const mockedSma = vi.mocked(stockService.getSmaDistancesFor);

/** Minimal Express req/res doubles; every assertion here is against the shape
 * the real handler produces (status code, JSON body), so a full request
 * object is unnecessary. */
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

function makeReq(query: Record<string, unknown>): Request {
  return { query } as unknown as Request;
}

describe("handleBatchQuotes (route validation)", () => {
  beforeEach(() => {
    mockedBatch.mockClear();
  });

  it("rejects a missing symbols parameter without calling the service", async () => {
    const { res, statusCalls, getJson } = makeRes();
    await handleBatchQuotes(makeReq({}), res, () => undefined);
    expect(statusCalls).toEqual([400]);
    expect(getJson()).toEqual({ error: "symbols parameter required" });
    expect(mockedBatch).not.toHaveBeenCalled();
  });

  it("rejects invalid symbols without calling the service", async () => {
    const { res, statusCalls, getJson } = makeRes();
    await handleBatchQuotes(
      makeReq({ symbols: "AAPL,1NVDA,BAD!" }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([400]);
    expect(getJson()).toMatchObject({ error: "invalid symbol parameter" });
    expect(mockedBatch).not.toHaveBeenCalled();
  });

  it("deduplicates symbols and passes the cleaned list to the service", async () => {
    const { res, statusCalls, getJson } = makeRes();
    await handleBatchQuotes(
      makeReq({ symbols: "aapl, AAPL,MSFT" }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([]);
    expect(getJson()).toEqual({
      quotes: [fakeQuote("AAPL"), fakeQuote("MSFT")],
    });
    expect(mockedBatch).toHaveBeenCalledTimes(1);
    expect(mockedBatch).toHaveBeenCalledWith(["AAPL", "MSFT"]);
  });

  it("rejects over-limit symbol lists without calling the service", async () => {
    // 51 unique tickers that satisfy the route's ^[A-Z]{1,5}$ pattern
    // (digits are invalid, so use letter suffixes).
    const suffix = (n: number) =>
      n < 26
        ? String.fromCharCode(65 + n)
        : String.fromCharCode(65 + Math.floor(n / 26) - 1) +
          String.fromCharCode(65 + (n % 26));
    const many = Array.from({ length: 51 }, (_, i) => `T${suffix(i)}`).join(
      ",",
    );
    const { res, statusCalls, getJson } = makeRes();
    await handleBatchQuotes(makeReq({ symbols: many }), res, () => undefined);
    expect(statusCalls).toEqual([400]);
    expect(String((getJson() as { error: string }).error)).toContain(
      "Maximum is 50",
    );
    expect(mockedBatch).not.toHaveBeenCalled();
  });

  it("keeps service null placeholders in the response body and never echoes keys", async () => {
    mockedBatch.mockResolvedValueOnce({
      quotes: [fakeQuote("AAPL"), null],
    });
    const { res, statusCalls, getJson } = makeRes();
    await handleBatchQuotes(
      makeReq({ symbols: "AAPL,MSFT" }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([]);
    expect(getJson()).toEqual({ quotes: [fakeQuote("AAPL"), null] });
    expect(JSON.stringify(getJson())).not.toMatch(
      /FMP_KEY|AV_KEY|apikey|token/i,
    );
  });
});

describe("handleSectorHeatmap (route validation)", () => {
  beforeEach(() => {
    mockedHeatmap.mockClear();
  });

  it("passes curated sector metadata through to the service", async () => {
    const { res, statusCalls } = makeRes();
    await handleSectorHeatmap(
      makeReq({
        symbols: "AAPL,MSFT",
        sectorMeta: "AAPL:Technology,MSFT:Technology",
      }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([]);
    expect(mockedHeatmap).toHaveBeenCalledTimes(1);
    const [symbols, days, allow, meta] = mockedHeatmap.mock.calls[0];
    expect(symbols).toEqual(["AAPL", "MSFT"]);
    expect(days).toBe(5);
    expect(allow).toBeNull();
    expect(meta).toEqual({ AAPL: "Technology", MSFT: "Technology" });
  });

  it("passes an empty metadata map when sectorMeta is absent", async () => {
    const { res, statusCalls } = makeRes();
    await handleSectorHeatmap(
      makeReq({ symbols: "AAPL,MSFT" }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([]);
    expect(mockedHeatmap).toHaveBeenCalledTimes(1);
    const [, , , meta] = mockedHeatmap.mock.calls[0];
    expect(meta).toEqual({});
  });

  it("rejects metadata with an invalid ticker without calling the service", async () => {
    const { res, statusCalls, getJson } = makeRes();
    await handleSectorHeatmap(
      makeReq({ symbols: "AAPL,MSFT", sectorMeta: "AAPL1:Technology" }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([400]);
    expect(getJson()).toMatchObject({
      error: "invalid sector metadata parameter",
    });
    expect(mockedHeatmap).not.toHaveBeenCalled();
  });

  it("rejects metadata with a blank or oversized sector without calling the service", async () => {
    const oversized = "X".repeat(65);
    const { res, statusCalls } = makeRes();
    await handleSectorHeatmap(
      makeReq({ symbols: "AAPL,MSFT", sectorMeta: `AAPL:${oversized}` }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([400]);
    expect(mockedHeatmap).not.toHaveBeenCalled();

    const blank = makeRes();
    await handleSectorHeatmap(
      makeReq({ symbols: "AAPL,MSFT", sectorMeta: "AAPL:" }),
      blank.res,
      () => undefined,
    );
    expect(blank.statusCalls).toEqual([400]);
    expect(mockedHeatmap).not.toHaveBeenCalled();
  });

  it("rejects metadata with too many entries without calling the service", async () => {
    const many = Array.from({ length: 51 }, (_, i) => `T${i}:Technology`).join(
      ",",
    );
    const { res, statusCalls } = makeRes();
    await handleSectorHeatmap(
      makeReq({ symbols: "AAPL,MSFT", sectorMeta: many }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([400]);
    expect(mockedHeatmap).not.toHaveBeenCalled();
  });

  it("never leaks provider keys in metadata error responses", async () => {
    const { res, statusCalls, getJson } = makeRes();
    await handleSectorHeatmap(
      makeReq({ symbols: "AAPL,MSFT", sectorMeta: "AAPL:Tech,FMP_KEY:leak" }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([400]);
    expect(JSON.stringify(getJson())).not.toMatch(
      /FMP_KEY|AV_KEY|apikey|token/i,
    );
  });

  it("rejects a repeated sectorMeta parameter (array form) without calling the service", async () => {
    // Express turns `?sectorMeta=AAPL:Tech&sectorMeta=MSFT:Tech` into an
    // array; symbol-list semantics don't apply to metadata, so this must
    // be rejected rather than silently accepted as empty metadata.
    const { res, statusCalls, getJson } = makeRes();
    await handleSectorHeatmap(
      makeReq({ symbols: "AAPL,MSFT", sectorMeta: ["AAPL:Tech", "MSFT:Tech"] }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([400]);
    expect(getJson()).toMatchObject({
      error: "invalid sector metadata parameter",
    });
    expect(mockedHeatmap).not.toHaveBeenCalled();
  });
});

describe("handleSmaDistances (route validation)", () => {
  beforeEach(() => {
    mockedSma.mockClear();
  });

  it("rejects a missing symbols parameter without calling the service", async () => {
    const { res, statusCalls, getJson } = makeRes();
    await handleSmaDistances(makeReq({}), res, () => undefined);
    expect(statusCalls).toEqual([400]);
    expect(getJson()).toEqual({ error: "symbols parameter required" });
    expect(mockedSma).not.toHaveBeenCalled();
  });

  it("rejects invalid tickers via the symbols parameter", async () => {
    const { res, statusCalls, getJson } = makeRes();
    await handleSmaDistances(
      makeReq({ symbols: "AAPL,BAD!" }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([400]);
    expect(getJson()).toMatchObject({ error: "invalid symbol parameter" });
    expect(mockedSma).not.toHaveBeenCalled();
  });

  it("rejects invalid tickers supplied via repeated symbol parameters", async () => {
    const { res, statusCalls, getJson } = makeRes();
    await handleSmaDistances(
      makeReq({ symbol: ["AAPL", "1NVDA"] }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([400]);
    expect(getJson()).toMatchObject({ error: "invalid symbol parameter" });
    expect(mockedSma).not.toHaveBeenCalled();
  });

  it("accepts the documented repeated symbol=AAPL&symbol=MSFT form and dedupes", async () => {
    const { res, statusCalls, getJson } = makeRes();
    await handleSmaDistances(
      makeReq({ symbol: ["aapl", "AAPL", "MSFT"] }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([]);
    expect(getJson()).toMatchObject({
      window: 200,
      results: [{ symbol: "AAPL" }, { symbol: "MSFT" }],
    });
    expect(mockedSma).toHaveBeenCalledTimes(1);
    expect(mockedSma).toHaveBeenCalledWith(["AAPL", "MSFT"], 200);
  });

  it("rejects over-limit symbol lists without calling the service", async () => {
    const suffix = (n: number) =>
      n < 26
        ? String.fromCharCode(65 + n)
        : String.fromCharCode(65 + Math.floor(n / 26) - 1) +
          String.fromCharCode(65 + (n % 26));
    const many = Array.from({ length: 51 }, (_, i) => `T${suffix(i)}`).join(
      ",",
    );
    const { res, statusCalls, getJson } = makeRes();
    await handleSmaDistances(makeReq({ symbols: many }), res, () => undefined);
    expect(statusCalls).toEqual([400]);
    expect(String((getJson() as { error: string }).error)).toContain(
      "Maximum is 50",
    );
    expect(mockedSma).not.toHaveBeenCalled();
  });
});

describe("handleEarningsCalendar (route validation)", () => {
  beforeEach(() => {
    mockedCalendar.mockClear();
  });

  it("rejects non-ISO dates without calling the service", async () => {
    const badFroms = [
      "2026-13-01",
      "not-a-date",
      "2026-02-30",
      "08/24/2026",
      "",
    ];
    for (const bad of badFroms) {
      const { res, statusCalls } = makeRes();
      await handleEarningsCalendar(
        makeReq({ from: bad, to: "2026-08-24" }),
        res,
        () => undefined,
      );
      expect(statusCalls, `from=${bad}`).toEqual([400]);
      expect(mockedCalendar).not.toHaveBeenCalled();
    }
    for (const bad of badFroms.slice(1)) {
      const { res, statusCalls } = makeRes();
      await handleEarningsCalendar(
        makeReq({ from: "2026-08-24", to: bad }),
        res,
        () => undefined,
      );
      expect(statusCalls, `to=${bad}`).toEqual([400]);
      expect(mockedCalendar).not.toHaveBeenCalled();
    }
  });

  it("rejects ranges outside 0-31 days", async () => {
    const { res, statusCalls } = makeRes();
    await handleEarningsCalendar(
      makeReq({ from: "2026-08-01", to: "2026-09-15" }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([400]);
    expect(mockedCalendar).not.toHaveBeenCalled();

    const reversed = makeRes();
    await handleEarningsCalendar(
      makeReq({ from: "2026-08-24", to: "2026-08-20" }),
      reversed.res,
      () => undefined,
    );
    expect(reversed.statusCalls).toEqual([400]);
    expect(mockedCalendar).not.toHaveBeenCalled();
  });

  it("accepts a valid range and forwards the dates to the service", async () => {
    const { res, statusCalls, getJson } = makeRes();
    await handleEarningsCalendar(
      makeReq({ from: "2026-08-01", to: "2026-08-24" }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([]);
    expect(mockedCalendar).toHaveBeenCalledWith("2026-08-01", "2026-08-24");
    expect(getJson()).toEqual([{ symbol: "AAPL", date: "2026-08-01" }]);
  });

  it("accepts the inclusive boundaries: same-day (0) and exactly 31 days", async () => {
    const sameDay = makeRes();
    await handleEarningsCalendar(
      makeReq({ from: "2026-08-24", to: "2026-08-24" }),
      sameDay.res,
      () => undefined,
    );
    expect(sameDay.statusCalls).toEqual([]);
    expect(mockedCalendar).toHaveBeenCalledWith("2026-08-24", "2026-08-24");

    const exact31 = makeRes();
    await handleEarningsCalendar(
      makeReq({ from: "2026-07-24", to: "2026-08-24" }),
      exact31.res,
      () => undefined,
    );
    expect(exact31.statusCalls).toEqual([]);
    expect(mockedCalendar).toHaveBeenCalledWith("2026-07-24", "2026-08-24");
  });
});

describe("handleFxRates (route validation)", () => {
  beforeEach(() => {
    mockedFx.mockClear();
  });

  it("defaults to USD, ILS, EUR when the parameter is absent", async () => {
    const { res, statusCalls } = makeRes();
    await handleFxRates(makeReq({}), res, () => undefined);
    expect(statusCalls).toEqual([]);
    expect(mockedFx).toHaveBeenCalledWith(["USD", "ILS", "EUR"]);
  });

  it("rejects an explicitly empty currencies value instead of substituting defaults", async () => {
    // `?currencies=` means the caller asked for nothing — same as any
    // all-unsupported list — NOT a silent fallback to defaults.
    const { res, statusCalls, getJson } = makeRes();
    await handleFxRates(makeReq({ currencies: "" }), res, () => undefined);
    expect(statusCalls).toEqual([400]);
    expect(getJson()).toMatchObject({ error: "currencies parameter required" });
    expect(mockedFx).not.toHaveBeenCalled();
  });

  it("uppercases and trims supported currencies", async () => {
    const { res, statusCalls } = makeRes();
    await handleFxRates(
      makeReq({ currencies: " gbp ,usd " }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([]);
    expect(mockedFx).toHaveBeenCalledWith(["GBP", "USD"]);
  });

  it("dedupes repeated currencies while preserving first-seen order", async () => {
    // Duplicates would multiply upstream pair requests in getFxRates.
    const { res, statusCalls } = makeRes();
    await handleFxRates(
      makeReq({ currencies: "EUR,USD,EUR,ILS,usd" }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([]);
    expect(mockedFx).toHaveBeenCalledWith(["EUR", "USD", "ILS"]);
  });

  it("returns the service payload verbatim on success", async () => {
    const { res, statusCalls, getJson } = makeRes();
    await handleFxRates(
      makeReq({ currencies: "USD,ILS" }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([]);
    expect(getJson()).toEqual({
      rates: { USD: 1, ILS: 1 },
      fetchedAt: "2026-08-24T00:00:00.000Z",
      source: "yahoo",
    });
  });

  it("documents lenient filtering: unknown currencies are dropped individually", async () => {
    // `?currencies=USD,JPY` serves USD rather than erroring — the
    // documented lenient semantics. If this ever flips to strict
    // (400 on any unknown code), update this test AND the client.
    const { res, statusCalls } = makeRes();
    await handleFxRates(
      makeReq({ currencies: "USD,JPY" }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([]);
    expect(mockedFx).toHaveBeenCalledWith(["USD"]);
  });

  it("rejects requests where every currency is unsupported", async () => {
    const { res, statusCalls, getJson } = makeRes();
    await handleFxRates(
      makeReq({ currencies: "JPY,CAD" }),
      res,
      () => undefined,
    );
    expect(statusCalls).toEqual([400]);
    expect(getJson()).toMatchObject({ error: "currencies parameter required" });
    expect(mockedFx).not.toHaveBeenCalled();
  });
});
