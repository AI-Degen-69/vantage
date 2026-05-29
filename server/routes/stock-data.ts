import { RequestHandler } from "express";

const ALPHA_VANTAGE_KEY = "6Z3JK0TRPU5IBJ8L";
const BASE_URL = "https://www.alphavantage.co/query";

interface StockQuote {
  symbol: string;
  price: number | string;
  change: number | string;
  changePercent: number | string;
}

export const handleStockQuote: RequestHandler = async (req, res) => {
  try {
    const { symbol } = req.query;

    if (!symbol || typeof symbol !== "string") {
      return res.status(400).json({ error: "symbol parameter required" });
    }

    const url = `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol.toUpperCase()}&apikey=${ALPHA_VANTAGE_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data["Global Quote"] || Object.keys(data["Global Quote"]).length === 0) {
      return res.status(404).json({ error: "Unavailable via API" });
    }

    const quote = data["Global Quote"];

    const result: StockQuote = {
      symbol: quote["01. symbol"] || "Unavailable via API",
      price: quote["05. price"] || "Unavailable via API",
      change: quote["09. change"] || "Unavailable via API",
      changePercent: quote["10. change percent"]?.replace("%", "") || "Unavailable via API",
    };

    res.json(result);
  } catch (error) {
    console.error("Error fetching stock quote:", error);
    res.status(500).json({ error: "Failed to fetch stock quote" });
  }
};

export const handleStockTimeSeries: RequestHandler = async (req, res) => {
  try {
    const { symbol } = req.query;

    if (!symbol || typeof symbol !== "string") {
      return res.status(400).json({ error: "symbol parameter required" });
    }

    const url = `${BASE_URL}?function=TIME_SERIES_QUARTERLY&symbol=${symbol.toUpperCase()}&apikey=${ALPHA_VANTAGE_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data["Quarterly Time Series"]) {
      return res.status(404).json({ error: "Unavailable via API" });
    }

    const timeSeries = data["Quarterly Time Series"];
    const quarters = Object.entries(timeSeries)
      .slice(0, 20)
      .map(([date, values]: [string, any]) => ({
        date,
        close: parseFloat(values["4. close"]) || 0,
      }))
      .reverse();

    res.json({ quarters });
  } catch (error) {
    console.error("Error fetching time series:", error);
    res.status(500).json({ error: "Failed to fetch time series" });
  }
};

export const handleStockOverview: RequestHandler = async (req, res) => {
  try {
    const { symbol } = req.query;

    if (!symbol || typeof symbol !== "string") {
      return res.status(400).json({ error: "symbol parameter required" });
    }

    const url = `${BASE_URL}?function=OVERVIEW&symbol=${symbol.toUpperCase()}&apikey=${ALPHA_VANTAGE_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data["Symbol"]) {
      return res.status(404).json({ error: "Unavailable via API" });
    }

    res.json(data);
  } catch (error) {
    console.error("Error fetching overview:", error);
    res.status(500).json({ error: "Failed to fetch overview" });
  }
};
