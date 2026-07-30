// Local probe — runs the migrated Yahoo fundamentalsTimeSeries-backed
// handleStockFinancials handler in-process against AAPL/MSFT/NVDA, both
// annual and quarterly. Confirms the JSON shape still matches the shared
// IncomeStatementRow / BalanceSheetRow / CashFlowRow interfaces BEFORE
// pushing a production redeploy.
//
// Set YAHOO_FUNDAMENTALS_PRIMARY=quoteSummary to test the legacy path.

import { handleStockMetrics, handleStockFinancials } from '../api/_router.js';

function makeRes() {
  const res = {
    _status: 200, _body: undefined, _headers: {},
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
    setHeader(k, v) { this._headers[k] = v; return this; },
  };
  return res;
}

const symbols = ['AAPL', 'MSFT', 'NVDA'];
const periods = ['annual', 'quarter'];

for (const sym of symbols) {
  for (const period of periods) {
    const r = makeRes();
    await handleStockFinancials({ query: { symbol: sym, period } }, r);
    const body = r._body || {};
    const income = body.income || [];
    const balance = body.balance || [];
    const cash = body.cash || [];
    const tz = process.env.YAHOO_FUNDAMENTALS_PRIMARY || 'fts';
    console.log(`\n=== ${sym} / period=${period} / path=${tz} / status=${r._status} ===`);
    console.log(`  income: ${income.length} rows; populated fields across all rows:`);
    const incFields = new Set();
    for (const row of income) for (const k of Object.keys(row)) {
      if (row[k] !== 0 && row[k] !== undefined) incFields.add(k);
    }
    console.log('   ', [...incFields].sort().join(', '));
    if (income.length) console.log('    sample:', JSON.stringify(income[0]).slice(0, 220));
    console.log(`  balance: ${balance.length} rows; populated fields:`);
    const balFields = new Set();
    for (const row of balance) for (const k of Object.keys(row)) {
      if (row[k] !== 0 && row[k] !== undefined) balFields.add(k);
    }
    console.log('   ', [...balFields].sort().join(', '));
    if (balance.length) console.log('    sample:', JSON.stringify(balance[0]).slice(0, 220));
    console.log(`  cash: ${cash.length} rows; populated fields:`);
    const cfFields = new Set();
    for (const row of cash) for (const k of Object.keys(row)) {
      if (row[k] !== 0 && row[k] !== undefined) cfFields.add(k);
    }
    console.log('   ', [...cfFields].sort().join(', '));
    if (cash.length) console.log('    sample:', JSON.stringify(cash[0]).slice(0, 220));
  }
}

// Also sanity-check the metrics path (uses quoteSummary, still expected to work).
const rm = makeRes();
await handleStockMetrics({ query: { symbol: 'AAPL' } }, rm);
console.log('\n=== AAPL stock-metrics (regression) ===');
const md = rm._body || {};
console.log('  metrics keys:', Object.keys(md.metrics || {}).length, 'fields');
console.log('  ratios keys:', Object.keys(md.ratios || {}).length, 'fields');
console.log('  P/E:', md.ratios?.priceEarningsRatioTTM, '| ROE:', md.metrics?.returnOnEquityTTM);
