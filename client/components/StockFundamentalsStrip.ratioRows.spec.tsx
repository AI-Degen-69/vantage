// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import StockFundamentalsStrip from "./StockFundamentalsStrip";
import type { StockMetrics } from "@shared/api";

/**
 * Regression net for the P/CF, P/FCF and ROIC rows shipped from the
 * Alpha Scope gap list, plus the FMP percent-unit normalization.
 * Pins the formatting contract:
 *
 *   - P/CF reads the real FMP `/stable/ratios-ttm` field
 *     (`priceToOperatingCashFlowRatioTTM`) and falls back to the legacy
 *     `/ratios` name (`priceToCashFlowRatioTTM`).
 *   - P/FCF reads `priceToFreeCashFlowRatioTTM`.
 *   - ROIC reads `key-metrics-ttm.roicTTM`.
 *   - PERCENT UNITS: the FMP metrics path normalizes percentage fields
 *     to percent units at the API boundary (`fmpToPercent`: FMP's
 *     0.4405 fraction → 44.05). The strip contract is therefore
 *     percent-units — `formatPercent` displays 44.05 as "44.05%",
 *     never as "0.44%". This pins Profit Margin, FCF Yield, Dividend
 *     Yield and Payout Ratio too.
 *   - All rows fall back to the "Unavailable" badge when the fields
 *     are absent (the Yahoo-only source path never provides the
 *     cash-flow multiples or ROIC).
 */
describe("StockFundamentalsStrip — P/CF, P/FCF, ROIC rows", () => {
  // Payload as normalized by the server: percent fields already in
  // percent units (26.9 = 26.90%), multiples unit-free.
  const fmpMetrics: StockMetrics = {
    metrics: {
      roicTTM: 44.05,
      freeCashFlowYieldTTM: 7.1,
      dividendYielTTM: 0.38,
    },
    ratios: {
      priceToOperatingCashFlowRatioTTM: 36.45,
      priceToFreeCashFlowRatioTTM: 40.67,
      netProfitMargin: 26.9,
      dividendPayoutRatioTTM: 13.77,
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
    expect(html).toContain("44.05%"); // 44.05 percent units → "44.05%"
  });

  it("displays the normalized FMP percent rows in percent units, not fractions", () => {
    const html = render(fmpMetrics);
    // These used to render as "0.27%"-style fractions when FMP was the
    // live source; the server-side normalization fixes them all.
    expect(html).toContain("26.90%"); // Profit Margin (0.269 → 26.9)
    expect(html).toContain("7.10%"); // FCF Yield (0.071 → 7.1)
    expect(html).toContain("0.38%"); // Dividend Yield (0.0038 → 0.38)
    expect(html).toContain("13.77%"); // Payout Ratio (0.1377 → 13.77)
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

  it("keeps negative and zero ROIC percent values intact", () => {
    // Loss-making company: server sends the negative percent already.
    const loss = render({
      metrics: { roicTTM: -12.34 },
      ratios: {},
      scores: null,
      source: "fmp",
    } as StockMetrics);
    expect(loss).toContain("-12.34%");

    // Zero ROIC must render "0.00%", not fall through to Unavailable.
    const breakeven = render({
      metrics: { roicTTM: 0 },
      ratios: {},
      scores: null,
      source: "fmp",
    } as StockMetrics);
    expect(breakeven).toContain("0.00%");
  });
});
