/**
 * Split a list of symbols into API-safe request batches.
 * The batch quote route accepts at most 50 symbols per request.
 */
export function chunkSymbols(symbols: string[], chunkSize = 50): string[][] {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error("chunkSize must be a positive integer");
  }

  const chunks: string[][] = [];
  for (let start = 0; start < symbols.length; start += chunkSize) {
    chunks.push(symbols.slice(start, start + chunkSize));
  }
  return chunks;
}
