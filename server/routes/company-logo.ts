import { RequestHandler } from "express";

const LOGO_DEV_PUBLIC_KEY = "pk_CyCNK430RpK33Qe6o3xFlw";

export const handleCompanyLogo: RequestHandler = async (req, res) => {
  try {
    const { ticker } = req.query;

    if (!ticker || typeof ticker !== "string") {
      return res.status(400).json({ error: "ticker parameter required" });
    }

    const url = `https://img.logo.dev/ticker/${ticker.toUpperCase()}?token=${LOGO_DEV_PUBLIC_KEY}`;

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
