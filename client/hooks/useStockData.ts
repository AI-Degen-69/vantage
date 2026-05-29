import { useEffect, useState } from "react";

export interface StockQuote {
  symbol: string;
  price: number | string;
  change: number | string;
  changePercent: number | string;
}

export interface StockTimeSeries {
  quarters: Array<{ date: string; close: number }>;
}

export interface StockOverview {
  [key: string]: string | number;
}

export function useStockQuote(ticker: string) {
  const [data, setData] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/stock-quote?symbol=${ticker}`);
        if (!response.ok) {
          throw new Error("Unavailable via API");
        }
        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error fetching data");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    if (ticker) {
      fetchQuote();
    }
  }, [ticker]);

  return { data, loading, error };
}

export function useStockTimeSeries(ticker: string) {
  const [data, setData] = useState<StockTimeSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimeSeries = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/stock-time-series?symbol=${ticker}`);
        if (!response.ok) {
          throw new Error("Unavailable via API");
        }
        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error fetching data");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    if (ticker) {
      fetchTimeSeries();
    }
  }, [ticker]);

  return { data, loading, error };
}

export function useStockOverview(ticker: string) {
  const [data, setData] = useState<StockOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/stock-overview?symbol=${ticker}`);
        if (!response.ok) {
          throw new Error("Unavailable via API");
        }
        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error fetching data");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    if (ticker) {
      fetchOverview();
    }
  }, [ticker]);

  return { data, loading, error };
}
