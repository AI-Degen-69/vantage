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

/**
 * Fetches JSON data from a URL.
 *
 * @param url - The URL to request
 * @param init - Optional request configuration
 * @returns The parsed response data
 * @throws An error when the response status indicates failure
 */
async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`);
  return res.json() as Promise<T>;
}

/**
 * Retrieves the latest quote for a stock ticker.
 *
 * @param ticker - The stock ticker symbol
 * @returns The query result containing the stock quote, or `null` when no quote is available
 */
export function useStockQuote(ticker: string) {
  return useQuery({
    queryKey: ["stockQuote", ticker],
    queryFn: () => fetchJSON<StockQuote | null>(`/api/stock-quote?symbol=${encodeURIComponent(ticker)}`),
    enabled: !!ticker,
    refetchInterval: 60_000,
  });
}

/**
 * Fetches quotes for multiple stock tickers.
 *
 * @param tickers - The stock ticker symbols to fetch.
 * @returns The query result containing the batch quote response.
 */
export function useBatchQuotes(tickers: string[]) {
  const sortedTickers = tickers.slice().sort();
  const key = sortedTickers.join(",");
  return useQuery({
    queryKey: ["batchQuotes", key],
    queryFn: () =>
      fetchJSON<BatchQuoteResponse>(`/api/stock-batch-quotes?symbols=${encodeURIComponent(sortedTickers.join(","))}`),
    enabled: tickers.length > 0,
    refetchInterval: 60_000,
  });
}

/**
 * Fetches the Dow, S&P 500, and Nasdaq index quotes.
 *
 * @returns The query result containing the index quotes.
 */
export function useIndexQuotes() {
  return useQuery({
    queryKey: ["indexQuotes"],
    queryFn: () => fetchJSON<IndexQuotesResponse>(`/api/index-quotes`),
    refetchInterval: 5 * 60_000,
  });
}

/**
 * Fetches curated ticker data for an Insights tab.
 *
 * @param tab - The Insights tab whose data to retrieve
 * @returns The query result containing the tab's Insights data
 */
export function useInsightsTab(tab: InsightsTabId) {
  return useQuery({
    queryKey: ["insightsTab", tab],
    queryFn: () => fetchJSON<InsightsTabResponse>(`/api/insights-tab?tab=${encodeURIComponent(tab)}`),
    staleTime: 5 * 60_000,
  });
}

/**
 * Retrieves each symbol's distance from its simple moving average.
 *
 * @param symbols - Symbols to include in the response
 * @param windowSize - Number of periods used to calculate the moving average
 * @returns The query result containing SMA distance data
 */
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

/**
 * Retrieves exchange rates for the requested currencies.
 *
 * @param currencies - The currencies to include in the exchange-rate response.
 * @returns The query result containing the requested foreign-exchange rates.
 */
export function useFxRates(currencies: FxCurrency[] = ["USD", "ILS", "EUR"]) {
  const key = currencies.slice().sort().join(",");
  return useQuery({
    queryKey: ["fxRates", key],
    queryFn: () =>
      fetchJSON<FxRatesResponse>(`/api/fx-rates?currencies=${encodeURIComponent(currencies.join(","))}`),
    staleTime: 60 * 60_000, // 1h — FX doesn't move intraday
  });
}

/**
 * Retrieves the company profile for a stock ticker.
 *
 * @param ticker - The stock ticker symbol.
 * @returns The company profile, or `null` when no profile is available.
 */
export function useStockProfile(ticker: string) {
  return useQuery({
    queryKey: ["stockProfile", ticker],
    queryFn: () => fetchJSON<CompanyProfile | null>(`/api/stock-overview?symbol=${encodeURIComponent(ticker)}`),
    enabled: !!ticker,
  });
}


/**
 * Fetches financial statements for a stock ticker.
 *
 * @param ticker - The stock ticker symbol
 * @returns The query result containing the stock's financial statements
 */
export function useStockFinancials(ticker: string) {
  return useQuery({
    queryKey: ["stockFinancials", ticker],
    queryFn: () => fetchJSON<FinancialStatements>(`/api/stock-financials?symbol=${encodeURIComponent(ticker)}`),
    enabled: !!ticker,
  });
}

/**
 * Retrieves financial metrics, valuation ratios, and investment scores for a stock.
 *
 * @param ticker - The stock ticker symbol.
 * @returns A query result containing the stock metrics data.
 */
export function useStockMetrics(ticker: string) {
  return useQuery({
    queryKey: ["stockMetrics", ticker],
    queryFn: () => fetchJSON<StockMetrics>(`/api/stock-metrics?symbol=${encodeURIComponent(ticker)}`),
    enabled: !!ticker,
  });
}

/**
 * Retrieves analyst trend data for a stock ticker.
 *
 * @param ticker - The stock ticker symbol
 * @returns The query result containing analyst trend data
 */
export function useStockAnalyst(ticker: string) {
  return useQuery({
    queryKey: ["stockAnalyst", ticker],
    queryFn: () => fetchJSON<AnalystTrends>(`/api/stock-analyst?symbol=${encodeURIComponent(ticker)}`),
    enabled: !!ticker,
  });
}

/**
 * Retrieves insider transaction data for a stock ticker.
 *
 * @param ticker - The stock ticker symbol
 * @returns The query result containing insider transactions
 */
export function useStockInsider(ticker: string) {
  return useQuery({
    queryKey: ["stockInsider", ticker],
    queryFn: () => fetchJSON<InsiderTransaction[]>(`/api/stock-insider?symbol=${encodeURIComponent(ticker)}`),
    enabled: !!ticker,
  });
}

/**
 * Retrieves news articles for a stock ticker.
 *
 * @param ticker - The stock ticker symbol
 * @returns The query result containing the stock news articles
 */
export function useStockNews(ticker: string) {
  return useQuery({
    queryKey: ["stockNews", ticker],
    queryFn: () => fetchJSON<NewsItem[]>(`/api/stock-news?symbol=${encodeURIComponent(ticker)}`),
    enabled: !!ticker,
  });
}

/**
 * Retrieves earnings events within a specified date range.
 *
 * @param from - The start date of the range
 * @param to - The end date of the range
 * @returns The query result containing the earnings events
 */
export function useEarningsCalendar(from: string, to: string) {
  return useQuery({
    queryKey: ["earningsCalendar", from, to],
    queryFn: () =>
      fetchJSON<EarningsEvent[]>(`/api/earnings-calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    enabled: !!from && !!to,
  });
}

/**
 * Fetches historical chart data for a stock ticker.
 *
 * @param ticker - The stock ticker symbol
 * @returns The chart series, or `null` when no data is available
 */
export function useStockChart(ticker: string) {
  return useQuery({
    queryKey: ["stockChart", ticker],
    queryFn: () => fetchJSON<ChartSeries | null>(`/api/stock-chart?symbol=${encodeURIComponent(ticker)}`),
    enabled: !!ticker,
  });
}

/**
 * Fetches chart data for multiple symbols in parallel.
 *
 * @returns Query results in the same order as the input symbols.
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
