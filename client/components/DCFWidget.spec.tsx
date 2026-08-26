// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import * as React from "react";
import { MemoryRouter } from "react-router-dom";
import { DCFWidget } from "./DCFWidget";
import { I18nProvider } from "@/lib/i18n";

function withContext(node: React.ReactNode): React.ReactElement {
  return (
    <I18nProvider>
      <MemoryRouter>{node}</MemoryRouter>
    </I18nProvider>
  );
}

describe("DCFWidget", () => {
  it("renders sandbox eyebrow, title, sliders, and fair value summary card", () => {
    const html = renderToString(
      withContext(<DCFWidget ticker="AAPL" currentPrice={231.42} />)
    );

    expect(html).toContain("INTERACTIVE VALUATION ENGINE");
    expect(html).toContain("Instant Discounted Cash Flow Sandbox");
    expect(html).toContain("Base FCF ($B)");
    expect(html).toContain("Expected 5Y Growth Rate (%)");
    expect(html).toContain("Terminal Exit Multiple (P/FCF)");
    expect(html).toContain("Target Discount Rate (%)");
    expect(html).toContain("ESTIMATED FAIR VALUE");
    expect(html).toContain("231.42");
  });

  it("renders correctly with custom assumptions and computes intrinsic fair value", () => {
    const html = renderToString(
      withContext(
        <DCFWidget
          ticker="MSFT"
          currentPrice={400.0}
          initialFcf={80.0}
          initialGrowth={12.0}
          initialMultiple={30.0}
        />
      )
    );

    expect(html).toContain("MSFT");
    expect(html).toContain("400.00");
    expect(html).toContain("ESTIMATED FAIR VALUE");
  });
});
