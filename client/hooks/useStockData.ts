import { useQuery } from "@tanstack/react-query";

// ── Earnings Calendar types ─────────────────────────────────────────────────────

export interface EarningsEvent {
  date: string;
  symbol: string;
  name: string | null;
  epsActual: number | null;
  epsEstimate: number | null;
  revenueActual: number | null;
  revenueEstimate: number | null;
  hour: "bmo" | "amc" | "dmh" | "";
  quarter: number;
  year: number;
  marketCap: number | null;
  exchange: string | null;
}


export interface StockQuote {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  afterHoursPrice?: number | null;
  afterHoursChange?: number | null;
  afterHoursChangePercent?: number | null;
}

export interface StockTimeSeries {
  quarters: Array<{ date: string; close: number }>;
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

export interface FinancialMetric {
  name: string;
  type: "bar" | "line" | "area";
  color: string;
  unit: string;
  data: Array<{ date: string; value: number }>;
  yoy?: number | null;
  cagr3Y?: number | null;
  cagr5Y?: number | null;
}

export interface NewsItem {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  category: string;
  datetime: number;
  related: string;
  image: string | null;
}

export interface StockData {
  symbol: string;
  name: string | null;
  exchange: string | null;
  quote: {
    price: number | null;
    change: number | null;
    changePercent: number | null;
    afterHoursPrice: number | null;
    afterHoursChange: number | null;
    afterHoursChangePercent: number | null;
  };
  profile: {
    sector: string | null;
    industry: string | null;
    website: string | null;
    employees: number | null;
    description: string | null;
    ceo: string | null;
    country: string | null;
  };
  priceChange: {
    ytd: number | null;
    "1Y": number | null;
    "3Y": number | null;
  } | null;
  quickStats: QuickStat[];
  financialMetrics: FinancialMetric[];
  priceHistory: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  analystEstimates: Array<{
    date: string;
    estimatedEpsAvg: number | null;
    estimatedRevenueAvg: number | null;
    earningsGrowth: number | null;
  }>;
  insiderTrades: any[];
  earnings: any[];
  ratios: {
    peTtm: number | null;
    peNtm: number | null;
    pegRatio: number | null;
    priceToBook: number | null;
    priceToSales: number | null;
    evToEbitda: number | null;
    roe: number | null;
    roa: number | null;
    profitMargin: number | null;
    operatingMargin: number | null;
    grossMargin: number | null;
    piotroskiScore: number | null;
    fcfYield: number | null;
    dividendYield: number | null;
    payoutRatio: number | null;
    beta: number | null;
  };
  sectorPE: Record<string, number>;
  news: NewsItem[];
}

/**
 * Fetch aggregated stock data (quote, profile, stats, metrics, ratios, etc.)
 * Single endpoint powers the entire stock detail page.
 */
export function useStockData(ticker: string) {
  return useQuery<StockData>({
    queryKey: ["stock-data", ticker?.toUpperCase()],
    queryFn: async () => {
      const res = await fetch(`/api/stock-data?symbol=${ticker}`);
      if (!res.ok) throw new Error("Failed to fetch stock data");
      return res.json();
    },
    enabled: !!ticker,
    staleTime: 5 * 60 * 1000, // 5 min
    retry: 1,
  });
}

/**
 * Fetch real-time stock quote.
 */
export function useStockQuote(ticker: string) {
  return useQuery<StockQuote>({
    queryKey: ["stock-quote", ticker?.toUpperCase()],
    queryFn: async () => {
      const res = await fetch(`/api/stock-quote?symbol=${ticker}`);
      if (!res.ok) throw new Error("Unavailable via API");
      return res.json();
    },
    enabled: !!ticker,
    staleTime: 60 * 1000, // 1 min
    retry: 1,
  });
}

/**
 * Fetch time series (historical price data).
 */
export function useStockTimeSeries(ticker: string) {
  return useQuery<StockTimeSeries>({
    queryKey: ["stock-time-series", ticker?.toUpperCase()],
    queryFn: async () => {
      const res = await fetch(`/api/stock-time-series?symbol=${ticker}`);
      if (!res.ok) throw new Error("Unavailable via API");
      return res.json();
    },
    enabled: !!ticker,
    staleTime: 5 * 60 * 1000, // 5 min
    retry: 1,
  });
}

/**
 * Fetch company overview.
 */
export function useStockOverview(ticker: string) {
  return useQuery<Record<string, any>>({
    queryKey: ["stock-overview", ticker?.toUpperCase()],
    queryFn: async () => {
      const res = await fetch(`/api/stock-overview?symbol=${ticker}`);
      if (!res.ok) throw new Error("Unavailable via API");
      return res.json();
    },
    enabled: !!ticker,
    staleTime: 30 * 60 * 1000, // 30 min
    retry: 1,
  });
}

// ── Earnings Calendar hooks ──────────────────────────────────────────────────────

/**
 * Fetch upcoming earnings calendar from Finnhub.
 */
export function useEarningsCalendar(from?: string, to?: string) {
  const today = new Date();
  const defaultFrom = today.toISOString().split("T")[0];
  const defaultTo = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  return useQuery<{ from: string; to: string; earnings: EarningsEvent[] }>({
    queryKey: ["earnings-calendar", from || defaultFrom, to || defaultTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/earnings/calendar?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch earnings calendar");
      return res.json();
    },
    staleTime: 30 * 60 * 1000, // 30 min (cached server-side too)
    retry: 1,
  });
}

// ── Insights hooks ────────────────────────────────────────────────────────────

export interface InsightsStock {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  marketCap: number | null;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
}

/**
 * Fetch batch stock quotes for an insights universe tab.
 */
export function useInsightsStocks(tab: string = "sp500") {
  return useQuery<{ tab: string; stocks: InsightsStock[]; source: string }>({
    queryKey: ["insights-stocks", tab],
    queryFn: async () => {
      const res = await fetch(`/api/insights/stocks?tab=${tab}`);
      if (!res.ok) throw new Error("Failed to fetch insights stocks");
      return res.json();
    },
    staleTime: 2 * 60 * 1000, // 2 min
    retry: 1,
  });
}

/**
 * Fetch chart price history for a given symbol and period.
 */
export function useChartHistory(symbol: string, period: string = "1y") {
  return useQuery<{
    symbol: string;
    period: string;
    dataPoints: number;
    quote: { price: number | null; change: number | null; changePercent: number | null } | null;
    history: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;
  }>({
    queryKey: ["chart-history", symbol?.toUpperCase(), period],
    queryFn: async () => {
      const res = await fetch(`/api/chart-history?symbol=${symbol}&period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch chart history");
      return res.json();
    },
    enabled: !!symbol,
    staleTime: 2 * 60 * 1000, // 2 min
    retry: 1,
  });
}

/**
 * Fetch available universe tabs.
 */
export function useInsightsUniverses() {
  return useQuery<{ tabs: Array<{ id: string; label: string }> }>({
    queryKey: ["insights-universes"],
    queryFn: async () => {
      const res = await fetch(`/api/insights/universes`);
      if (!res.ok) throw new Error("Failed to fetch universes");
      return res.json();
    },
    staleTime: 60 * 60 * 1000, // 1 hour (static list)
    retry: 1,
  });
}
