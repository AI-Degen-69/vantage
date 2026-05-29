import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleCompanyLogo } from "./routes/company-logo";
import { handleStockQuote, handleStockTimeSeries, handleStockOverview } from "./routes/stock-data";

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
  app.get("/api/stock-time-series", handleStockTimeSeries);
  app.get("/api/stock-overview", handleStockOverview);

  return app;
}
