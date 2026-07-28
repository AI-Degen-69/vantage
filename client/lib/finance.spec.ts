import { describe, expect, it } from "vitest";
import {
  annualizedVolatility,
  cagr,
  irrBisection,
  sharpeRatio,
  sortinoRatio,
  totalReturn,
} from "./finance";

describe("irrBisection", () => {
  it("rejects tiny inputs (< 2 cashflows)", () => {
    const r = irrBisection([{ date: "2024-01-01", amount: -100 }]);
    expect(r.reason).toBe("too_few_points");
    expect(r.rate).toBeNull();
  });

  it("finds 10% for the canonical -100/+110 annual pair", () => {
    // NPV(0.1) = -100 + 110/1.1 = 0
    const r = irrBisection([
      { date: "2024-01-01", amount: -100 },
      { date: "2025-01-01", amount: 110 },
    ]);
    expect(r.reason).toBe("converged");
    expect(r.rate).not.toBeNull();
    if (r.rate !== null) {
      expect(r.rate).toBeCloseTo(0.1, 3);
    }
  });

  it("finds ~25% for 13 same-day deposits + 1Y terminal payout", () => {
    // Closed-form: 13 cashflows all on day 0 ($100 × 12 + $1500 a year later).
    // Because every deposit collapses to Δt=0 the bisection solves
    //   NPV(r) = -1200 + 1500/(1+r)^t = 0
    // where t = 365 / 365.25 ≈ 0.99931 (the solver uses 365.25 to convert
    // day-deltas to years — so a calendar year is *slightly less than* 1).
    // Thus the closed form is r = 1.25^(1/0.99931) − 1 ≈ 0.25086, comfortably
    // inside the ±0.5% band we assert below.
    const cashflows = Array.from({ length: 12 }, () => ({
      date: "2024-01-01",
      amount: -100,
    }));
    cashflows.push({ date: "2025-01-01", amount: 1500 });
    const r = irrBisection(cashflows);
    expect(r.reason).toBe("converged");
    expect(r.rate).not.toBeNull();
    if (r.rate !== null) {
      expect(r.rate).toBeCloseTo(0.25, 2); // ±0.0050 tolerance
    }
  });

  it("returns no_sign_change for all-positive streams", () => {
    const r = irrBisection([
      { date: "2024-01-01", amount: 50 },
      { date: "2025-01-01", amount: 50 },
    ]);
    expect(r.reason).toBe("no_sign_change");
    expect(r.rate).toBeNull();
  });

  it("converges in <= 60 iterations on the simple annual case", () => {
    const r = irrBisection([
      { date: "2024-01-01", amount: -1000 },
      { date: "2025-01-01", amount: 1100 },
    ]);
    expect(r.iterations).toBeLessThanOrEqual(60);
  });
});

describe("cagr", () => {
  it("computes ~9.65% for $1k → $2k over 8 years", () => {
    // 2^(1/8) - 1 ≈ 0.0905
    const r = cagr(1000, 2000, 8);
    expect(r).not.toBeNull();
    if (r !== null) {
      expect(r).toBeCloseTo(0.0905, 3);
    }
  });

  it("returns null for non-positive start", () => {
    expect(cagr(0, 100, 5)).toBeNull();
    expect(cagr(-100, 100, 5)).toBeNull();
  });

  it("returns null for zero years", () => {
    expect(cagr(100, 200, 0)).toBeNull();
  });
});

describe("annualizedVolatility", () => {
  it("returns null for < 2 closes", () => {
    expect(annualizedVolatility([100])).toBeNull();
    expect(annualizedVolatility([])).toBeNull();
  });

  it("returns positive volatility for a noisy series", () => {
    // Sinusoidal with mean zero
    const closes: number[] = [];
    for (let i = 0; i < 252; i++) {
      closes.push(100 + Math.sin(i / 10) * 5);
    }
    const v = annualizedVolatility(closes);
    expect(v).not.toBeNull();
    if (v !== null) expect(v).toBeGreaterThan(0);
  });

  it("returns ~0 for a perfectly flat series", () => {
    const closes = Array(252).fill(100);
    const v = annualizedVolatility(closes);
    expect(v).not.toBeNull();
    if (v !== null) expect(v).toBeCloseTo(0, 7);
  });
});

describe("sharpeRatio", () => {
  it("returns null for flat series (zero variance)", () => {
    const closes = Array(50).fill(100);
    expect(sharpeRatio(closes)).toBeNull();
  });

  it("is positive for a steady uptrend", () => {
    // Linear riser
    const closes: number[] = [];
    for (let i = 100; i <= 200; i++) closes.push(i);
    const s = sharpeRatio(closes);
    expect(s).not.toBeNull();
    if (s !== null) expect(s).toBeGreaterThan(1);
  });
});

describe("sortinoRatio", () => {
  it("returns null when no downside exists", () => {
    const closes: number[] = [];
    for (let i = 100; i <= 120; i++) closes.push(i);
    expect(sortinoRatio(closes)).toBeNull();
  });

  it("produces a positive sortino for an uptrend with mild drawdowns", () => {
    // Lot of small ups + occasional larger dips => meaningful downside deviation.
    const closes: number[] = [];
    let v = 100;
    for (let i = 0; i < 252; i++) {
      v += 0.3 + Math.sin(i / 4) * 0.6;
      if (i % 17 === 0) v -= 1.5; // dip every ~17 bars
      closes.push(v);
    }
    const s = sortinoRatio(closes);
    expect(s).not.toBeNull();
    if (s !== null) expect(s).toBeGreaterThan(0);
  });
});

describe("totalReturn", () => {
  it("computes (end - start) / start", () => {
    expect(totalReturn([100, 110, 121])).toBeCloseTo(0.21, 5);
  });

  it("returns null when first close is non-positive", () => {
    expect(totalReturn([0, 100])).toBeNull();
  });
});
