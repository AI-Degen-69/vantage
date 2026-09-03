import { describe, expect, it } from "vitest";
import { enDict, heDict, getDictionaryForLang } from "../i18n";
import * as dictionaries from "./dictionaries";

/**
 * Pins the iteration-2 extraction contract: the en/he string dictionaries
 * live in client/lib/i18n/dictionaries.ts, and client/lib/i18n.tsx re-exports
 * the exact same objects so its public API (and all 39 importers) stay stable.
 */
describe("i18n dictionary extraction parity", () => {
  it("i18n.tsx re-exports the extracted dictionaries (same references)", () => {
    expect(enDict).toBe(dictionaries.enDict);
    expect(heDict).toBe(dictionaries.heDict);
  });

  it("getDictionaryForLang serves the extracted dictionaries", () => {
    expect(getDictionaryForLang("en")).toBe(dictionaries.enDict);
    expect(getDictionaryForLang("he")).toBe(dictionaries.heDict);
    // Unknown languages fall back to the English dictionary.
    expect(getDictionaryForLang("de")).toBe(dictionaries.enDict);
  });

  it("extracted dictionaries are string-only records with full key sets", () => {
    for (const dict of [dictionaries.enDict, dictionaries.heDict]) {
      expect(Object.keys(dict).length).toBeGreaterThan(500);
      for (const [key, value] of Object.entries(dict)) {
        expect(typeof key).toBe("string");
        expect(typeof value).toBe("string");
      }
    }
  });

  it("every hebrew key is in en or belongs to an en plural family", () => {
    // en carries _one/_other plural families; he adds _two (Hebrew dual) —
    // 10 such keys today (timeAgo.*, insights.*). Those bases have no bare
    // key in en, but must have at least one suffixed variant there, or the
    // he entry translates a concept en cannot render.
    const suffixes = ["_one", "_two", "_few", "_many", "_other"];
    const enKeys = new Set(Object.keys(dictionaries.enDict));
    const orphanKeys: string[] = [];
    for (const key of Object.keys(dictionaries.heDict)) {
      if (enKeys.has(key)) continue;
      const base = suffixes.reduce(
        (k, s) => (k.endsWith(s) ? k.slice(0, -s.length) : k),
        key,
      );
      const hasEnFamily = suffixes.some((s) => enKeys.has(`${base}${s}`));
      if (!hasEnFamily) orphanKeys.push(key);
    }
    expect(orphanKeys).toEqual([]);
  });
});
