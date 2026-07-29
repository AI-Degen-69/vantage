import { RequestHandler } from "express";

export const handleCompanyLogo: RequestHandler = async (req, res) => {
  try {
    const { ticker } = req.query;

    if (!ticker || typeof ticker !== "string") {
      return res.status(400).json({ error: "ticker parameter required" });
    }

    const token = process.env.LOGO_DEV_TOKEN;
    if (!token) {
      return res.status(503).json({ error: "Logo.dev token not configured (LOGO_DEV_TOKEN)" });
    }

    const url = `https://img.logo.dev/ticker/${ticker.toUpperCase()}?token=${token}&size=128&format=png`;

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to fetch logo" });
    }

    const buffer = await response.arrayBuffer();
    res.setHeader("Content-Type", "image/png");
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Error fetching company logo:", error);
    res.status(500).json({ error: "Failed to fetch logo" });
  }
};
