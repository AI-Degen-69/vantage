/**
 * Shared API surface between client and server.
 *
 * Everything returned by the server endpoints under /api/* AND fetched by
 * TanStack Query hooks in client/hooks/useStockData.ts is described here.
 * Server normalizers (server/services/stockService.ts) are responsible for
 * converting upstream FMP / Yahoo Finance shapes into these strict shapes.
 *
 * Conventions:
 *  - camelCase keys only. (FMP stable returns camelCase; legacy v3 sometimes
 *    returns PascalCase — see the normalizer.)
 *  - Numbers are real JS numbers, not strings.
 *  - Dates are ISO 8601 strings (YYYY-MM-DD or full ISO).
 *  - Times in `time` are "bmo" = before market open, "amc" = after market close.
 *  - "MOCK" semantics are NEVER passed on the wire: server downstream code
 *    returns 200 + (empty array | null | default object) and the client decides
 *    whether to show the [MOCK] badge.
 */

/* ------------------------------------------------------------------ *
 * Generic discriminated wrapper for upstream                                        *
 * ------------------------------------------------------------------ */
export type ApiResult<T> = T | null;

/* ------------------------------------------------------------------ *
 * Quote + Index widgets                                              *
 * ------------------------------------------------------------------ */
/** Stock quote / latest market data. */
export interface StockQuote {
  symbol: string;
  name?: string;
  price: number;
  /** Absolute intraday change. */
  change: number;
  /** Percent intraday change (already a number, e.g. 1.17 for 1.17%). */
  changesPercentage: number;
  /** Previous close (used for after-hours delta). */
  previousClose?: number;
  dayLow?: number;
  dayHigh?: number;
  yearLow?: number;
  yearHigh?: number;
  /** 50-day moving average. */
  priceAvg50?: number;
  /** 200-day moving average. Used by DipFinder. */
  priceAvg200?: number;
  marketCap?: number;
  volume?: number;
  avgVolume?: number;
  exchange?: string;
  sharesOutstanding?: number;
  eps?: number;
  pe?: number;
  /** Next earnings announcement date (ISO). */
  earningsAnnouncement?: string | null;
}

/** Marquee index quote for the TopBar pills. */
export interface IndexQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
}

/* ------------------------------------------------------------------ *
 * Company Profile (FMP)                                             *
 * ------------------------------------------------------------------ */
export interface CompanyProfile {
  symbol: string;
  companyName: string;
  description: string;
  sector: string;
  industry: string;
  ceo: string;
  website?: string;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  phone?: string;
  /** FMP returns this as a number (not always present) or string — normalize to number | null. */
  fullTimeEmployees: number | null;
  beta: number | null;
  /** TTM price-to-earnings. Often used as a single P/E. */
  peRatio: number | null;
  marketCap?: number;
  price?: number;
  exchange?: string;
  /** Friendly exchange name from /stable/ (e.g. "NASDAQ Global Select"). Falls back to short `exchange`. */
  exchangeFullName?: string;
  currency?: string;
  ipoDate?: string;
  image?: string;
  /* -------- /stable/-only identity fields (all optional, blank when absent) -------- */
  /** SEC EDGAR Central Index Key. */
  cik?: string;
  /** International Securities Identification Number. */
  isin?: string;
  /** Committee on Uniform Security Identification Procedures number. */
  cusip?: string;
  /** Most-recent quarterly dividend per share in the listing currency. */
  lastDividend?: number;
  /** True when the ticker tracks a pooled investment fund rather than a company. */
  isEtf?: boolean;
  /** True when the ticker tracks an investment fund (mutual fund / closed-end fund). */
  isFund?: boolean;
  /** True when the security is an American Depositary Receipt. */
  isAdr?: boolean;
  /** True when FMP still tracks active quotes for the ticker. */
  isActivelyTrading?: boolean;
  /** True when the company provided their own logo image (vs. a generic fallback). */
  defaultImage?: boolean;
}

/* ------------------------------------------------------------------ *
 * Financial statements (FMP) — one period per row                 *
 * ------------------------------------------------------------------ */
export interface IncomeStatementRow {
  date: string;
  symbol: string;
  reportedCurrency: string;
  calendarYear: string;
  period: string; // FY / Q1 / Q2 / ...
  revenue: number;
  costOfRevenue?: number;
  grossProfit: number;
  operatingIncome?: number;
  operatingExpense?: number;
  ebitda: number;
  netIncome: number;
  eps: number;
  epsDiluted?: number;
}

export interface BalanceSheetRow {
  date: string;
  symbol: string;
  reportedCurrency: string;
  calendarYear: string;
  period: string;
  totalAssets: number;
  totalLiabilities?: number;
  totalEquity?: number;
  totalDebt?: number;
  cashAndCashEquivalents: number;
  netDebt?: number;
}

export interface CashFlowRow {
  date: string;
  symbol: string;
  reportedCurrency: string;
  calendarYear: string;
  period: string;
  operatingCashFlow: number;
  capitalExpenditure?: number;
  freeCashFlow: number;
  stockBasedCompensation?: number;
  dividendPayments?: number;
}

export interface FinancialStatements {
  income: IncomeStatementRow[];
  balance: BalanceSheetRow[];
  cash: CashFlowRow[];
}

/* ------------------------------------------------------------------ *
 * Key Metrics + Ratios + Scores                                     *
 * ------------------------------------------------------------------ */
export interface KeyMetricsTTM {
  revenuePerShareTTM?: number;
  netIncomePerShareTTM?: number;
  operatingCashFlowPerShareTTM?: number;
  peRatioTTM?: number;
  /** Common misspelling of yield — kept here to surface docs warning. */
  dividendYielTTM?: number;
  priceToSalesRatioTTM?: number;
  priceToBookRatioTTM?: number;
  evToSalesTTM?: number;
  evToEBITDATTM?: number;
  evToOperatingCashFlowTTM?: number;
  returnOnEquityTTM?: number;
  returnOnAssetsTTM?: number;
  freeCashFlowYieldTTM?: number;
}

export interface RatiosTTM {
  priceToSalesRatioTTM?: number;
  priceToBookRatioTTM?: number;
  priceToEarningsGrowthRatioTTM?: number;
  /** Headline P/E TTM — present on /stable/ratios-ttm, used to back-fill StockQuote.pe. */
  priceEarningsRatioTTM?: number;
  netProfitMargin?: number;
  operatingProfitMarginTTM?: number;
  grossProfitMarginTTM?: number;
  dividendPayoutRatioTTM?: number;
  currentRatio?: number;
  quickRatio?: number;
  debtToEquityRatio?: number;
}

export interface FinancialScores {
  symbol: string;
  altmanZScore?: number;
  piotroskiScore?: number; // 0–9
}

export interface StockMetrics {
  metrics: KeyMetricsTTM;
  ratios: RatiosTTM;
  scores: FinancialScores | null;
}

/* ------------------------------------------------------------------ *
 * Analyst estimates (Yahoo earningsTrend)                          *
 * ------------------------------------------------------------------ */
export type AnalystPeriodCode = "-1y" | "-7d" | "0q" | "0y" | "+1q" | "+1y";

export interface AnalystTrendPoint {
  period: AnalystPeriodCode | string;
  endDate?: string;
  growth?: { raw: number; fmt: string } | number;
  earningsEstimate?: {
    avg: number | null;
    low: number | null;
    high: number | null;
  };
  revenueEstimate?: {
    avg: number | null;
    low: number | null;
    high: number | null;
  };
  epsTrend?: { current: number | null; sevenDaysAgo: number | null; thirtyDaysAgo: number | null };
  epsRevisions?: { upLast7Days: number | null; upLast30Days: number | null };
}

export type AnalystTrends = AnalystTrendPoint[];

/* ------------------------------------------------------------------ *
 * Insider transactions (Yahoo)                                     *
 * ------------------------------------------------------------------ */
export interface InsiderTransaction {
  filerName: string;
  filerRelation?: string;
  transactionText: string;
  startDate: string | number; // ISO or unix seconds (Yahoo uses unix)
  shares: number;
  value: number;
  /** Computed on the server (value / shares) so the UI doesn't have to. */
  price: number;
}

/* ------------------------------------------------------------------ *
 * News (Yahoo .search().news)                                       *
 * ------------------------------------------------------------------ */
export interface NewsItem {
  title: string;
  publisher: string;
  /** unix seconds — UI converts to a localized date. */
  providerPublishTime: number;
  link: string;
  /** Optional thumbnail URL — Yahoo v4 sometimes has it. */
  thumbnail?: string;
  type?: string;
}

/* ------------------------------------------------------------------ *
 * Earnings calendar (FMP ?from=YYYY-MM-DD&to=YYYY-MM-DD)           *
 * ------------------------------------------------------------------ */
export type EarningsCallTime = "bmo" | "amc" | "dmh" | string;

export interface EarningsEvent {
  symbol: string;
  /** FMP returns an ISO date, e.g. "2024-08-01". */
  date: string;
  /** Optional market cap enrichment used by earnings filters. */
  marketCap?: number | null;
  epsEstimated: number | null;
  /** FMP gives this only if actual EPS is reported. */
  eps: number | null;
  revenueEstimated: number | null;
  revenue: number | null;
  time: EarningsCallTime;
}

/* ------------------------------------------------------------------ *
 * Chart (FMP historical-price-full)                                *
 * ------------------------------------------------------------------ */
export interface ChartPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
  change: number;
  changePercent: number;
}

export interface ChartSeries {
  symbol: string;
  historical: ChartPoint[];
}

/* ------------------------------------------------------------------ *
 * Inclusion list for batch quotes                                   *
 * ------------------------------------------------------------------ */
export interface BatchQuoteResponse {
  /** One entry per ticker, in the same order as requested. Missing symbols become null. */
  quotes: (StockQuote | null)[];
}

/* ------------------------------------------------------------------ *
 * Demo / ping                                                        *
 * ------------------------------------------------------------------ */
export interface DemoResponse {
  message: string;
}
export interface PingResponse {
  message: string;
}

/* ------------------------------------------------------------------ *
 * Insights tab universes (server-curated lists per Insights tab)   *
 * ------------------------------------------------------------------ */
export type InsightsTabId =
  | "sp500"
  | "trending"
  | "growth"
  | "dividend"
  | "buyback"
  | "ai"
  | "cloud"
  | "ev"
  | "leisure";

/** Lightweight entry in a tab universe — the client overlays live prices via `useBatchQuotes`. */
export interface InsightsTabEntry {
  symbol: string;
  /** Curated display name (Yahoo / FMP profile will replace once live). */
  name: string;
  /** Optional sector — surfaced as a chip in the card. */
  sector?: string;
}

export interface InsightsTabResponse {
  tab: InsightsTabId;
  label: string; // localized label, computed by the handler against ?lang=… for SSR parity.
  entries: InsightsTabEntry[];
}

/* ------------------------------------------------------------------ *
 * Per-ticker SMA-200 distance (computed by the server)               *
 * ------------------------------------------------------------------ */
export interface SmaDistanceRow {
  symbol: string;
  /** 200-day SMA. null when fewer than 200 closes were available. */
  sma200: number | null;
  /** (close - sma200) / sma200 * 100. null when sma200 is null. */
  distancePct: number | null;
  /** Number of closes used to compute the SMA — surfaces under-N as [PARTIAL]. */
  sampleSize: number;
  /** That symbol's latest quote price, falling back to the latest historical close. */
  price: number | null;
}

export interface SmaDistanceResponse {
  rows: SmaDistanceRow[];
}

/**
 * One cell of the sector heatmap — a sector's average % move DURING one
 * trading day. `date` is the day the move ENDED on, so for a 5-day heatmap
 * ending 2025-03-21, the heatmap shows the 5 days that ended:
 *   2025-03-17, 2025-03-18, 2025-03-19, 2025-03-20, 2025-03-21
 * `movePct` is null when no ticker in the sector had a close on `date`,
 * `isPartial` is true on the rightmost column (today vs yesterday, i.e.
 * still in-session intraday), and `withPrice`/`total` count how many tickers
 * contributed so the UI can show "12 of 14 contributed".
 */
export interface SectorHeatmapCell {
  date: string;
  movePct: number | null;
  withPrice: number;
  total: number;
  isPartial: boolean;
}

/**
 * One row of the sector heatmap — a sector's 5 daily % moves plus a
 * weekNet rollup. `weekNet` is the average per-ticker cumulative return
 * from the heatmap's oldest column's close to its newest column's close,
 * expressed as a percentage. Sort rows by `weekNet` desc so the hottest
 * sector lands at the top, mirroring Bloomberg's HSPA / HEAT layout.
 */
export interface SectorHeatmapRow {
  sector: string;
  cells: SectorHeatmapCell[];
  weekNet: number | null;
  /** Total tickers in the universe belonging to this sector. */
  universeCount: number;
}

/**
 * Tracks move history for tickers whose universe row lacks a sector tag.
 * Surfaced separately so the heatsheet footer can quote the count without
 * silently misattributing those tickers to a placeholder sector.
 */
export interface SectorHeatmapUntagged {
  symbol: string;
  cells: Array<{
    date: string;
    movePct: number | null;
    isPartial: boolean;
  }>;
}

/**
 * Server response for `GET /api/sector-heatmap?symbols=…&days=5`. Column
 * axis (`days`) is oldest → newest ISO dates, matching `rows[*].cells` index
 * order. `generatedAt` is the server's cache-write ISO timestamp so the
 * client can show "Updated 12 min ago" without re-fetching.
 */
export interface SectorHeatmapResponse {
  days: string[];
  rows: SectorHeatmapRow[];
  untagged: SectorHeatmapUntagged[];
  generatedAt: string;
}

/* ------------------------------------------------------------------ *
 * FX rates (Yahoo Finance: USDEUR=X, USDILS=X, EURILS=X)            *
 * ------------------------------------------------------------------ */
export type FxCurrency = "USD" | "ILS" | "EUR" | "GBP";

export interface FxRatesResponse {
  /** Example: { USDILS: 3.75, USDEUR: 0.92, ILSUSD: 0.267, … } */
  rates: Record<string, number>;
  /** ISO timestamp the rates were fetched at server-side. */
  fetchedAt: string;
  /** Source label so the UI can render a tiny "FX from Yahoo" footnote. */
  source: string;
}

/* ------------------------------------------------------------------ *
 * Portfolio analytics (Phase 2)                                     *
 * ------------------------------------------------------------------ */
/** Signed cashflow point. `amount` is USD by convention; negative = invested, positive = received. */
export interface PortfolioCashflow {
  /** ISO date string. */
  date: string;
  amount: number;
}

export interface PortfolioMetrics {
  /** Internal Rate of Return as decimal (e.g. 0.094 = 9.4% APR). */
  irr: number | null;
  /** Compound annual growth rate as decimal. */
  cagr: number | null;
  /** Annualized volatility of daily returns, as decimal. */
  volatility: number | null;
  /** Sharpe ratio (rf = 4.5% default). */
  sharpe: number | null;
  /** Sortino ratio (downside deviation only). */
  sortino: number | null;
  /** Alpha vs SPY (placeholder; null when benchmark unavailable). */
  alpha: number | null;
  /** Beta vs SPY (placeholder; null when benchmark unavailable). */
  beta: number | null;
  /** Free-text note flagging anything derived. */
  derived: string[];
}

/* ------------------------------------------------------------------ *
 * Error shape used by route handlers                                *
 * ------------------------------------------------------------------ */
export interface ApiError {
  error: string;
}
