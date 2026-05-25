export interface StockMetric {
  date: string;
  value: number;
}

export interface FinancialMetric {
  name: string;
  type: "bar" | "line" | "area";
  color: string;
  unit: string;
  data: StockMetric[];
  // YoY - year-over-year (absolute growth rate)
  yoy?: number;
  // CAGR - Compound Annual Growth Rate (annualized average)
  cagr3Y?: number;
  cagr5Y?: number;
}

export interface QuickStat {
  label: string;
  value: string;
  subtitle?: string;
  details?: Array<{
    label: string;
    value: string;
  }>;
}

export const appleStockData = {
  symbol: "AAPL",
  name: "Apple Inc.",
  currentPrice: 224.72,
  priceChange: 12.54,
  percentChange: 5.91,
  badgeType: "positive" as const,
};

export const quickStats: QuickStat[] = [
  {
    label: "Valuation",
    value: "$3.42T",
    details: [
      { label: "Market Cap", value: "$3,421.2B" },
      { label: "P/E (TTM/USD/D2D)", value: "27.23 | 30.81 | 30.12" },
      { label: "Price to Sales", value: "8.42" },
      { label: "EV to EBITDA", value: "26.39" },
      { label: "Price to Book", value: "42.66" },
    ],
  },
  {
    label: "Cash Flow",
    value: "$110.5B",
    details: [
      { label: "Operating Cash Flow (TTM)", value: "$110.5B" },
      { label: "FCF (Free Cash Flow TTM)", value: "$97.2B" },
      { label: "FCF Payout Ratio / Price (B)", value: "0.24" },
      { label: "Dividend/Price", value: "$30,820" },
      { label: "Cash Amount", value: "$29.2B" },
    ],
  },
  {
    label: "Margins & Growth",
    value: "46.2%",
    details: [
      { label: "Gross Margin (NTM)", value: "46.21%" },
      { label: "Operating Margin", value: "33.64%" },
      { label: "Net Margin", value: "19.34%" },
      { label: "Quarterly Earnings (NTM)", value: "14.60%" },
    ],
  },
  {
    label: "Balance",
    value: "$1,245.6B",
    details: [
      { label: "Total Assets", value: "$352.6B" },
      { label: "Total Debt", value: "$106.8B" },
      { label: "Debt to Equity", value: "1.69x" },
      { label: "Current Ratio", value: "1.51x" },
      { label: "Quick Ratio", value: "1.39x" },
    ],
  },
  {
    label: "Dividend",
    value: "$0.24/q",
    details: [
      { label: "Quarterly Dividend", value: "$0.24" },
      { label: "Annual Dividend", value: "$0.96" },
      { label: "Dividend Yield", value: "0.43%" },
      { label: "Payout Ratio", value: "12.69%" },
      { label: "Next Ex-Date", value: "May 11, 2024" },
    ],
  },
  {
    label: "Valuation",
    value: "Premium",
    details: [
      { label: "52-Week High", value: "$309.25" },
      { label: "52-Week Low", value: "$164.08" },
      { label: "Average Volume", value: "52.8M" },
      { label: "Market Position", value: "Tech Leader" },
    ],
  },
];

// Generate quarterly data for the past 5 years (20 quarters)
const generateQuarterlyData = (baseValue: number, variance: number): StockMetric[] => {
  const data: StockMetric[] = [];
  const now = new Date();
  let value = baseValue;

  for (let i = 19; i >= 0; i--) {
    const quarter = Math.floor(i / 4);
    const q = (i % 4) + 1;
    const year = now.getFullYear() - quarter;
    value += (Math.random() - 0.5) * variance;
    data.push({
      date: `Q${q} ${year}`,
      value: Math.max(value, baseValue * 0.5),
    });
  }
  return data;
};

export const financialMetrics: FinancialMetric[] = [
  {
    name: "Revenue",
    type: "bar",
    color: "chart-green",
    unit: "B",
    data: generateQuarterlyData(83.0, 8),
    yoy: 16.60,
    cagr3Y: 8.65,
    cagr5Y: 4.41,
  },
  {
    name: "Revenue by Segment",
    type: "bar",
    color: "chart-orange",
    unit: "B",
    data: generateQuarterlyData(79.5, 6),
    yoy: 14.35,
    cagr3Y: 6.32,
    cagr5Y: 3.28,
  },
  {
    name: "EBITDA",
    type: "bar",
    color: "chart-orange",
    unit: "B",
    data: generateQuarterlyData(28.5, 3),
    yoy: 18.94,
    cagr3Y: 10.52,
    cagr5Y: 5.87,
  },
  {
    name: "Gross Profit",
    type: "line",
    color: "chart-blue",
    unit: "B",
    data: generateQuarterlyData(28.0, 2.5),
    yoy: 15.73,
    cagr3Y: 7.84,
    cagr5Y: 4.12,
  },
  {
    name: "Operating Income",
    type: "bar",
    color: "chart-orange",
    unit: "B",
    data: generateQuarterlyData(24.5, 2),
    yoy: 20.45,
    cagr3Y: 11.68,
    cagr5Y: 6.42,
  },
  {
    name: "Net Income",
    type: "bar",
    color: "chart-orange",
    unit: "B",
    data: generateQuarterlyData(19.8, 1.8),
    yoy: 17.28,
    cagr3Y: 9.45,
    cagr5Y: 5.64,
  },
  {
    name: "Cash & Equivalents",
    type: "bar",
    color: "chart-orange",
    unit: "B",
    data: generateQuarterlyData(29.2, 3),
    yoy: 22.67,
    cagr3Y: 13.25,
    cagr5Y: 7.89,
  },
  {
    name: "Free Cash Flow",
    type: "line",
    color: "chart-cyan",
    unit: "B",
    data: generateQuarterlyData(24.5, 2),
    yoy: 14.56,
    cagr3Y: 7.92,
    cagr5Y: 4.38,
  },
  {
    name: "Shareholders Equity",
    type: "line",
    color: "chart-purple",
    unit: "B",
    data: generateQuarterlyData(63.1, 3.5),
    yoy: 12.34,
    cagr3Y: 6.78,
    cagr5Y: 3.94,
  },
  {
    name: "Total Assets",
    type: "line",
    color: "chart-blue",
    unit: "B",
    data: generateQuarterlyData(352.6, 10),
    yoy: 11.45,
    cagr3Y: 5.84,
    cagr5Y: 3.21,
  },
  {
    name: "Market Cap",
    type: "area",
    color: "chart-green",
    unit: "B",
    data: generateQuarterlyData(2800, 150),
    yoy: 19.34,
    cagr3Y: 10.78,
    cagr5Y: 6.25,
  },
  {
    name: "EPS",
    type: "line",
    color: "chart-pink",
    unit: "$",
    data: generateQuarterlyData(6.05, 0.5),
    yoy: 21.45,
    cagr3Y: 12.56,
    cagr5Y: 7.34,
  },
];
