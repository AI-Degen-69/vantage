import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleCompanyLogo } from "./routes/company-logo";
import {
  handleStockQuote,
  handleBatchQuotes,
  handleStockFinancials,
  handleStockMetrics,
  handleStockAnalyst,
  handleStockInsider,
  handleStockNews,
  handleEarningsCalendar,
  handleStockChart,
  handleStockOverview,
  handleIndexQuotes,
  handleInsightsTab,
  handleSmaDistances,
  handleFxRates,
} from "./routes/stock-data";

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
  app.get("/api/stock-quote", handleStockQuote);
  app.get("/api/stock-batch-quotes", handleBatchQuotes);
  app.get("/api/stock-overview", handleStockOverview);
  app.get("/api/stock-financials", handleStockFinancials);
  app.get("/api/stock-metrics", handleStockMetrics);
  app.get("/api/stock-analyst", handleStockAnalyst);
  app.get("/api/stock-insider", handleStockInsider);
  app.get("/api/stock-news", handleStockNews);
  app.get("/api/earnings-calendar", handleEarningsCalendar);
  app.get("/api/stock-chart", handleStockChart);
  app.get("/api/index-quotes", handleIndexQuotes);
  app.get("/api/insights-tab", handleInsightsTab);
  app.get("/api/sma-distances", handleSmaDistances);
  app.get("/api/fx-rates", handleFxRates);

  return app;
}
