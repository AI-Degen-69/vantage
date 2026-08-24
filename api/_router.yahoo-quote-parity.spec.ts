import { describe, expect, it } from "vitest";
import { normalizeYahooQuote } from "../server/services/yahooQuoteShape";
import { normalizeQuote as normalizeQuoteJs } from "./_router";

/**
 * Parity tripwire — the Yahoo-quote field mapping used to be implemented
 * twice: `server/services/stockService.ts#yahooQuote` (local dev / Express)
 * and `api/_router.js#normalizeQuote` (Vercel serverless). The copies had
 * already drifted:
 *
 *   1. `_router.js` multiplied `earningsTimestamp * 1000` unconditionally —
 *      a millisecond-epoch upstream value produced year-52k dates on Vercel
 *      only, while the TS side guarded with `< 1e12`.
 *   2. The JS dividend-yield fallback skipped the decimal→percent
 *      conversion (`0.0042` stayed a fraction instead of becoming `0.42`).
 *   3. Empty-string numerics became `0` on the JS side (`Number("") === 0`)
 *      vs `undefined` on the TS side.
 *   4. Missing/non-positive prices produced a quote with `price: 0` on the
 *      JS side vs `null` on the TS side.
 *
 * Both paths now delegate to the shared `server/services/yahooQuoteShape.ts`
 * module; this spec pins the lock-step contract so future edits to one side
 * fail CI here. When changing normalization rules, change them in
 * `yahooQuoteShape.ts` only — this matrix must stay green.
 */

const baseFixture = {
  symbol: "AAPL",
  longName: "Apple Inc.",
  shortName: "Apple",
  displayName: "Apple",
  regularMarketPrice: 227.5,
  regularMarketChange: 1.25,
  regularMarketChangePercent: 0.55,
  regularMarketPreviousClose: 226.25,
  regularMarketDayLow: 225.9,
  regularMarketDayHigh: 228.4,
  fiftyTwoWeekLow: 164.08,
  fiftyTwoWeekHigh: 237.23,
  fiftyDayAverage: 221.4,
  twoHundredDayAverage: 210.2,
  marketCap: 3_456_000_000_000,
  regularMarketVolume: 52_340_000,
  averageDailyVolume10Day: 58_120_000,
  averageDailyVolume3Month: 61_230_000,
  exchange: "NMS",
  sharesOutstanding: 15_194_000_000,
  epsTrailingTwelveMonths: 6.57,
  trailingPE: 34.6,
  dividendRate: 0.96,
  dividendYield: 0.0042,
  payoutRatio: 0.153,
};

function fixture(overrides: Record<string, unknown>) {
  return { ...baseFixture, ...overrides };
}

describe("api/_router.js normalizeQuote ↔ shared normalizeYahooQuote parity", () => {
  it("agrees on a full seconds-epoch Yahoo quote payload", () => {
    const raw = fixture({ earningsTimestamp: 1_756_000_000 });
    expect(normalizeQuoteJs(raw)).toEqual(normalizeYahooQuote(raw));
  });

  it("treats a millisecond-epoch earningsTimestamp identically (no year-52k drift)", () => {
    const raw = fixture({ earningsTimestamp: 1_756_000_000_000 });
    const expected = new Date(1_756_000_000_000).toISOString();
    expect(normalizeYahooQuote(raw)?.earningsAnnouncement).toBe(expected);
    expect(normalizeQuoteJs(raw)?.earningsAnnouncement).toBe(expected);
    expect(normalizeQuoteJs(raw)).toEqual(normalizeYahooQuote(raw));
  });

  it("converts decimal dividend yields to percent units on both sides", () => {
    // Force the direct (no rate-derived) path by omitting dividendRate:
    // Number(undefined) is NaN, so the auditable rate/price branch skips.
    const raw = fixture({ dividendRate: undefined, dividendYield: 0.0042 });
    expect(normalizeYahooQuote(raw)?.dividendYield).toBeCloseTo(0.42, 6);
    expect(normalizeQuoteJs(raw)).toEqual(normalizeYahooQuote(raw));
  });

  it("treats null/empty dividend fields as absent, not as a 0% yield", () => {
    // A null dividendRate must not take the rate-derived branch and
    // collapse a valid direct yield to 0…
    const nullRate = fixture({ dividendRate: null, dividendYield: 0.0042 });
    expect(normalizeYahooQuote(nullRate)?.dividendYield).toBeCloseTo(0.42, 6);
    // …and with NO usable yield source at all, result must be undefined,
    // never a fake 0%.
    const bothNull = fixture({ dividendYield: null, dividendRate: null });
    expect(normalizeYahooQuote(bothNull)?.dividendYield).toBeUndefined();
    const bothEmpty = fixture({ dividendYield: "", dividendRate: "" });
    expect(normalizeYahooQuote(bothEmpty)?.dividendYield).toBeUndefined();
    expect(normalizeQuoteJs(nullRate)).toEqual(normalizeYahooQuote(nullRate));
    expect(normalizeQuoteJs(bothNull)).toEqual(normalizeYahooQuote(bothNull));
    expect(normalizeQuoteJs(bothEmpty)).toEqual(normalizeYahooQuote(bothEmpty));
  });

  it("returns null earningsAnnouncement for non-numeric garbage without throwing", () => {
    const raw = fixture({ earningsTimestamp: "invalid" });
    expect(() => normalizeYahooQuote(raw)).not.toThrow();
    expect(normalizeYahooQuote(raw)?.earningsAnnouncement).toBeNull();
    expect(normalizeQuoteJs(raw)).toEqual(normalizeYahooQuote(raw));
  });

  it("normalizes empty-string numeric fields to undefined (not 0) on both sides", () => {
    const raw = fixture({
      trailingPE: "",
      marketCap: "",
      earningsTimestamp: "",
    });
    expect(normalizeYahooQuote(raw)?.pe).toBeUndefined();
    expect(normalizeYahooQuote(raw)?.marketCap).toBeUndefined();
    expect(normalizeYahooQuote(raw)?.earningsAnnouncement).toBeNull();
    expect(normalizeQuoteJs(raw)).toEqual(normalizeYahooQuote(raw));
  });

  it("returns null for missing or non-positive prices on both sides", () => {
    expect(normalizeYahooQuote(fixture({ regularMarketPrice: 0 }))).toBeNull();
    expect(normalizeQuoteJs(fixture({ regularMarketPrice: 0 }))).toBeNull();
    const noPrice = { ...baseFixture } as Record<string, unknown>;
    delete noPrice.regularMarketPrice;
    expect(normalizeYahooQuote(noPrice)).toBeNull();
    expect(normalizeQuoteJs(noPrice)).toBeNull();
  });

  it("agrees when upstream omits symbol (fallback applies) and returns null for junk input", () => {
    const { symbol: _dropped, ...anonymous } = baseFixture;
    const tsOut = normalizeYahooQuote(anonymous, "MSFT");
    const jsOut = normalizeQuoteJs(anonymous, "MSFT");
    expect(tsOut?.symbol).toBe("MSFT");
    expect(jsOut).toEqual(tsOut);
    expect(normalizeYahooQuote(null)).toBeNull();
    expect(normalizeQuoteJs(null)).toBeNull();
  });
});
