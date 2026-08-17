import { describe, expect, it } from "vitest";
import { chunkSymbols } from "./batchQuotes";

describe("chunkSymbols", () => {
  it("keeps requests at or below the route limit", () => {
    const symbols = Array.from({ length: 101 }, (_, i) => `S${i}`);
    const chunks = chunkSymbols(symbols);

    expect(chunks.map((chunk) => chunk.length)).toEqual([50, 50, 1]);
    expect(chunks.flat()).toEqual(symbols);
  });

  it("handles empty input and rejects invalid chunk sizes", () => {
    expect(chunkSymbols([])).toEqual([]);
    expect(() => chunkSymbols(["AAPL"], 0)).toThrow("positive integer");
    expect(() => chunkSymbols(["AAPL"], 1.5)).toThrow("positive integer");
  });
});
