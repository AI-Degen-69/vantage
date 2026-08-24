import { describe, expect, it } from "vitest";
import {
  classifyFmp,
  extractNumber,
  hasObjectValues,
  yahooQuoteSummaryToMetrics,
} from "./metricsMapping";

/**
 * Table-driven coverage for the pure metric-mapping core extracted out of
 * `stockService.getMetrics`. Zero network, zero mocks — fixtures in,
 * `StockMetrics` out.
 */

describe("extractNumber", () => {
  it("passes through finite numbers and numeric strings", () => {
    expect(extractNumber(5)).toBe(5);
    expect(extractNumber("12.5")).toBe(12.5);
    expect(extractNumber(-3)).toBe(-3);
    expect(extractNumber(0)).toBe(0);
  });

  it("unwraps Yahoo's {raw} wrapper recursively", () => {
    expect(extractNumber({ raw: 42 })).toBe(42);
    expect(extractNumber({ raw: { raw: 7 } })).toBe(7);
    expect(extractNumber({ raw: "8.25" })).toBe(8.25);
    expect(extractNumber({ fmt: "5x", raw: 5 })).toBe(5);
  });

  it("returns undefined for absent or non-numeric input", () => {
    expect(extractNumber(undefined)).toBeUndefined();
    expect(extractNumber(null)).toBeUndefined();
    expect(extractNumber("")).toBeUndefined();
    expect(extractNumber({})).toBeUndefined();
    expect(extractNumber({ raw: undefined })).toBeUndefined();
    expect(extractNumber("not-a-number")).toBeUndefined();
    expect(extractNumber(Number.NaN)).toBeUndefined();
  });
});

describe("classifyFmp", () => {
  it("returns undefined when data is present regardless of status", () => {
    expect(classifyFmp(200, true)).toBeUndefined();
    expect(classifyFmp(null, true)).toBeUndefined();
    expect(classifyFmp(500, true)).toBeUndefined();
  });

  it("maps quota/auth failures to rateLimited", () => {
    expect(classifyFmp(429, false)).toBe("rateLimited");
    expect(classifyFmp(403, false)).toBe("rateLimited");
  });

  it("maps unknown symbols and missing responses to notFound", () => {
    expect(classifyFmp(404, false)).toBe("notFound");
    expect(classifyFmp(null, false)).toBe("notFound");
  });

  it("treats any other failure (incl. empty 200 payloads) as pro", () => {
    expect(classifyFmp(200, false)).toBe("pro");
    expect(classifyFmp(500, false)).toBe("pro");
    expect(classifyFmp(502, false)).toBe("pro");
  });
});

describe("hasObjectValues", () => {
  it("is true only for non-empty objects", () => {
    expect(hasObjectValues({ a: 1 })).toBe(true);
    expect(hasObjectValues({})).toBe(false);
    expect(hasObjectValues(null)).toBe(false);
    expect(hasObjectValues(undefined)).toBe(false);
    expect(hasObjectValues("str")).toBe(false);
    expect(hasObjectValues([1, 2])).toBe(true);
  });
});

describe("yahooQuoteSummaryToMetrics", () => {
  const fullFixture = {
    defaultKeyStatistics: {
      trailingEps: { raw: 6.57 },
      forwardPE: { raw: 30.1 },
      priceToBook: { raw: 48.2 },
      enterpriseToRevenue: { raw: 7.9 },
      enterpriseToEbitda: { raw: 24.3 },
      pegRatio: { raw: 1.8 },
    },
    financialData: {
      revenuePerShare: { raw: 25.1 },
      dividendYield: 0.0044,
      returnOnEquity: 1.52,
      returnOnAssets: 0.28,
      profitMargins: 0.26,
      operatingMargins: 0.32,
      grossMargins: 0.46,
      payoutRatio: 0.153,
      currentRatio: 0.87,
      quickRatio: 0.83,
      debtToEquity: 145.7,
      operatingCashflow: { raw: 118_000_000_000 },
      freeCashflow: { raw: 108_000_000_000 },
    },
    summaryDetail: {
      trailingPE: { raw: 34.6 },
      priceToSalesTrailing12Months: { raw: 9.1 },
      dividendYield: 0.0044,
      payoutRatio: 0.153,
    },
    price: { marketCap: { raw: 3_456_000_000_000 } },
  };

  it("maps a full quoteSummary into metrics, ratios, and availability", () => {
    const result = yahooQuoteSummaryToMetrics(fullFixture as any);
    expect(result.source).toBe("yahoo");
    expect(result.scores).toBeNull();
    expect(result.metrics.peRatioTTM).toBeCloseTo(34.6, 6);
    expect(result.metrics.netIncomePerShareTTM).toBeCloseTo(6.57, 6);
    // decimal yields/margins convert to percent units
    expect(result.metrics.dividendYieldTTM).toBeCloseTo(0.44, 6);
    expect(result.ratios.netProfitMargin).toBeCloseTo(26, 6);
    expect(result.ratios.grossProfitMarginTTM).toBeCloseTo(46, 6);
    expect(result.ratios.currentRatio).toBeCloseTo(0.87, 6);
    // derived cash-flow ratios: 3456e9 / 118e9 ≈ 29.29
    expect(result.ratios.priceToOperatingCashFlowRatioTTM).toBeCloseTo(
      3_456_000_000_000 / 118_000_000_000,
      6,
    );
    expect(result.ratios.priceToFreeCashFlowRatioTTM).toBeCloseTo(
      3_456_000_000_000 / 108_000_000_000,
      6,
    );
    expect(result.metrics.freeCashFlowYieldTTM).toBeCloseTo(
      (108_000_000_000 / 3_456_000_000_000) * 100,
      6,
    );
    expect(result.availability).toMatchObject({
      pcf: "available",
      pfcf: "available",
      fcfYield: "available",
      roic: "pro",
    });
  });

  it("flags calcBroken availability when cash-flow inputs are missing", () => {
    const broken = {
      ...fullFixture,
      financialData: { ...fullFixture.financialData },
    };
    delete (broken.financialData as Record<string, unknown>).operatingCashflow;
    delete (broken.financialData as Record<string, unknown>).freeCashflow;
    const result = yahooQuoteSummaryToMetrics(broken as any);
    expect(result.ratios.priceToOperatingCashFlowRatioTTM).toBeUndefined();
    expect(result.ratios.priceToFreeCashFlowRatioTTM).toBeUndefined();
    expect(result.metrics.freeCashFlowYieldTTM).toBeUndefined();
    expect(result.availability).toMatchObject({
      pcf: "calcBroken",
      pfcf: "calcBroken",
      fcfYield: "calcBroken",
    });
  });

  it("collapses to an empty no-source payload when Yahoo returns nothing usable", () => {
    const result = yahooQuoteSummaryToMetrics({} as any);
    expect(result.source).toBeNull();
    expect(result.metrics).toEqual({});
    expect(result.ratios).toEqual({});
    expect(result.scores).toBeNull();
    expect(result.availability).toBeUndefined();
  });

  it("falls back through the pe chain (trailingPE missing → forwardPE)", () => {
    const noTrailingPe = JSON.parse(JSON.stringify(fullFixture));
    delete noTrailingPe.summaryDetail.trailingPE;
    const result = yahooQuoteSummaryToMetrics(noTrailingPe as any);
    expect(result.metrics.peRatioTTM).toBeCloseTo(30.1, 6);
  });
});
