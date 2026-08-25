import { describe, expect, it } from "vitest";
import { finite, formatMoney, formatMoneyCompact } from "./format";

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

describe("formatMoneyCompact", () => {
  it("scales across the T/B/M/K tiers with a $ prefix", () => {
    expect(formatMoneyCompact(5_330_000_000_000)).toBe("$5.33T");
    expect(formatMoneyCompact(2_450_000_000)).toBe("$2.45B");
    expect(formatMoneyCompact(52_340_000)).toBe("$52.34M");
    expect(formatMoneyCompact(9_500)).toBe("$9.50K");
  });

  it("uses locale grouping below the K tier", () => {
    expect(formatMoneyCompact(999)).toBe("$999");
    expect(formatMoneyCompact(250)).toBe("$250");
  });

  it("keeps the minus sign before the currency symbol", () => {
    expect(formatMoneyCompact(-1_234_000_000)).toBe("-$1.23B");
  });

  it("honors an explicit decimals override", () => {
    expect(formatMoneyCompact(2_450_000_000, 2)).toBe("$2.45B");
    expect(formatMoneyCompact(52_340_000, 0)).toBe("$52M");
  });

  it("promotes the tier when rounding crosses the boundary", () => {
    expect(formatMoneyCompact(999_999)).toBe("$1.00M");
    expect(formatMoneyCompact(999_999_999)).toBe("$1.00B");
    expect(formatMoneyCompact(949_999)).toBe("$950.00K");
  });

  it("promotes sub-K values that round up to 1,000 into the K tier", () => {
    expect(formatMoneyCompact(999.5)).toBe("$1.00K");
    expect(formatMoneyCompact(999.49)).toBe("$999");
    expect(formatMoneyCompact(-999.5)).toBe("-$1.00K");
  });

  it("returns null for missing or non-finite input so callers render em-dashes", () => {
    expect(formatMoneyCompact(undefined)).toBeNull();
    expect(formatMoneyCompact(null)).toBeNull();
    expect(formatMoneyCompact(Number.NaN)).toBeNull();
    expect(formatMoneyCompact(Infinity)).toBeNull();
  });
});
