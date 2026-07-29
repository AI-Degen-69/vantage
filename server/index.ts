import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleCompanyLogo } from "./routes/company-logo";
import {
  handleStockQuote,
  handleStockTimeSeries,
  handleStockOverview,
  handleStockData,
  handleStockInsiderTrades,
  handleStockEarnings,
} from "./routes/stock-data";
import { handleInsightsStocks, handleInsightsUniverses } from "./routes/insights";
import { handleEarningsCalendar } from "./routes/earnings";
import { handleChartHistory } from "./routes/chart-history";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.get("/api/company-logo", handleCompanyLogo);

  // Stock data routes
  app.get("/api/stock-quote", handleStockQuote);
  app.get("/api/stock-time-series", handleStockTimeSeries);
  app.get("/api/stock-overview", handleStockOverview);
  app.get("/api/stock-data", handleStockData);
  app.get("/api/stock-insider-trades", handleStockInsiderTrades);
  app.get("/api/stock-earnings", handleStockEarnings);

  // Insights routes
  app.get("/api/insights/stocks", handleInsightsStocks);
  app.get("/api/insights/universes", handleInsightsUniverses);

  // Earnings calendar route
  app.get("/api/earnings/calendar", handleEarningsCalendar);

  // Chart history route
  app.get("/api/chart-history", handleChartHistory);

  return app;
}
