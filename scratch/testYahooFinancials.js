const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance();

async function run() {
  const res = await yf.fundamentalsTimeSeries('AAPL', { module: 'all', type: 'annual', period1: '2020-01-01' });
  const row = res[res.length - 1]; // most recent
  console.log("Yahoo row:", Object.keys(row).join(", "));
  console.log({
    date: row.date,
    revenue: row.totalRevenue,
    costOfRevenue: row.costOfRevenue || row.reconciledCostOfRevenue,
    grossProfit: row.grossProfit,
    operatingExpense: row.operatingExpense,
    operatingIncome: row.operatingIncome,
    ebitda: row.EBITDA || row.normalizedEBITDA,
    netIncome: row.netIncome,
    eps: row.basicEPS,
    epsDiluted: row.dilutedEPS,
    totalAssets: row.totalAssets,
    totalLiabilities: row.totalLiabilitiesNetMinorityInterest,
    totalEquity: row.stockholdersEquity,
    totalDebt: row.totalDebt,
    cashAndCashEquivalents: row.cashAndCashEquivalents || row.cashCashEquivalentsAndShortTermInvestments,
    operatingCashFlow: row.operatingCashFlow || row.cashFlowFromContinuingOperatingActivities,
    capitalExpenditure: row.capitalExpenditure,
    freeCashFlow: row.freeCashFlow,
  });
}
run().catch(console.error);
