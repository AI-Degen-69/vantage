// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import * as React from "react";
import { MemoryRouter } from "react-router-dom";
import { DCFWidget } from "./DCFWidget";
import { I18nProvider } from "@/lib/i18n";
import { enDict, heDict } from "@/lib/i18n/dictionaries";
import { TooltipProvider } from "@/components/ui/tooltip";

function withContext(
  node: React.ReactNode,
  initialLang?: "en" | "he",
): React.ReactElement {
  return (
    <I18nProvider initialLang={initialLang}>
      <TooltipProvider>
        <MemoryRouter>{node}</MemoryRouter>
      </TooltipProvider>
    </I18nProvider>
  );
}

// Issue #75: native range tracks mirror automatically in RTL (min on the
// right), so the painted fill must flip to `to left` in Hebrew and stay
// `to right` in English.
describe("RTL slider fill (issue #75)", () => {
  it("paints DCFWidget slider fills growing from the min side in Hebrew", () => {
    const html = renderToString(
      withContext(
        <DCFWidget ticker="AAPL" currentPrice={231.42} />,
        "he",
      ),
    );

    expect(html).toContain("linear-gradient(to left");
    expect(html).not.toContain("linear-gradient(to right");
  });

  it("keeps DCFWidget slider fills LTR in English", () => {
    const html = renderToString(
      withContext(<DCFWidget ticker="AAPL" currentPrice={231.42} />, "en"),
    );

    expect(html).toContain("linear-gradient(to right");
    expect(html).not.toContain("linear-gradient(to left");
  });
});

// Issue #75: Index 52W corridor axis labels must resolve in both languages.
describe("corridor i18n keys (issue #75)", () => {
  const keys = [
    "index.corridor52w",
    "index.corridorLow",
    "index.corridorCurrent",
    "index.corridorHigh",
    "index.pctOfRange",
  ] as const;

  it("defines every corridor key in English and Hebrew", () => {
    for (const key of keys) {
      expect(enDict[key], `missing EN key ${key}`).toBeTruthy();
      expect(heDict[key], `missing HE key ${key}`).toBeTruthy();
    }
  });

  it("carries the {{pct}} interpolation slot in both languages", () => {
    expect(enDict["index.pctOfRange"]).toContain("{{pct}}");
    expect(heDict["index.pctOfRange"]).toContain("{{pct}}");
  });
});
