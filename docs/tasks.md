# Vantage — Task Tracker

## Research alternative approaches

1. **Trending Browse** — **Status:** live FMP market-movers are wired in (`server/services/stockService.ts` → `getTrendingUniverse()` + `fetchTrendingMovers()`), with the 12-ticker curated list (`insightsUniverses.ts`) as the fallback; the Trending filter now ranks by |% move| in `client/pages/Insights.tsx`. **Endpoint:** FMP `/stable/biggest-gainers` + `/stable/biggest-losers` + `/stable/most-actives`. **Calls:** 3 parallel FMP requests per 60s server-side cache window (one per endpoint), coalesced through an in-flight registry — i.e. worst case 3 calls/minute when the page is actively refreshed. All three are on the **free (Basic)** plan; right now they return HTTP 429 "Limit Reach" because the 250 calls/day quota is exhausted, not a premium gate (verified: free endpoints `quote`/`profile` return the same 429).

---

## Next up — two features to implement (chosen)

Still open (from `docs/alpha-scope-missing-metrics.md`): website, net debt, payout frequency, P/CF, P/FCF, ROIC, revenue-by-segment, P/E·P/S history, peers table, catalysts, risks.

Chosen next two (both add **zero new FMP requests** — important while the 250/day quota is rate-limiting):

### 1. Surface already-fetched fields: company website + Net Debt — ✅ done
Pure client work — both fields are already normalized and reachable from existing hooks, they are just never rendered.

- **Company website** — `client/components/CompanyProfile.tsx`: in the id-chips row, render a clickable "Website" chip from `overviewData?.website` (`CompanyProfile.website`, already mapped in `stockService.normalizeProfile`). Wrap as `<a href target="_blank" rel="noopener noreferrer">` and only render when present.
- **Net Debt** — `client/components/StockFundamentalsStrip.tsx`: add a `MetricRow` in the "Balance" group with `value={formatMoney(balance?.netDebt)}` and `source` from `balanceSource`. `BalanceSheetRow.netDebt` already exists and `normalizeBalanceRow` already maps it. Keep it provider-reported only (the component's stated contract) — no `totalDebt − cash` fallback for now.

### 2. Add P/CF, P/FCF, ROIC (TTM) ratios
FMP already fetches `key-metrics-ttm` + `ratios-ttm` in `stockService.getMetrics()` and casts the raw records straight into the shared types — so adding fields to the types makes them flow through with **no server logic change**.

- `shared/api.ts`: add `priceToCashFlowRatioTTM?` and `priceToFreeCashFlowRatioTTM?` to `RatiosTTM`; add `roicTTM?` to `KeyMetricsTTM` (FMP's exact field names).
- `server/services/stockService.ts`: no change required — verify the `(r0 || {}) as RatiosTTM` / `(m0 || {}) as KeyMetricsTTM` casts carry the new fields (they will). Yahoo's metrics modules don't expose these, so they show "Unavailable" unless the FMP source is live.
- `client/components/StockFundamentalsStrip.tsx`: add "P/CF" and "P/FCF" rows to the "Cash Flow" group (`metrics.ratios.priceToCashFlowRatioTTM` / `priceToFreeCashFlowRatioTTM`, `formatNumber`) and "ROIC" to "Margins & Growth" (`metrics.metrics.roicTTM`, `formatPercent`).
- Verify: `pnpm exec tsc --noEmit`.

**Deferred:** payout frequency needs a small server derivation (dividend payment dates are not exposed to the client yet), so it is not bundled into #1.
