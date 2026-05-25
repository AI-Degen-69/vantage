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
  growth1Y?: number;
  growth2Y?: number;
  growth5Y?: number;
}

export interface QuickStat {
  label: string;
  value: string;
  change?: string;
  changePercent?: number;
  changeType?: "positive" | "negative";
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
    change: "+$185.5B",
    changePercent: 5.74,
    changeType: "positive",
  },
  {
    label: "Cash Flow",
    value: "$110.5B",
    change: "+$8.2B",
    changePercent: 8.01,
    changeType: "positive",
  },
  {
    label: "Margins & Growth",
    value: "46.2%",
    change: "+2.1%",
    changePercent: 4.76,
    changeType: "positive",
  },
  {
    label: "Returns",
    value: "157.3%",
    change: "+42.1%",
    changePercent: 36.71,
    changeType: "positive",
  },
  {
    label: "Dividend",
    value: "$0.24/q",
    change: "+$0.01",
    changePercent: 4.35,
    changeType: "positive",
  },
  {
    label: "Yield",
    value: "0.43%",
    change: "-0.02%",
    changePercent: -4.44,
    changeType: "negative",
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
    growth1Y: 4.28,
    growth2Y: 8.65,
    growth5Y: 14.2,
  },
  {
    name: "Revenue by Segment",
    type: "bar",
    color: "chart-orange",
    unit: "B",
    data: generateQuarterlyData(79.5, 6),
    growth1Y: 2.15,
    growth2Y: 5.42,
    growth5Y: 11.8,
  },
  {
    name: "EBITDA",
    type: "bar",
    color: "chart-orange",
    unit: "B",
    data: generateQuarterlyData(28.5, 3),
    growth1Y: 6.73,
    growth2Y: 12.15,
    growth5Y: 18.9,
  },
  {
    name: "Gross Profit",
    type: "line",
    color: "chart-blue",
    unit: "B",
    data: generateQuarterlyData(28.0, 2.5),
    growth1Y: 5.82,
    growth2Y: 9.34,
    growth5Y: 15.6,
  },
  {
    name: "Operating Income",
    type: "bar",
    color: "chart-orange",
    unit: "B",
    data: generateQuarterlyData(24.5, 2),
    growth1Y: 8.91,
    growth2Y: 13.65,
    growth5Y: 19.2,
  },
  {
    name: "Net Income",
    type: "bar",
    color: "chart-orange",
    unit: "B",
    data: generateQuarterlyData(19.8, 1.8),
    growth1Y: 7.54,
    growth2Y: 11.42,
    growth5Y: 16.8,
  },
  {
    name: "Cash & Equivalents",
    type: "bar",
    color: "chart-orange",
    unit: "B",
    data: generateQuarterlyData(29.2, 3),
    growth1Y: 12.34,
    growth2Y: 18.72,
    growth5Y: 25.6,
  },
  {
    name: "Free Cash Flow",
    type: "line",
    color: "chart-cyan",
    unit: "B",
    data: generateQuarterlyData(24.5, 2),
    growth1Y: 6.28,
    growth2Y: 10.15,
    growth5Y: 14.9,
  },
  {
    name: "Shareholders Equity",
    type: "line",
    color: "chart-purple",
    unit: "B",
    data: generateQuarterlyData(63.1, 3.5),
    growth1Y: 5.43,
    growth2Y: 9.87,
    growth5Y: 13.2,
  },
  {
    name: "Total Assets",
    type: "line",
    color: "chart-blue",
    unit: "B",
    data: generateQuarterlyData(352.6, 10),
    growth1Y: 3.92,
    growth2Y: 7.65,
    growth5Y: 12.4,
  },
  {
    name: "Market Cap",
    type: "area",
    color: "chart-green",
    unit: "B",
    data: generateQuarterlyData(2800, 150),
    growth1Y: 7.12,
    growth2Y: 14.58,
    growth5Y: 22.3,
  },
  {
    name: "EPS",
    type: "line",
    color: "chart-pink",
    unit: "$",
    data: generateQuarterlyData(6.05, 0.5),
    growth1Y: 9.23,
    growth2Y: 15.64,
    growth5Y: 21.7,
  },
];
