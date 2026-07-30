import { RequestHandler } from "express";
import { stockService } from "../services/stockService";
import type {
  BatchQuoteResponse,
  ChartSeries,
  CompanyProfile,
  EarningsEvent,
  FinancialStatements,
  FxCurrency,
  FxRatesResponse,
  IndexQuote,
  InsightsTabResponse,
  SmaDistanceResponse,
  StockMetrics,
  StockQuote,
  SectorHeatmapResponse,
} from "../../shared/api";

const MAX_SYMBOLS = 50;

export const handleStockQuote: RequestHandler = async (req, res) => {
  const symbol = String(req.query.symbol || "");
  if (!symbol) return res.status(400).json({ error: "symbol parameter required" });
  const quote = await stockService.getQuote(symbol);
  res.json(quote satisfies StockQuote | null);
};

export const handleBatchQuotes: RequestHandler = async (req, res) => {
  const symbolsRaw = String(req.query.symbols || "");
  if (!symbolsRaw) return res.status(400).json({ error: "symbols parameter required" });
  const symbols = symbolsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (symbols.length > MAX_SYMBOLS) {
    return res.status(400).json({ error: `Too many symbols requested. Maximum is ${MAX_SYMBOLS}, received ${symbols.length}` });
  }
  const result: BatchQuoteResponse = await stockService.getBatchQuotes(symbols);
  res.json(result);
};

/**
 * @deprecated The client now hits `/api/stock-overview` for company
 * profile data. This route forwards to `getProfile` so the response shape
 * is `CompanyProfile` (NOT a `StockQuote` — the original alias was a bug).
 */
export const handleStockProfile: RequestHandler = async (req, res) => {
  const symbol = String(req.query.symbol || "");
  if (!symbol) return res.status(400).json({ error: "symbol parameter required" });
  const profile: CompanyProfile | null = await stockService.getProfile(symbol);
  res.json(profile);
};

export const handleStockOverview: RequestHandler = async (req, res) => {
  const symbol = String(req.query.symbol || "");
  if (!symbol) return res.status(400).json({ error: "symbol parameter required" });
  const profile: CompanyProfile | null = await stockService.getProfile(symbol);
  res.json(profile);
};

export const handleStockFinancials: RequestHandler = async (req, res) => {
  const symbol = String(req.query.symbol || "");
  if (!symbol) return res.status(400).json({ error: "symbol parameter required" });
  const data: FinancialStatements = await stockService.getFinancialStatements(symbol);
  res.json(data);
};

export const handleStockMetrics: RequestHandler = async (req, res) => {
  const symbol = String(req.query.symbol || "");
  if (!symbol) return res.status(400).json({ error: "symbol parameter required" });
  const data: StockMetrics = await stockService.getMetrics(symbol);
  res.json(data);
};

export const handleStockAnalyst: RequestHandler = async (req, res) => {
  const symbol = String(req.query.symbol || "");
  if (!symbol) return res.status(400).json({ error: "symbol parameter required" });
  const data = await stockService.getAnalystEstimates(symbol);
  res.json(data);
};

export const handleStockInsider: RequestHandler = async (req, res) => {
  const symbol = String(req.query.symbol || "");
  if (!symbol) return res.status(400).json({ error: "symbol parameter required" });
  const data = await stockService.getInsiderTrading(symbol);
  res.json(data);
};

export const handleStockNews: RequestHandler = async (req, res) => {
  const symbol = String(req.query.symbol || "");
  if (!symbol) return res.status(400).json({ error: "symbol parameter required" });
  const data = await stockService.getNews(symbol);
  res.json(data);
};

export const handleEarningsCalendar: RequestHandler = async (req, res) => {
  const from = String(req.query.from || "");
  const to = String(req.query.to || "");
  if (!from || !to) return res.status(400).json({ error: "from and to parameters required" });
  const data: EarningsEvent[] = await stockService.getEarningsCalendar(from, to);
  res.json(data);
};

export const handleStockChart: RequestHandler = async (req, res) => {
  const symbol = String(req.query.symbol || "");
  if (!symbol) return res.status(400).json({ error: "symbol parameter required" });
  const data: ChartSeries | null = await stockService.getChart(symbol);
  res.json(data);
};

export const handleIndexQuotes: RequestHandler = async (_req, res) => {
  const data = await stockService.getIndexQuotes();
  // Wrap in a typed shape for the client; missing entries are null.
  const wrap = (
    q: StockQuote | null,
    name: string
  ): IndexQuote | null => (q ? { symbol: q.symbol, name, price: q.price, change: q.change, changesPercentage: q.changesPercentage } : null);
  res.json({
    dow: wrap(data.dow, "Dow Jones"),
    sp500: wrap(data.sp500, "S&P 500"),
    nasdaq: wrap(data.nasdaq, "Nasdaq"),
  });
};

/**
 * Sector × days heatmap for an Insights universe. Fanned out server-side
 * from `getChart` per symbol, then aggregated by sector in one pass.
 * Whole-aggregation cached for 15 minutes; per-ticker chart cache reused.
 *
 * Query params:
 *   - `symbols=AAPL,MSFT,…` (required, comma-separated; max 50)
 *   - `days=5` (optional, clamped 3-10; default 5)
 *   - `sectors=Technology,Healthcare` (optional allowlist; rows outside the
 *     allowlist flow into `untagged[]` instead of `rows`)
 */
export const handleSectorHeatmap: RequestHandler = async (req, res) => {
  const symbolsRaw = String(req.query.symbols || "");
  if (!symbolsRaw) return res.status(400).json({ error: "symbols parameter required" });
  const symbols = symbolsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (symbols.length > MAX_SYMBOLS) {
    return res.status(400).json({
      error: `Too many symbols requested. Maximum is ${MAX_SYMBOLS}, received ${symbols.length}`,
    });
  }
  const daysRaw = Number(req.query.days ?? 5);
  const days = Math.max(3, Math.min(10, Number.isFinite(daysRaw) ? Math.floor(daysRaw) : 5));
  const sectorsRaw = String(req.query.sectors || "").trim();
  const sectorAllow =
    sectorsRaw.length > 0
      ? sectorsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : null;
  const data: SectorHeatmapResponse = await stockService.getSectorHeatmap(
    symbols,
    days,
    sectorAllow,
  );
  res.json(data);
};

/**
 * Curated ticker universe for an Insights tab (Phase 1). The client overlays
 * live prices via `/api/stock-batch-quotes?symbols=…`.
 */
export const handleInsightsTab: RequestHandler = async (req, res) => {
  const tab = String(req.query.tab || "sp500");
  const data: InsightsTabResponse = stockService.getInsightsTab(tab);
  res.json(data);
};

/**
 * SMA-200 distance for a list of symbols. Symbols are supplied via repeated
 * `symbol=AAPL&symbol=MSFT` OR a single comma-separated `symbols=AAPL,MSFT`
 * parameter — both work because Express populates an array either way.
 *
 * `?window=20` (default 200, max 200) selects the SMA window directly.
 */
export const handleSmaDistances: RequestHandler = async (req, res) => {
  const listRaw = req.query.symbols ?? req.query.symbol ?? [];
  const list: string[] = Array.isArray(listRaw)
    ? listRaw.map((s) => String(s))
    : String(listRaw).split(",").map((s) => s.trim());
  const symbols = list.filter(Boolean);
  if (symbols.length > MAX_SYMBOLS) {
    return res.status(400).json({ error: `Too many symbols requested. Maximum is ${MAX_SYMBOLS}, received ${symbols.length}` });
  }
  const windowRaw = Number(req.query.window ?? 200);
  const windowSize = Number.isFinite(windowRaw) ? windowRaw : 200;
  const data: SmaDistanceResponse = await stockService.getSmaDistancesFor(symbols, windowSize);
  res.json(data);
};

/**
 * Live FX rates for cross-currency display (Phase 2). Currencies supplied as
 * `?currencies=USD,ILS,EUR` (any order; default USD,ILS,EUR). Yahoo offloads
 * the heavy lifting.
 */
export const handleFxRates: RequestHandler = async (req, res) => {
  const raw = String(req.query.currencies || "USD,ILS,EUR");
  const currencies: FxCurrency[] = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is FxCurrency => s === "USD" || s === "ILS" || s === "EUR" || s === "GBP");
  if (currencies.length === 0) {
    return res.status(400).json({ error: "currencies parameter required" });
  }
  const data: FxRatesResponse = await stockService.getFxRates(currencies);
  res.json(data);
};
