import { useQuery, useQueries } from "@tanstack/react-query";
import type {
  AnalystTrends,
  BatchQuoteResponse,
  ChartSeries,
  CompanyProfile,
  EarningsEvent,
  FinancialStatements,
  FxCurrency,
  FxRatesResponse,
  IndexQuote,
  InsightsTabId,
  InsightsTabResponse,
  InsiderTransaction,
  NewsItem,
  SmaDistanceResponse,
  StockMetrics,
  StockQuote,
} from "@shared/api";

interface IndexQuotesResponse {
  dow: IndexQuote | null;
  sp500: IndexQuote | null;
  nasdaq: IndexQuote | null;
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`);
  return res.json() as Promise<T>;
}

/** Single-ticker quote. */
export function useStockQuote(ticker: string) {
  return useQuery({
    queryKey: ["stockQuote", ticker],
    queryFn: () => fetchJSON<StockQuote | null>(`/api/stock-quote?symbol=${encodeURIComponent(ticker)}`),
    enabled: !!ticker,
    refetchInterval: 60_000,
  });
}

/** Batch quotes — one network round-trip for many tickers. */
export function useBatchQuotes(tickers: string[]) {
  const key = tickers.slice().sort().join(",");
  return useQuery({
    queryKey: ["batchQuotes", key],
    queryFn: () =>
      fetchJSON<BatchQuoteResponse>(`/api/stock-batch-quotes?symbols=${encodeURIComponent(tickers.join(","))}`),
    enabled: tickers.length > 0,
    refetchInterval: 60_000,
  });
}

/** Top-bar marquee quotes (Dow / S&P / Nasdaq). Cheap; refresh every 5 minutes.
 *  `staleTime` is inherited from the global QueryClient default (60_000). */
export function useIndexQuotes() {
  return useQuery({
    queryKey: ["indexQuotes"],
    queryFn: () => fetchJSON<IndexQuotesResponse>(`/api/index-quotes`),
    refetchInterval: 5 * 60_000,
  });
}

/** Curated ticker universe for an Insights tab (Phase 1 — E). */
export function useInsightsTab(tab: InsightsTabId) {
  return useQuery({
    queryKey: ["insightsTab", tab],
    queryFn: () => fetchJSON<InsightsTabResponse>(`/api/insights-tab?tab=${encodeURIComponent(tab)}`),
    staleTime: 5 * 60_000,
  });
}

/** SMA-200 distance for a flat list of symbols (Phase 1 — D). */
export function useSmaDistances(symbols: string[], windowSize: number = 200) {
  const key = symbols.slice().sort().join(",") + `|w=${windowSize}`;
  return useQuery({
    queryKey: ["smaDistances", key],
    queryFn: () =>
      fetchJSON<SmaDistanceResponse>(
        `/api/sma-distances?symbols=${encodeURIComponent(symbols.join(","))}&window=${windowSize}`
      ),
    enabled: symbols.length > 0,
    staleTime: 5 * 60_000,
  });
}

/** Live FX rates for cross-currency display (Phase 2). */
export function useFxRates(currencies: FxCurrency[] = ["USD", "ILS", "EUR"]) {
  const key = currencies.slice().sort().join(",");
  return useQuery({
    queryKey: ["fxRates", key],
    queryFn: () =>
      fetchJSON<FxRatesResponse>(`/api/fx-rates?currencies=${encodeURIComponent(currencies.join(","))}`),
    staleTime: 60 * 60_000, // 1h — FX doesn't move intraday
  });
}

/** Company profile (FMP). */
export function useStockProfile(ticker: string) {
  return useQuery({
    queryKey: ["stockProfile", ticker],
    queryFn: () => fetchJSON<CompanyProfile | null>(`/api/stock-overview?symbol=${encodeURIComponent(ticker)}`),
    enabled: !!ticker,
  });
}


export function useStockFinancials(ticker: string) {
  return useQuery({
    queryKey: ["stockFinancials", ticker],
    queryFn: () => fetchJSON<FinancialStatements>(`/api/stock-financials?symbol=${encodeURIComponent(ticker)}`),
    enabled: !!ticker,
  });
}

/** Metrics + ratios + scores — exposed now so CompanyProfile can surface real Piotroski/Z. */
export function useStockMetrics(ticker: string) {
  return useQuery({
    queryKey: ["stockMetrics", ticker],
    queryFn: () => fetchJSON<StockMetrics>(`/api/stock-metrics?symbol=${encodeURIComponent(ticker)}`),
    enabled: !!ticker,
  });
}

export function useStockAnalyst(ticker: string) {
  return useQuery({
    queryKey: ["stockAnalyst", ticker],
    queryFn: () => fetchJSON<AnalystTrends>(`/api/stock-analyst?symbol=${encodeURIComponent(ticker)}`),
    enabled: !!ticker,
  });
}

export function useStockInsider(ticker: string) {
  return useQuery({
    queryKey: ["stockInsider", ticker],
    queryFn: () => fetchJSON<InsiderTransaction[]>(`/api/stock-insider?symbol=${encodeURIComponent(ticker)}`),
    enabled: !!ticker,
  });
}

export function useStockNews(ticker: string) {
  return useQuery({
    queryKey: ["stockNews", ticker],
    queryFn: () => fetchJSON<NewsItem[]>(`/api/stock-news?symbol=${encodeURIComponent(ticker)}`),
    enabled: !!ticker,
  });
}

export function useEarningsCalendar(from: string, to: string) {
  return useQuery({
    queryKey: ["earningsCalendar", from, to],
    queryFn: () =>
      fetchJSON<EarningsEvent[]>(`/api/earnings-calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    enabled: !!from && !!to,
  });
}

export function useStockChart(ticker: string) {
  return useQuery({
    queryKey: ["stockChart", ticker],
    queryFn: () => fetchJSON<ChartSeries | null>(`/api/stock-chart?symbol=${encodeURIComponent(ticker)}`),
    enabled: !!ticker,
  });
}

/**
 * Parallel chart queries for a flat list of symbols (Phase 2).
 * Returns an array of (query result) in the same order as the input.
 * Use this for the Holdings table — React hooks can't be called in
 * a loop inside a render, so useQueries is the canonical answer.
 */
export function useMultiChart(symbols: string[]) {
  return useQueries({
    queries: symbols.map((sym) => ({
      queryKey: ["stockChart", sym],
      queryFn: () => fetchJSON<ChartSeries | null>(`/api/stock-chart?symbol=${encodeURIComponent(sym)}`),
      enabled: !!sym,
      staleTime: 60 * 60_000, // 1 hr — chart historical is heavy
    })),
  });
}

export type { IndexQuotesResponse };
