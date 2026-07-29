import { RequestHandler } from "express";
import { aggregateStockData } from "../services/stockAggregator";
import { fetchYahooQuote, fetchYahooPriceHistory } from "../services/yahooFinance";
import { getCompanyProfile, getEarnings, getInsiderTrades } from "../services/fmp";

/**
 * GET /api/stock-quote?symbol=AAPL
 * Returns real-time quote via Yahoo Finance (free, unlimited).
 */
export const handleStockQuote: RequestHandler = async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol || typeof symbol !== "string") {
      return res.status(400).json({ error: "symbol parameter required" });
    }
    const quote = await fetchYahooQuote(symbol.toUpperCase());
    if (!quote || quote.price == null) {
      return res.status(404).json({ error: "Unavailable via API" });
    }
    res.json({
      symbol: symbol.toUpperCase(),
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      afterHoursPrice: quote.afterHoursPrice,
      afterHoursChange: quote.afterHoursChange,
      afterHoursChangePercent: quote.afterHoursChangePercent,
    });
  } catch (error) {
    console.error("Error fetching stock quote:", error);
    res.status(500).json({ error: "Failed to fetch stock quote" });
  }
};

/**
 * GET /api/stock-overview?symbol=AAPL
 * Returns company profile + overview via FMP + Yahoo.
 */
export const handleStockOverview: RequestHandler = async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol || typeof symbol !== "string") {
      return res.status(400).json({ error: "symbol parameter required" });
    }
    const profile = await getCompanyProfile(symbol.toUpperCase());
    if (!profile) {
      return res.status(404).json({ error: "Unavailable via API" });
    }
    res.json(profile);
  } catch (error) {
    console.error("Error fetching stock overview:", error);
    res.status(500).json({ error: "Failed to fetch overview" });
  }
};

/**
 * GET /api/stock-data?symbol=AAPL
 * Returns aggregated stock data: quote, profile, quickStats, financialMetrics,
 * priceHistory, ratios, insider trades, earnings, price changes.
 * This is the main endpoint powering the stock detail page.
 */
export const handleStockData: RequestHandler = async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol || typeof symbol !== "string") {
      return res.status(400).json({ error: "symbol parameter required" });
    }
    const data = await aggregateStockData(symbol);
    if (!data.name && data.quote.price == null) {
      return res.status(404).json({ error: "No data available for this ticker" });
    }
    res.json(data);
  } catch (error) {
    console.error("Error aggregating stock data:", error);
    res.status(500).json({ error: "Failed to fetch stock data" });
  }
};

/**
 * GET /api/stock-time-series?symbol=AAPL
 * Returns historical price data via Yahoo Finance.
 */
export const handleStockTimeSeries: RequestHandler = async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol || typeof symbol !== "string") {
      return res.status(400).json({ error: "symbol parameter required" });
    }
    const history = await fetchYahooPriceHistory(symbol.toUpperCase(), 1);
    if (!history || history.length === 0) {
      return res.status(404).json({ error: "Unavailable via API" });
    }
    const quarters = history.slice(-20).map((p) => ({
      date: p.date,
      close: p.close,
    }));
    res.json({ quarters });
  } catch (error) {
    console.error("Error fetching time series:", error);
    res.status(500).json({ error: "Failed to fetch time series" });
  }
};

/**
 * GET /api/stock-insider-trades?symbol=AAPL
 * Returns insider trading transactions via FMP.
 */
export const handleStockInsiderTrades: RequestHandler = async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol || typeof symbol !== "string") {
      return res.status(400).json({ error: "symbol parameter required" });
    }
    const trades = await getInsiderTrades(symbol.toUpperCase());
    res.json({ trades: trades.slice(0, 20) });
  } catch (error) {
    console.error("Error fetching insider trades:", error);
    res.status(500).json({ error: "Failed to fetch insider trades" });
  }
};

/**
 * GET /api/stock-earnings?symbol=AAPL
 * Returns historical earnings via FMP.
 */
export const handleStockEarnings: RequestHandler = async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol || typeof symbol !== "string") {
      return res.status(400).json({ error: "symbol parameter required" });
    }
    const earnings = await getEarnings(symbol.toUpperCase());
    res.json({ earnings: earnings.slice(0, 8) });
  } catch (error) {
    console.error("Error fetching earnings:", error);
    res.status(500).json({ error: "Failed to fetch earnings" });
  }
};
