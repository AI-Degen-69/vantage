// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import * as React from "react";
import { DCFWidget } from "./DCFWidget";
import { I18nProvider } from "@/lib/i18n";

function withI18n(node: React.ReactNode): React.ReactElement {
  return <I18nProvider>{node}</I18nProvider>;
}

describe("DCFWidget", () => {
  it("renders with title, mode switches, and input labels", () => {
    const html = renderToString(
      withI18n(<DCFWidget currentPrice={150} />)
    );

    expect(html).toMatch(/DCF Valuation|הערכת שווי DCF/);
    expect(html).toMatch(/Earnings Mode|מצב רווחים/);
    expect(html).toMatch(/Cash Flow Mode|מצב תזרים מזומנים/);
    expect(html).toMatch(/Forward return over 5 years|תשואה צפויה ל-5 שנים/);
    expect(html).toContain("150");
  });

  it("renders forward return calculation and target price based on currentPrice", () => {
    const html = renderToString(
      withI18n(<DCFWidget currentPrice={50} />)
    );

    expect(html).toContain("26.36");
    expect(html).toContain("80.07");
  });
});
