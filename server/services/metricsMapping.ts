/**
 * Pure metric-mapping core for `stockService.getMetrics`.
 *
 * Extracted so the transformations are unit-testable without mocking
 * FMP endpoints or Yahoo: fixtures in, `StockMetrics` out. The service
 * keeps only orchestration (KV cache, network fan-out, fallback order).
 *
 * Precedent: `financialStatementFallback.ts`, `insiderUtils.ts`,
 * `marketDataReliability.ts`, `yahooQuoteShape.ts`.
 */

import type {
  AvailabilityState,
  KeyMetricsTTM,
  RatiosTTM,
  StockMetrics,
} from "../../shared/api";
import { normalizeYahooPercentage } from "./yahooQuoteShape";

/**
 * Numeric extractor that unwraps Yahoo's `{ raw: number }` field wrapper
 * recursively and rejects absent/non-numeric input as `undefined`.
 */
export function extractNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "object" && value !== null && "raw" in value) {
    return extractNumber((value as { raw?: unknown }).raw);
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function hasObjectValues(value: unknown): boolean {
  return Boolean(
    value && typeof value === "object" && Object.keys(value as object).length > 0,
  );
}

/**
 * Classify an FMP endpoint failure so the UI can show *why* a value is
 * missing: quota/auth → rateLimited, unknown symbol / no response →
 * notFound, anything else (typically a 200 with an empty free-tier
 * payload) → pro.
 */
export function classifyFmp(
  status: number | null,
  hasData: boolean,
): AvailabilityState | undefined {
  if (hasData) return undefined; // present → no badge
  if (status === 429 || status === 403) return "rateLimited";
  if (status === 404 || status === null) return "notFound";
  return "pro";
}

/**
 * Map a Yahoo `quoteSummary` payload (modules: defaultKeyStatistics,
 * financialData, summaryDetail, price) into the API's `StockMetrics`
 * shape. Pure — never throws on missing sections; an unusable payload
 * collapses to `{ metrics: {}, ratios: {}, source: null }`.
 *
 * Yahoo's free cash flow + market cap let us derive the price-to-cash-
 * flow coverage ratios without FMP's premium /ratios-ttm endpoint.
 * Derived metrics that lack an input are flagged `calcBroken`; roic is
 * FMP-premium only (Yahoo never supplies it), so it stays `pro`.
 */
export function yahooQuoteSummaryToMetrics(raw: any): StockMetrics {
  const dks = raw?.defaultKeyStatistics ?? {};
  const fd = raw?.financialData ?? {};
  const sd = raw?.summaryDetail ?? {};
  const price = raw?.price ?? {};
  const marketCap = extractNumber(price.marketCap) ?? null;
  const operatingCashFlow = extractNumber(fd.operatingCashflow) ?? null;
  const freeCashFlow = extractNumber(fd.freeCashflow) ?? null;
  const pcf =
    operatingCashFlow && marketCap ? marketCap / operatingCashFlow : null;
  const pfcf = freeCashFlow && marketCap ? marketCap / freeCashFlow : null;
  const fcfYield =
    freeCashFlow && marketCap ? (freeCashFlow / marketCap) * 100 : null;
  const metrics: KeyMetricsTTM = {
    revenuePerShareTTM: extractNumber(fd.revenuePerShare),
    netIncomePerShareTTM: extractNumber(dks.trailingEps),
    peRatioTTM:
      extractNumber(sd.trailingPE) ?? extractNumber(dks.forwardPE),
    dividendYieldTTM: normalizeYahooPercentage(
      extractNumber(sd.dividendYield) ??
        extractNumber(sd.trailingAnnualDividendYield),
    ),
    priceToSalesRatioTTM:
      extractNumber(sd.priceToSalesTrailing12Months) ??
      extractNumber(dks.enterpriseToRevenue),
    priceToBookRatioTTM: extractNumber(dks.priceToBook),
    evToSalesTTM: extractNumber(dks.enterpriseToRevenue),
    evToEBITDATTM: extractNumber(dks.enterpriseToEbitda),
    returnOnEquityTTM: extractNumber(fd.returnOnEquity),
    returnOnAssetsTTM: extractNumber(fd.returnOnAssets),
    freeCashFlowYieldTTM: fcfYield ?? undefined,
  };
  const ratios: RatiosTTM = {
    priceEarningsRatioTTM: extractNumber(sd.trailingPE),
    priceToBookRatioTTM: extractNumber(dks.priceToBook),
    priceToSalesRatioTTM:
      extractNumber(sd.priceToSalesTrailing12Months) ??
      extractNumber(dks.enterpriseToRevenue),
    priceToEarningsGrowthRatioTTM: extractNumber(dks.pegRatio),
    priceToOperatingCashFlowRatioTTM: pcf ?? undefined,
    priceToFreeCashFlowRatioTTM: pfcf ?? undefined,
    netProfitMargin: normalizeYahooPercentage(extractNumber(fd.profitMargins)),
    operatingProfitMarginTTM: normalizeYahooPercentage(
      extractNumber(fd.operatingMargins),
    ),
    grossProfitMarginTTM: normalizeYahooPercentage(
      extractNumber(fd.grossMargins),
    ),
    dividendPayoutRatioTTM: normalizeYahooPercentage(
      extractNumber(sd.payoutRatio),
    ),
    currentRatio: extractNumber(fd.currentRatio),
    quickRatio: extractNumber(fd.quickRatio),
    debtToEquityRatio: extractNumber(fd.debtToEquity),
  };
  const hasValues =
    Object.values(metrics).some((v) => v !== undefined) ||
    Object.values(ratios).some((v) => v !== undefined);
  const availability: Partial<Record<string, AvailabilityState>> = {
    pcf: pcf === null ? "calcBroken" : "available",
    pfcf: pfcf === null ? "calcBroken" : "available",
    fcfYield: fcfYield === null ? "calcBroken" : "available",
    roic: "pro",
  };
  return {
    metrics: hasValues ? metrics : {},
    ratios: hasValues ? ratios : {},
    scores: null,
    source: hasValues ? "yahoo" : null,
    availability: hasValues ? availability : undefined,
  };
}
