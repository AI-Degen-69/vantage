import { RequestHandler } from "express";

const LOGO_DEV_PUBLIC_KEY = process.env.LOGO_DEV_TOKEN || "";

export const handleCompanyLogo: RequestHandler = async (req, res) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const ticker = String(req.query.ticker || "");
    if (!ticker) return res.status(400).json({ error: "ticker parameter required" });
    if (!LOGO_DEV_PUBLIC_KEY) {
      return res.status(503).json({ error: "LOGO_DEV_TOKEN not configured on server" });
    }

    const url = `https://img.logo.dev/ticker/${encodeURIComponent(ticker.toUpperCase())}?token=${LOGO_DEV_PUBLIC_KEY}`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      // Logo.dev returns 404 for unknown tickers — surface status as 200 + empty body so the
      // client's <TickerLogo> can fall back to initials without an error.
      res.setHeader("Content-Type", "application/json");
      return res.status(200).json({ error: `logo not found: ${response.status}` });
    }

    const buffer = await response.arrayBuffer();
    res.setHeader("Content-Type", response.headers.get("content-type") || "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400"); // cache logo 24h
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    if (error?.name === "AbortError") {
      console.error("Logo fetch timeout:", error);
      return res.status(504).json({ error: "Upstream logo request timed out" });
    }
    console.error("Error fetching company logo:", error);
    res.status(500).json({ error: "Failed to fetch logo" });
  } finally {
    clearTimeout(timeoutId);
  }
};
