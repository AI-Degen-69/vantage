// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import StockFundamentalsStrip from "./StockFundamentalsStrip";
import type { StockMetrics } from "@shared/api";

/**
 * Regression net for the P/CF, P/FCF and ROIC rows shipped from the
 * Alpha Scope gap list. Pins the formatting contract:
 *
 *   - P/CF reads the real FMP `/stable/ratios-ttm` field
 *     (`priceToOperatingCashFlowRatioTTM`) and falls back to the legacy
 *     `/ratios` name (`priceToCashFlowRatioTTM`).
 *   - P/FCF reads `priceToFreeCashFlowRatioTTM`.
 *   - ROIC reads `key-metrics-ttm.roicTTM`, which FMP reports as a
 *     decimal fraction (0.44 = 44%) — the strip must convert to percent
 *     units so the row shows "44.05%" rather than "0.44%".
 *   - All three fall back to the "Unavailable" badge when the fields
 *     are absent (the Yahoo-only source path never provides them).
 */
describe("StockFundamentalsStrip — P/CF, P/FCF, ROIC rows", () => {
  const fmpMetrics: StockMetrics = {
    metrics: {
      roicTTM: 0.4405,
      freeCashFlowYieldTTM: 0.071,
    },
    ratios: {
      priceToOperatingCashFlowRatioTTM: 36.45,
      priceToFreeCashFlowRatioTTM: 40.67,
    },
    scores: null,
    source: "fmp",
  };

  const render = (metrics: StockMetrics | null | undefined) =>
    renderToString(
      <StockFundamentalsStrip
        quote={null}
        metrics={metrics}
        annualFinancials={undefined}
        quarterlyFinancials={undefined}
        loading={false}
      />,
    );

  it("renders P/CF, P/FCF and ROIC with formatted values from FMP metrics", () => {
    const html = render(fmpMetrics);
    expect(html).toContain("P/CF");
    expect(html).toContain("36.45"); // P/CF multiple (unit-free)
    expect(html).toContain("P/FCF");
    expect(html).toContain("40.67"); // P/FCF multiple
    expect(html).toContain("ROIC");
    expect(html).toContain("44.05%"); // 0.4405 fraction → percent units
  });

  it("falls back to the legacy priceToCashFlowRatioTTM alias for P/CF", () => {
    const legacy = render({
      metrics: {},
      ratios: { priceToCashFlowRatioTTM: 25.1 },
      scores: null,
      source: "fmp",
    } as StockMetrics);
    expect(legacy).toContain("25.10");
  });

  it("shows Unavailable for all three when the fields are missing (Yahoo-only source)", () => {
    const html = render({ metrics: {}, ratios: {}, scores: null, source: "yahoo" });
    expect(html).toContain("P/CF");
    expect(html).toContain("P/FCF");
    expect(html).toContain("ROIC");
    expect(html).toContain("Unavailable");
  });
});
