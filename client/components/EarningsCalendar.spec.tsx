import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/lib/i18n";
import { EarningsCalendar } from "./EarningsCalendar";

describe("EarningsCalendar", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const renderWithContext = (ui: React.ReactElement) =>
    renderToString(
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </I18nProvider>
      </QueryClientProvider>
    );

  it("renders header, data provenance banner, and grid events", () => {
    const html = renderWithContext(
      <EarningsCalendar from="2025-02-24" to="2025-02-28" />
    );

    expect(html).toContain("Upcoming Earnings Calendar &amp; Wall St. Consensus");
    expect(html).toContain("Financial Modeling Prep (FMP) &amp; Yahoo Finance Consensus");
    expect(html).toContain("NVDA");
    expect(html).toContain("SNOW");
  });

  it("renders weekly column view with Pre-Market and After-Hours separation", () => {
    const html = renderWithContext(
      <EarningsCalendar
        from="2025-02-24"
        to="2025-02-28"
        initialViewMode="calendar"
      />
    );

    expect(html).toContain("Pre-Market");
    expect(html).toContain("After-Hours");
    expect(html).toContain("Market Close");
  });
});
