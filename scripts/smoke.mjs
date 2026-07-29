// End-to-end smoke for the fresh upstream fixes. Loads stockService.ts via
// tsx, sets env vars inline (dotenv only loads in server/index.ts at boot).
// Run with:
//   FMP_USE_STABLE=1 FMP_KEY=<KEY> node ./node_modules/tsx/dist/cli.mjs \
//     ./scripts/smoke.mjs
import { stockService } from "../server/services/stockService.ts";

/**
 * Records the outcome of a smoke-test condition and marks the process as failed when it is false.
 * @param {*} cond - The condition to evaluate.
 * @param {string} msg - The message describing the check.
 * @param {*} [ctx] - Optional context to include when the check fails.
 */
function assert(cond, msg, ctx) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    console.log(`  ✗ ${msg}`, ctx ?? "");
    process.exitCode = 1;
  }
}

async function run() {
  console.log("\n== getQuote(AAPL) ==");
  const q = await stockService.getQuote("AAPL");
  assert(q !== null, "returned non-null");
  if (q) {
    assert(q.price > 0, `price>0 (got ${q.price})`);
    assert(typeof q.changesPercentage === "number", `changesPercentage typeof number (got ${typeof q.changesPercentage}=${q.changesPercentage})`);
    assert(q.eps !== undefined || q.pe !== undefined, "either EPS or PE populated (Yahoo OR metrics backfill)");
  }

  console.log("\n== getBatchQuotes(['AAPL','MSFT','NVDA','TSLA']) ==");
  const b = await stockService.getBatchQuotes(["AAPL", "MSFT", "NVDA", "TSLA"]);
  assert(b.quotes.length === 4, `array length 4 (got ${b.quotes.length})`);
  const nonNull = b.quotes.filter(Boolean).length;
  assert(nonNull >= 3, `>= 3 non-null (got ${nonNull})`);

  console.log("\n== getChart('AAPL') ==");
  const c = await stockService.getChart("AAPL");
  assert(c !== null, "returned non-null");
  if (c) {
    assert(c.historical.length >= 50, `historical.length >= 50 (got ${c.historical.length})`);
    const r = c.historical[c.historical.length - 1];
    assert(r && r.open > 0 && r.high > 0 && r.low > 0 && r.close > 0,
      `last row has full OHLC (open=${r?.open}, high=${r?.high}, low=${r?.low}, close=${r?.close})`);
  }

  console.log("\n== getIndexQuotes() ==");
  const idx = await stockService.getIndexQuotes();
  assert(idx.sp500?.symbol || idx.nasdaq?.symbol || idx.dow?.symbol,
    `at least one index symbol set (sp500=${idx.sp500?.symbol}, nasdaq=${idx.nasdaq?.symbol}, dow=${idx.dow?.symbol})`);

  console.log("\n== getEarningsCalendar('2026-07-28'..'2026-08-03') ==");
  const e = await stockService.getEarningsCalendar("2026-07-28", "2026-08-03");
  assert(Array.isArray(e) && e.length >= 10, `array length >= 10 (got ${e.length})`);

  console.log("\n== getProfile('AAPL') /stable/ identity fields ==");
  const p = await stockService.getProfile("AAPL");
  assert(p !== null, "returned non-null");
  if (p) {
    assert(p.cik === "0000320193", `cik correct (got ${p.cik})`);
    assert(p.isin === "US0378331005", `isin correct (got ${p.isin})`);
    assert(p.cusip === "037833100", `cusip correct (got ${p.cusip})`);
    assert(p.isEtf === false, `isEtf=false (got ${p.isEtf})`);
    assert(p.ipoDate === "1980-12-12", `ipoDate correct (got ${p.ipoDate})`);
    assert(typeof p.lastDividend === "number" && p.lastDividend > 0, `lastDividend>0 (got ${p.lastDividend})`);
    assert(/NAS/i.test(p.exchangeFullName ?? ""), `exchangeFullName mentions NAS (got ${p.exchangeFullName})`);
  }

  console.log("\n== Edge cases ==");
  // Empty batch — must return empty array, not throw
  const emptyBatch = await stockService.getBatchQuotes([]);
  assert(Array.isArray(emptyBatch.quotes) && emptyBatch.quotes.length === 0,
    `getBatchQuotes([]) returns empty array (got ${JSON.stringify(emptyBatch)})`);

  // Unknown symbol — FMP returns []; we should resolve to null without throwing
  const ghosts = await Promise.all([
    stockService.getProfile("NOSUCHTICKER_X_9999"),
    stockService.getMetrics("NOSUCHTICKER_X_9999"),
    stockService.getFinancialStatements("NOSUCHTICKER_X_9999"),
  ]);
  const [ghostP, ghostM, ghostF] = ghosts;
  assert(ghostP === null || (ghostP && ghostP.symbol === "NOSUCHTICKER_X_9999"),
    `getProfile(unknown) coerces safely (got ${ghostP === null ? "null" : "populated"})`);
  assert(ghostM && (ghostM.metrics === undefined || Object.keys(ghostM.metrics).length === 0),
    `getMetrics(unknown) returns empty metrics shape (got ${JSON.stringify(ghostM)})`);
  assert(ghostF && Array.isArray(ghostF.income) && ghostF.income.length === 0,
    `getFinancialStatements(unknown) returns empty arrays (got income.length=${ghostF?.income?.length})`);

  // Cache warmth — second call must be fast (under 50ms = cache hit)
  const t0 = Date.now();
  await stockService.getChart("AAPL"); // already cached from earlier in this run
  const t1 = Date.now();
  assert(t1 - t0 < 50, `getChart cache hit < 50ms (took ${t1 - t0}ms)`);
}

run().catch((e) => {
  console.log("FATAL:", e?.message ?? e);
  process.exit(1);
});
