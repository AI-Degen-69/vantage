import { describe, expect, it } from "vitest";
import { formatLargeNumber } from "./format";

/**
 * Pins the canonical shared formatter that replaces the two drifted
 * formatLargeNumber copies (StockSlideOver.tsx client, stockAggregator.ts
 * server). Tier behavior matches the live server copy; the sign position
 * for negative money is the intended fix (-$4.80M, not $-4.80M).
 */
describe("formatLargeNumber", () => {
  it("returns em-dash for null and undefined", () => {
    expect(formatLargeNumber(null)).toBe("—");
    expect(formatLargeNumber(undefined)).toBe("—");
  });

  it("returns em-dash for non-finite numbers instead of leaking NaN", () => {
    expect(formatLargeNumber(Number.NaN)).toBe("—");
    expect(formatLargeNumber(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("renders zero as $0 (0 when the $ is omitted)", () => {
    expect(formatLargeNumber(0)).toBe("$0");
    expect(formatLargeNumber(0, { omit$: true })).toBe("0");
  });

  it("uses K/M/B/T tiers with two decimals", () => {
    expect(formatLargeNumber(1_000)).toBe("$1.00K");
    expect(formatLargeNumber(1_234_567)).toBe("$1.23M");
    expect(formatLargeNumber(2_500_000_000)).toBe("$2.50B");
    expect(formatLargeNumber(3_200_000_000_000)).toBe("$3.20T");
  });

  it("keeps the inherited no-promotion tier boundary (parity with old copies)", () => {
    // 999_999 sits below the M tier in both legacy copies, so it rendered
    // as 1000.00K. Promoting to $1.00M is a separate behavior change.
    expect(formatLargeNumber(999_999)).toBe("$1000.00K");
  });

  it("renders small values without a suffix and without forced zeros", () => {
    expect(formatLargeNumber(500)).toBe("$500");
    expect(formatLargeNumber(999.9)).toBe("$999.9");
  });

  it("places the sign before the currency symbol for negative money", () => {
    expect(formatLargeNumber(-4_800_000)).toBe("-$4.80M");
    expect(formatLargeNumber(-1_234)).toBe("-$1.23K");
    expect(formatLargeNumber(-500)).toBe("-$500");
  });

  it("omits the $ for count-style values (avg volume)", () => {
    expect(formatLargeNumber(1_234_567, { omit$: true })).toBe("1.23M");
    expect(formatLargeNumber(-4_800_000, { omit$: true })).toBe("-4.80M");
  });
});
