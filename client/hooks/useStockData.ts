import { useMemo } from "react";
import { useQuery, useQueries, keepPreviousData } from "@tanstack/react-query";
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
  SectorHeatmapResponse,
  StockMetrics,
  StockQuote,
} from "@shared/api";
import type { QuickStat } from "@/lib/mockData";
import type { CompanyProfile as ApiCompanyProfile } from "@shared/api";

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

/**
 * Aggregates news across many symbols into a single chronologically-sorted
 * feed, tagged with the originating ticker. Powers the Watchlists sidebar
 * "Recent News" panel so users see headlines for the tickers they care about
 * without having to drill into each stock page.
 *
 * Strategy:
 *   1. Run `useStockNews` in parallel for every requested symbol via
 *      `useQueries` (bounded to at most the first 8 symbols — beyond that,
 *      the per-request upstream quota starts to risk 429s on Yahoo's
 *      news endpoint).
 *   2. Flatten the results, drop items the upstream omitted, attach the
 *      symbol, then sort by `providerPublishTime` descending.
 *
 * Caveat: many symbols share the same headline pool (e.g. AAPL/JPM/MSFT all
 * appear on "Fed signals rate cut" macro stories). When that happens the
 * same headline appears N times in the output. We accept this for now —
 * the Watclists panel caps the render at 5 items so the duplicate is at
 * most one row visible per ticker entry, and renderers can de-dup later.
 */
export function useWatchlistNews(symbols: string[], limit = 30) {
  // Cap the per-symbol fan-out at 8 — Yahoo's news endpoint degrades fast
  // past that on free-tier rate limits. The remaining symbols still appear
  // in the UI watchlist table; only the news aggregation sees the cap.
  const bounded = useMemo(() => symbols.slice(0, 8), [symbols]);
  const results = useQueries({
    queries: bounded.map((sym) => ({
      queryKey: ["stockNews", sym],
      queryFn: () => fetchJSON<NewsItem[]>(`/api/stock-news?symbol=${encodeURIComponent(sym)}`),
      enabled: !!sym,
      staleTime: 5 * 60_000,
    })),
  });
  const unified = useMemo(
    () =>
      results
        .flatMap((q, i) =>
          (q.data ?? []).map((n) => ({
            ...n,
            symbol: bounded[i],
            providerPublishTime: n.providerPublishTime ?? 0,
          }))
        )
        .sort((a, b) => b.providerPublishTime - a.providerPublishTime)
        .slice(0, limit),
    [results, bounded, limit]
  );
  return useMemo(
    () => ({
      items: unified,
      isLoading: results.some((q) => q.isLoading),
      isAnyFailing: results.some((q) => q.isError),
      perSymbolCount: bounded.map((sym, i) => ({
        symbol: sym,
        isLive: !!results[i]?.data && results[i]!.data!.length > 0,
        count: results[i]?.data?.length ?? 0,
      })),
    }),
    [unified, results, bounded]
  );
}

// Composite-hook local types — NOT exported. Kept inline because the slide-over
// relies on inference from the hook's return value (no direct import here).
// `QuickStat` is imported from `@/lib/mockData` for single-source-of-truth.
interface SlideOverQuote {
  price: number;
  change: number;
  changePercent: number;
  afterHoursPrice?: number;
  afterHoursChange?: number;
}
interface SlideOverRatios {
  peTtm?: number;
  peNtm?: number;
  priceToBook?: number;
  priceToSales?: number;
  evToEbitda?: number;
  dividendYield?: number;
  pegRatio?: number;
  beta?: number;
}
interface SlideOverProfile {
  description?: string;
}
interface SlideOverStockData {
  name: string;
  exchange: string;
  quote: SlideOverQuote | null;
  ratios: SlideOverRatios | null;
  /** No backend coverage yet — kept null so the slide-over's `{priceChange && …}` hides the strip. */
  priceChange: { ytd?: number; "1Y"?: number; "3Y"?: number } | null;
  /** Mock-only data — always empty in production; slide-over's `length > 0 && …` skips the section. */
  quickStats: QuickStat[];
  profile: SlideOverProfile | null;
}

/**
 * Composite hook aggregating profile + quote + metrics into the shape
 * `StockSlideOver` reads. Each underlying query runs in parallel via TanStack
 * Query.
 *
 * Loading is true while ANY of the three is pending (slide-over shows a
 * spinner). Error is true only when the two load-bearing queries (profile+
 * quote) BOTH fail — metrics alone erroring shouldn't blow away a usable
 * price header just because the ratio grid couldn't populate. Sections of
 * the slide-over that don't have any data (priceChange strip, quickStats,
 * P/E Forward row, after-hours price) are kept as `null`/empty and the
 * slide-over's section-level `{x && …}` guards hide them gracefully.
 *
 * @param ticker - The stock ticker symbol
 * @returns `{ data, isLoading, isError }` matching `StockSlideOver`'s API
 */
export function useStockData(ticker: string) {
  const profileQ = useStockProfile(ticker);
  const quoteQ = useStockQuote(ticker);
  const metricsQ = useStockMetrics(ticker);

  const profile = profileQ.data ?? null;
  const quote = quoteQ.data ?? null;
  const metrics = metricsQ.data ?? null;

  // `data` is null until at least one of the three resolves so the slide-over
  // shows its spinner instead of a half-populated card.
  const data: SlideOverStockData | null =
    !profile && !quote && !metrics
      ? null
      : {
          name: profile?.companyName ?? ticker,
          exchange: profile?.exchange ?? "",
          quote: quote
            ? {
                price: quote.price,
                change: quote.change,
                changePercent: quote.changesPercentage,
                // /stock-quote doesn't carry after-hours data. Explicit
                // `undefined` keeps the keys present so slide-over's direct
                // access (`quote.afterHoursPrice`) typechecks; the slide-over's
                // `!= null` guard then hides the row.
                afterHoursPrice: undefined,
                afterHoursChange: undefined,
              }
            : null,
          ratios: metrics
            ? {
                peTtm: profile?.peRatio ?? metrics.ratios?.priceEarningsRatioTTM ?? undefined,
                peNtm: undefined,
                priceToBook:
                  metrics.ratios?.priceToBookRatioTTM ??
                  metrics.metrics?.priceToBookRatioTTM ??
                  undefined,
                priceToSales:
                  metrics.ratios?.priceToSalesRatioTTM ??
                  metrics.metrics?.priceToSalesRatioTTM ??
                  undefined,
                evToEbitda: metrics.metrics?.evToEBITDATTM ?? undefined,
                dividendYield: metrics.metrics?.dividendYielTTM ?? undefined,
                pegRatio: metrics.ratios?.priceToEarningsGrowthRatioTTM ?? undefined,
                // Profile.beta is the canonical source (already on /stock-overview).
                beta: profile?.beta ?? undefined,
              }
            : null,
          priceChange: null,
          quickStats: [],
          profile: profile ? { description: profile.description } : null,
        };

  return {
    data,
    isLoading: profileQ.isLoading || quoteQ.isLoading || metricsQ.isLoading,
    isError: profileQ.isError && quoteQ.isError,
  };
}

/**
 * Sector × days heatmap for the live Insights universe. Server fans out
 * `getChart` + `getProfile` per symbol, aggregates by sector tag in one
 * pass, and caches the entire heatmap server-side for 15 minutes. The
 * query key embeds the sorted symbol list + day count so distinct calls
 * don't collide; client staleTime below lets React Query refetch slightly
 * faster than the server TTL for snappier UX.
 */
export function useSectorHeatmap(symbols: string[], days: number = 5) {
  const sortedSyms = symbols.slice().sort();
  const key = sortedSyms.join(",");
  return useQuery({
    queryKey: ["sectorHeatmap", key, `d=${days}`],
    queryFn: () =>
      fetchJSON<SectorHeatmapResponse>(
        `/api/sector-heatmap?symbols=${encodeURIComponent(key)}&days=${encodeURIComponent(String(days))}`,
      ),
    enabled: symbols.length > 0,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    // Keep the previous universe's heatmap visible while a new one is in
    // flight — prevents the one-render flash of an empty block when users
    // switch tabs across the 5-minute refetch window. `keepPreviousData`
    // is keyed on queryKey so a tab switch produces a different key and
    // we won't replay the old aggregates onto the new universe.
    placeholderData: keepPreviousData,
  });
}

/**
 * Validate a batch of candidate symbols against `/api/stock-overview`.
 * Powers the Add-Watchlist sheet's preview chips so we don't blindly
 * commit a typo ("APPL" for Apple) into the persisted store.
 *
 * Strategy:
 *   - Run `useStockProfile` in parallel via `useQueries`, capped at the
 *     first 8 candidates per call (matches `useWatchlistNews`'s rate
 *     ceiling — beyond 8, free-tier FMP `/stable/profile` risks 429s).
 *   - A candidate is "valid" when the upstream returned a non-null
 *     CompanyProfile with a non-empty `symbol` field. Unrecognized
 *     tickers surface as `invalid`. Per-query `isError` is informational
 *     but does not disqualify the row — we surface the result list
 *     regardless so the user can decide.
 *
 * `staleTime: 5min` per query keeps repeated validation of the same
 * Add-sheet session cheap (users often re-paste while iterating).
 */
export function useValidateSymbols(candidates: string[]) {
  const bounded = useMemo(
    () =>
      candidates
        .slice(0, 8)
        .map((s) => s.toUpperCase().trim())
        .filter(Boolean),
    [candidates],
  );
  const results = useQueries({
    queries: bounded.map((sym) => ({
      queryKey: ["stockProfile", sym],
      queryFn: () =>
        fetchJSON<ApiCompanyProfile | null>(
          `/api/stock-overview?symbol=${encodeURIComponent(sym)}`,
        ),
      enabled: !!sym,
      staleTime: 5 * 60_000,
    })),
  });
  const valid: Array<{ symbol: string; profile: ApiCompanyProfile }> = [];
  const invalid: string[] = [];
  for (let i = 0; i < bounded.length; i++) {
    const sym = bounded[i];
    const data = results[i]?.data;
    if (data && typeof data.symbol === "string" && data.symbol.length > 0) {
      valid.push({ symbol: data.symbol.toUpperCase(), profile: data });
    } else if (data === null) {
      invalid.push(sym);
    }
  }
  return useMemo(
    () => ({
      valid,
      invalid,
      isValidating: results.some((q) => q.isLoading),
      isError: results.some((q) => q.isError),
    }),
    [valid, invalid, results],
  );
}

export type { IndexQuotesResponse };
