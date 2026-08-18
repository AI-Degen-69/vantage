import { describe, expect, it } from "vitest";
import { finite, formatMoney } from "./format";

describe("formatMoney", () => {
  it("keeps the minus sign before the currency symbol", () => {
    expect(formatMoney(-4_800_000_000)).toBe("-$4.80B");
  });

  it("renders positive values without a sign", () => {
    expect(formatMoney(4_800_000_000)).toBe("$4.80B");
  });

  it("scales to millions and trillions", () => {
    expect(formatMoney(1_500_000)).toBe("$1.50M");
    expect(formatMoney(5_330_000_000_000)).toBe("$5.33T");
  });

  it("keeps two decimals for sub-million values", () => {
    expect(formatMoney(1234.5)).toBe("$1234.50");
    expect(formatMoney(-42)).toBe("-$42.00");
  });

  it("returns null for non-finite input", () => {
    expect(formatMoney(undefined)).toBeNull();
    expect(formatMoney("abc")).toBeNull();
    expect(formatMoney(NaN)).toBeNull();
    expect(formatMoney(Infinity)).toBeNull();
  });
});

describe("finite", () => {
  it("coerces numeric strings and rejects non-finite values", () => {
    expect(finite(42)).toBe(42);
    expect(finite("3.5")).toBe(3.5);
    expect(finite(undefined)).toBeNull();
    expect(finite(NaN)).toBeNull();
    expect(finite(Infinity)).toBeNull();
  });
});
