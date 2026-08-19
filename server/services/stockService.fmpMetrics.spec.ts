import { describe, expect, it } from "vitest";
import { fmpToPercent } from "./stockService";

/**
 * Pins the FMP percent-unit normalization at the API boundary. FMP
 * reports percentage metrics as decimal fractions (0.269 = 26.9%) that
 * can exceed 1 (AAPL ROE ≈ 1.52 = 152%), so the conversion must be a
 * strict ×100 — unlike `normalizeYahooPercentage`'s |n| ≤ 1 heuristic —
 * and must pass negatives and zero through unchanged.
 */
describe("fmpToPercent (FMP metrics boundary normalization)", () => {
  it("converts decimal fractions to percent units", () => {
    // ×100 of a fraction lands on a float (0.269 * 100 = 26.9000002),
    // so compare with tolerance.
    expect(fmpToPercent(0.269)).toBeCloseTo(26.9);
    expect(fmpToPercent(0.4405)).toBeCloseTo(44.05);
    expect(fmpToPercent(0.071)).toBeCloseTo(7.1);
    expect(fmpToPercent(0.0038)).toBeCloseTo(0.38);
  });

  it("keeps values above 1 intact (ROE > 100%)", () => {
    expect(fmpToPercent(1.5191)).toBeCloseTo(151.91);
  });

  it("passes negatives and zero through", () => {
    expect(fmpToPercent(-0.1234)).toBe(-12.34);
    expect(fmpToPercent(0)).toBe(0);
  });

  it("returns undefined for missing or non-finite values", () => {
    expect(fmpToPercent(undefined)).toBeUndefined();
    expect(fmpToPercent(null)).toBeUndefined();
    expect(fmpToPercent("")).toBeUndefined();
    expect(fmpToPercent("n/a")).toBeUndefined();
  });
});
