import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StockMetrics } from "../../shared/api";

// Mock yahoo-finance2 so getYahooMetrics never touches the network.
const mockQuoteSummary = vi.fn();
vi.mock("yahoo-finance2", () => {
  class MockYahooFinance {
    constructor(_opts?: unknown) {}
    quote = vi.fn();
    chart = vi.fn();
    search = vi.fn();
    quoteSummary = mockQuoteSummary;
  }
  return { default: MockYahooFinance };
});

// Mock the KV-backed cache so getMetrics never reads a stale cached payload.
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();
vi.mock("../helpers/kvJsonCache", () => ({
  kvJsonCache: {
    get: mockCacheGet,
    set: mockCacheSet,
    __describeBackend: () => "local",
  },
}));

type StockService = typeof import("./stockService").stockService;

function freshService(): Promise<StockService> {
  vi.resetModules();
  return import("./stockService").then((m) => m.stockService);
}

/**
 * Yahoo quoteSummary payload where every trailing-PE / price-to-sales
 * primary field is absent and only their mislabeled aliases exist.
 */
const aliasOnlyPayload = {
  price: {},
  financialData: {
    returnOnEquity: { raw: 1.52 },
    returnOnAssets: { raw: 0.28 },
  },
  defaultKeyStatistics: {
    forwardPE: { raw: 30.1 },
    enterpriseToRevenue: { raw: 7.9 },
  },
  summaryDetail: {},
};

beforeEach(() => {
  process.env.FMP_KEY = "test-fmp-key";
  mockCacheGet.mockReset();
  mockCacheSet.mockReset();
  mockQuoteSummary.mockReset();
  mockCacheGet.mockResolvedValue(null);
  mockQuoteSummary.mockResolvedValue(aliasOnlyPayload);
  // FMP endpoints all come back empty → the Yahoo payload stands.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("[]", { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getMetrics Yahoo mapping correctness (CodeRabbit follow-ups)", () => {
  it("does not substitute forward P/E for trailing P/E", async () => {
    const svc = await freshService();
    const result: StockMetrics = await svc.getMetrics("TEST");
    // peRatioTTM is rendered under the client's "P/E (TTM)" label — a
    // forward estimate must stay undefined rather than masquerade.
    expect(result.metrics.peRatioTTM).toBeUndefined();
    expect(result.ratios.priceEarningsRatioTTM).toBeUndefined();
  });

  it("does not substitute EV/Revenue for Price/Sales while keeping EV/Sales", async () => {
    const svc = await freshService();
    const result: StockMetrics = await svc.getMetrics("TEST");
    expect(result.metrics.priceToSalesRatioTTM).toBeUndefined();
    expect(result.ratios.priceToSalesRatioTTM).toBeUndefined();
    // EV/Sales keeps its correct source.
    expect(result.metrics.evToSalesTTM).toBeCloseTo(7.9, 6);
  });

  it("converts decimal ROE/ROA to strict percent units at the API boundary", async () => {
    const svc = await freshService();
    const result: StockMetrics = await svc.getMetrics("TEST");
    // Yahoo's decimal fractions agree with the FMP percent-unit path:
    // strict ×100 (1.52 → 152), never the |n| ≤ 1 heuristic skip.
    expect(result.metrics.returnOnEquityTTM).toBeCloseTo(152, 6);
    expect(result.metrics.returnOnAssetsTTM).toBeCloseTo(28, 6);
  });
});
