import { describe, expect, it } from "vitest";
import {
  annualizedVolatility,
  cagr,
  formatTradeDateLocale,
  formatTradeDateShort,
  irrBisection,
  parseTradeDate,
  parseTradeDateAsc,
  parseTradeDateMs,
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

/* ------------------------------------------------------------------ *
 * Trade-date helper tests — see finance.ts for the contract.         *
 * ------------------------------------------------------------------ */
describe("parseTradeDate (strict)", () => {
  it("returns ms for valid ISO via Date.UTC", () => {
    expect(parseTradeDate("2024-08-15")).toBe(Date.UTC(2024, 7, 15));
  });

  it("returns ms for ISO with trailing time component (uses first 10 chars)", () => {
    expect(parseTradeDate("2024-08-15T00:00:00Z")).toBe(Date.UTC(2024, 7, 15));
  });

  it("treats unix-seconds numbers as seconds (multiplies by 1000)", () => {
    // 1_723_680_000 → 2024-08-15T16:00:00Z
    expect(parseTradeDate(1_723_680_000)).toBe(1_723_680_000 * 1000);
  });

  it("treats very large numbers as already-ms (no double-multiplication)", () => {
    const msTimestamp = 1_723_680_000_000;
    expect(parseTradeDate(msTimestamp)).toBe(msTimestamp);
  });

  it("rejects V8-permissive Date.parse interpretation of 'garbage' (~epoch)", () => {
    // V8 falls through "garbage" to ~1970-01-01 instead of NaN. The 1990
    // sanity threshold returns null so format helpers render "Recent" / "—".
    expect(parseTradeDate("garbage")).toBeNull();
  });

  it("rejects unix-epoch seconds (0)", () => {
    expect(parseTradeDate(0)).toBeNull();
  });

  it("rejects pre-1990 ISO dates as implausible for finance data", () => {
    expect(parseTradeDate("1970-01-01")).toBeNull();
    expect(parseTradeDate("1985-06-15")).toBeNull();
  });

  it("rejects invalid month/day (Date.UTC would otherwise roll to a real date)", () => {
    expect(parseTradeDate("2024-13-01")).toBeNull();
    expect(parseTradeDate("2024-02-32")).toBeNull();
  });

  it("returns null for empty / null / undefined / NaN", () => {
    expect(parseTradeDate("")).toBeNull();
    expect(parseTradeDate(null)).toBeNull();
    expect(parseTradeDate(undefined)).toBeNull();
    expect(parseTradeDate(Number.NaN)).toBeNull();
    expect(parseTradeDate(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("parseTradeDateMs (sort-friendly, sink=0)", () => {
  it("matches parseTradeDate on valid input", () => {
    expect(parseTradeDateMs("2024-08-15")).toBe(Date.UTC(2024, 7, 15));
  });

  it("sinks invalid input to 0 (bottom of any desc sort)", () => {
    expect(parseTradeDateMs("garbage")).toBe(0);
    expect(parseTradeDateMs(null)).toBe(0);
    expect(parseTradeDateMs("")).toBe(0);
  });

  it("sink contract: never returns NaN (so sort comparators stay finite)", () => {
    // NaN in an Array.sort comparator is a contract violation that some
    // engines escalate. The sink MUST be a finite number.
    for (const bad of [
      "broken",
      "",
      null,
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      0,
      "1970-01-01",
      "2024-13-32",
    ]) {
      expect(Number.isNaN(parseTradeDateMs(bad))).toBe(false);
    }
  });

  it("mixed input: real rows always sort above sinks in desc", () => {
    // Establishes the property that matters: a malformed `startDate` does
    // not corrupt the entire table's order. We do NOT assert sink-row order
    // at the bottom — V8 sort stability for equal-key tie-breaks is not a
    // contract we promise.
    const mixed = [
      { d: "broken-A", n: "A" },
      { d: "2024-05-15", n: "real-1" },
      { d: "broken-B", n: "B" },
      { d: "2024-08-01", n: "real-2" },
      { d: "broken-C", n: "C" },
    ];
    mixed.sort((a, b) => parseTradeDateMs(b.d) - parseTradeDateMs(a.d));
    const sorted = mixed.map((r) => r.n);
    const lastRealIdx = sorted.findIndex((n) => n === "real-2"); // newest real is first
    const firstRealAfterSort = lastRealIdx; // aliases above for readability
    expect(firstRealAfterSort).toBe(0);
    // The remaining reals (real-1) come somewhere in positions 1..(length-3)
    // and all sink rows are at the end.
    const realCount = sorted.filter((n) => n.startsWith("real")).length;
    const sinkCountStart = realCount;
    for (let i = 0; i < realCount; i++) expect(sorted[i].startsWith("real")).toBe(true);
    for (let i = sinkCountStart; i < sorted.length; i++) {
      expect(["A", "B", "C"]).toContain(sorted[i]);
    }
  });
});

describe("parseTradeDateAsc (sort-friendly, sink=MAX_SAFE_INTEGER)", () => {
  it("matches parseTradeDate on valid input", () => {
    expect(parseTradeDateAsc("2024-08-15")).toBe(parseTradeDate("2024-08-15"));
  });

  it("sinks invalid input to MAX_SAFE_INTEGER (bottom of any asc sort)", () => {
    expect(parseTradeDateAsc("garbage")).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseTradeDateAsc(null)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("sink contract: never returns NaN", () => {
    for (const bad of [
      "broken",
      "",
      null,
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      0,
      "1970-01-01",
      "2024-13-32",
    ]) {
      expect(Number.isNaN(parseTradeDateAsc(bad))).toBe(false);
    }
  });

  it("mixed input: real rows sort at top in asc, sinks at bottom", () => {
    // ASCENDING sort puts OLDEST first, so real-1 (2024-05-15) precedes
    // real-2 (2024-08-01). Sink rows trail at the very end.
    const rows = [
      { d: "broken", n: "sink" },
      { d: "2024-05-15", n: "real-1" },
      { d: "2024-08-01", n: "real-2" },
    ];
    rows.sort((a, b) => parseTradeDateAsc(a.d) - parseTradeDateAsc(b.d));
    const sorted = rows.map((r) => r.n);
    const lastIdx = sorted.length - 1;
    expect(sorted[lastIdx]).toBe("sink");
    const olderRealIdx = sorted.findIndex((n) => n === "real-1");
    const newerRealIdx = sorted.findIndex((n) => n === "real-2");
    expect(olderRealIdx).toBeLessThan(newerRealIdx);
    expect(newerRealIdx).toBeLessThan(lastIdx);
  });
});

describe("formatTradeDateShort", () => {
  it("emits a non-empty label containing the day number", () => {
    // Locale-agnostic: en-US => "Aug 15", he-IL => "15 באוג׳", fr-FR => "15 août".
    // The day component is rendered identically across all common locales.
    const out = formatTradeDateShort("2024-08-15");
    expect(out).not.toBeNull();
    expect(out!.length).toBeGreaterThan(0);
    expect(out).toContain("15");
  });

  it("returns null for invalid input", () => {
    expect(formatTradeDateShort("garbage")).toBeNull();
  });
});

describe("formatTradeDateLocale", () => {
  it("emits a non-empty locale-formatted string for valid input", () => {
    const out = formatTradeDateLocale("2024-08-15");
    expect(out).not.toBeNull();
    expect(out!.length).toBeGreaterThan(0);
  });

  it("returns null for invalid input", () => {
    expect(formatTradeDateLocale("garbage")).toBeNull();
  });
});
