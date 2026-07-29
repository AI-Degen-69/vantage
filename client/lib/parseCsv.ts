/**
 * Pure parser for pasted ticker lists. Handles the most common shapes
 * users paste into a "bootstrap my watchlist" textarea:
 *   - `AAPL, MSFT, GOOGL`              comma-separated
 *   - `AAPL\nMSFT\nGOOGL`              newline-separated
 *   - `AAPL\tMSFT\tGOOGL`              tab-separated
 *   - `AAPL; MSFT; GOOGL`              semicolon-separated
 *   - `"AAPL", "MSFT", "GOOGL"`        quoted (CSV-style, with stray whitespace)
 *   - `   `AAPL``,` MSFT ''`           mixed quotes/whitespace
 *   - `AAPL MSFT GOOGL`                whitespace within line
 *
 * Output is a deduplicated, uppercase array of strings that match the
 * ticker's strict regex (1-5 uppercase letters + optional .X share-class
 * suffix). Invalid entries are NOT silently dropped — they are returned
 * alongside the valid ones so the caller can render an honest count:
 * "32 valid, 1 invalid — \"appl inc\"" instead of dropping user input.
 */

import { isValidTickerFormat } from "./watchlistStore";

export interface ParseTickersResult {
  /** Deduplicated uppercase tickers matching the format regex. */
  valid: string[];
  /** Original raw strings the caller pasted but didn't pass the format check. */
  invalid: string[];
  /** Total raw tokens before dedupe. Useful for a "X of Y" progress hint. */
  total: number;
}

/**
 * Parse a pasted string into tickers. Returns both valid (deduped) and
 * invalid entries — callers surface both counts to the user so they
 * understand WHY their paste got truncated.
 */
export function parseTickers(input: string): ParseTickersResult {
  if (typeof input !== "string" || input.length === 0) {
    return { valid: [], invalid: [], total: 0 };
  }

  // Split on every non-alphanumeric, non-dot, non-minus, non-quote character.
  // Quotes are kept out of the split tokens so `"AAPL"` becomes `AAPL`.
  // We also strip leading/trailing whitespace per token.
  const rawTokens = input
    .split(/[^A-Za-z0-9.\-'"`]+/)
    .map((tok) => tok.replace(/^["'`]+|["'`]+$/g, "").trim())
    .filter(Boolean);

  const total = rawTokens.length;
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const tok of rawTokens) {
    const upper = tok.toUpperCase();
    if (!isValidTickerFormat(upper)) {
      invalid.push(tok);
      continue;
    }
    if (seen.has(upper)) continue;
    seen.add(upper);
    valid.push(upper);
  }

  return { valid, invalid, total };
}
