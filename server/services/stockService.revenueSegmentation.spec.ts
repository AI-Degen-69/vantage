import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * End-to-end `getRevenueSegmentation` specs. The module captures
 * `process.env.FMP_KEY` at import time, so each test stubs the env FIRST and
 * then dynamically imports the module fresh (`vi.resetModules()` in
 * afterEach) — otherwise `hasFmp()` would be locked to whatever env the test
 * runner happened to have.
 */

function fakeResponse(body: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => JSON.parse(body),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("stockService.getRevenueSegmentation", () => {
  it("normalizes a healthy FMP payload and reports no rate-limit", async () => {
    vi.stubEnv("FMP_KEY", "test-key");
    const payload = [
      {
        date: "2025-09-27",
        symbol: "AAPL",
        fiscalYear: "2025",
        period: "FY",
        products: [{ name: "iPhone", revenue: 200e9 }],
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => fakeResponse(JSON.stringify(payload))),
    );

    const { stockService } = await import("./stockService");
    const out = await stockService.getRevenueSegmentation("AAPL");

    expect(out.rateLimited).toBe(false);
    expect(out.unavailable).toBe(false);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].products).toEqual([{ name: "iPhone", revenue: 200e9 }]);
  });

  it("flips rateLimited on an HTTP 429 (free-tier quota exhausted)", async () => {
    vi.stubEnv("FMP_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => fakeResponse("{}", false, 429)),
    );

    const { stockService } = await import("./stockService");
    const out = await stockService.getRevenueSegmentation("MSFT");

    expect(out.rateLimited).toBe(true);
    expect(out.rows).toEqual([]);
    expect(out.unavailable).toBe(false);
  });

  it("flips rateLimited on an HTTP 200 error body (FMP quota message)", async () => {
    vi.stubEnv("FMP_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fakeResponse(
          JSON.stringify({
            "Error Message":
              "Limit Reach. Please upgrade your plan or visit our documentation",
          }),
        ),
      ),
    );

    const { stockService } = await import("./stockService");
    const out = await stockService.getRevenueSegmentation("NVDA");

    expect(out.rateLimited).toBe(true);
    expect(out.rows).toEqual([]);
  });

  it("reports unavailable without ever hitting the network when no FMP key", async () => {
    vi.stubEnv("FMP_KEY", "");
    const fetchSpy = vi.fn(async () => fakeResponse("[]"));
    vi.stubGlobal("fetch", fetchSpy);

    const { stockService } = await import("./stockService");
    const out = await stockService.getRevenueSegmentation("AAPL");

    expect(out.unavailable).toBe(true);
    expect(out.rateLimited).toBe(false);
    expect(out.rows).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requests quarterly periods with the quarter row limit when period=quarter", async () => {
    vi.stubEnv("FMP_KEY", "test-key");
    const payload = [
      {
        date: "2025-06-28",
        symbol: "AAPL",
        fiscalYear: "2025",
        period: "Q3",
        products: [{ name: "iPhone", revenue: 45e9 }],
      },
      {
        date: "2025-03-29",
        symbol: "AAPL",
        fiscalYear: "2025",
        period: "Q2",
        products: [{ name: "iPhone", revenue: 42e9 }],
      },
    ];
    const fetchSpy = vi.fn(async (_input: unknown) =>
      fakeResponse(JSON.stringify(payload)),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { stockService } = await import("./stockService");
    const out = await stockService.getRevenueSegmentation("AAPL", "quarter");

    const url = String(fetchSpy.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("revenue-product-segmentation");
    expect(url).toContain("period=quarter");
    expect(url).toContain("limit=8");
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0].period).toBe("Q3");
    expect(out.rows[1].period).toBe("Q2");
  });

  it("keeps annual and quarterly payloads in separate cache slots", async () => {
    vi.stubEnv("FMP_KEY", "test-key");
    const annualPayload = [
      {
        date: "2025-09-27",
        symbol: "AAPL",
        fiscalYear: "2025",
        period: "FY",
        products: [{ name: "iPhone", revenue: 200e9 }],
      },
    ];
    const quarterlyPayload = [
      {
        date: "2025-06-28",
        symbol: "AAPL",
        fiscalYear: "2025",
        period: "Q3",
        products: [{ name: "iPhone", revenue: 45e9 }],
      },
    ];
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(JSON.stringify(annualPayload)))
      .mockResolvedValueOnce(fakeResponse(JSON.stringify(quarterlyPayload)));
    vi.stubGlobal("fetch", fetchSpy);

    const { stockService } = await import("./stockService");
    const annual = await stockService.getRevenueSegmentation("AAPL");
    const quarterly = await stockService.getRevenueSegmentation(
      "AAPL",
      "quarter",
    );
    // Second call must not read the annual slot from cache: it issues a
    // fresh quarterly request and returns quarterly rows.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(annual.rows[0].period).toBe("FY");
    expect(quarterly.rows[0].period).toBe("Q3");
  });
});
