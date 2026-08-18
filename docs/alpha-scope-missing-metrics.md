# Alpha Scope → Vantage: Missing Metrics Gap Analysis

Reference for the metrics Alpha Scope surfaces that Vantage does not (or has the data for but never renders). Provider calls are Alpha Scope's own proxy routes / FMP endpoints, extracted from their live site + JS bundle.

Legend:

- **Alpha Scope** URL for a company metric: `https://alphascope.trade/dashboard/company/<ticker>`
- **Vantage** URL for the same surface: `http://localhost:3000/stock/<ticker>` (company page = `client/pages/Index.tsx`)
- "FMP" = Financial Modeling Prep. Alpha Scope's only data provider (plus OpenAI for AI text).
- **FMP plan tiers** (from `site.financialmodelingprep.com/pricing-plans`, "Compare individual Use Plans"): **Basic** = free, **Starter**, **Premium**, **Ultimate**. The letters `L / A / D / P` shown in FMP's Basic column are *limitation codes*, not plan names: `L` = max N responses per call, `A` = annual-period only, `D` = history capped to N month(s)/year(s), `P` = pagination capped.
- **Implemented?** = whether Vantage already ships the feature today (✅) or it is still a gap (❌).

---

## A. Already in Vantage's data layer — just never surfaced

These need **UI work only**; the field is already fetched by an existing Vantage route.

| Metric | Provider & call (Alpha Scope) | FMP plan (free vs premium) | Where in Alpha Scope | Suggested location in Vantage | Implemented? |
|---|---|---|---|---|---|
| Company website | FMP `/stable/profile` → `website` (server-rendered) | ✅ **Free (Basic)** — US symbols only | Company page → "Latest Insights" block, under Market Cap — `https://alphascope.trade/dashboard/company/AAPL` | `client/components/CompanyProfile.tsx` id-chips row (beside exchange/CIK/ISIN). Field already mapped in `server/services/stockService.ts` (`website`), just unused client-side — `http://localhost:3000/stock/MSFT` | ❌ No — field fetched, not surfaced |
| Net Debt | FMP `balance-sheet-statement` → `netDebt` (server-rendered) | ✅ **Free (Basic)** — max 5 responses/call (`L`) | Company page → "Statistics (TTM)" → Financial Health — `https://alphascope.trade/dashboard/company/AAPL` | `client/components/StockFundamentalsStrip.tsx` → "Balance" group (next to Cash / Debt). Field already on `BalanceSheetRow.netDebt` (`stockService.ts`) — `http://localhost:3000/stock/MSFT` | ❌ No — field fetched, not surfaced |
| Dividend payout frequency | Derived from FMP `/stable/dividends` dates ("Quarterly" = 4 payments/yr) | ✅ **Free (Basic)** — max 5 responses/call (`L`) | Company page → "Statistics (TTM)" → Dividend — `https://alphascope.trade/dashboard/company/AAPL` | `client/components/StockFundamentalsStrip.tsx` → "Dividend" group (beside the existing "Payout Date" stub). Dividends already pulled via the aggregator — `http://localhost:3000/stock/MSFT` | ❌ No — field fetched, not surfaced |

---

## B. Missing data — needs new FMP fields or endpoints

| Metric | Provider & call (Alpha Scope) | FMP plan (free vs premium) | Where in Alpha Scope | Suggested location in Vantage | Implemented? |
|---|---|---|---|---|---|
| Price to Cash Flow (P/CF) | FMP `ratios-ttm` → `priceToCashFlowRatioTTM` (server-rendered) | ✅ **Free (Basic)** — ~87 symbols only (AAPL, TSLA, AMZN + 84) | Company page → "Statistics (TTM)" → Revenue & Cash Flow Metrics — `https://alphascope.trade/dashboard/company/AAPL` | `client/components/StockFundamentalsStrip.tsx` → "Valuation" group. Add field to `RatiosTTM` in `shared/api.ts` + map in `stockService.ts` — `http://localhost:3000/stock/MSFT` | ❌ No |
| Price to Free Cash Flow (P/FCF) | FMP `ratios-ttm` → `priceToFreeCashFlowRatioTTM` (server-rendered) | ✅ **Free (Basic)** — ~87 symbols only | Company page → "Statistics (TTM)" → Revenue & Cash Flow Metrics — `https://alphascope.trade/dashboard/company/AAPL` | `StockFundamentalsStrip.tsx` → "Valuation" or "Cash Flow" group. Add to `RatiosTTM` + `stockService.ts` — `http://localhost:3000/stock/MSFT` | ❌ No |
| Return on Invested Capital (ROIC) | FMP `key-metrics-ttm` → `roicTTM` (server-rendered) | ✅ **Free (Basic)** — ~87 symbols only | Company page → "Statistics (TTM)" → Profitability — `https://alphascope.trade/dashboard/company/AAPL` | `StockFundamentalsStrip.tsx` → "Margins & Growth" group. Add to `KeyMetricsTTM` (Vantage already has ROE/ROA, not ROIC) + `stockService.ts` — `http://localhost:3000/stock/MSFT` | ❌ No |
| Revenue by segment | FMP `revenue-product-segmentation` (Alpha Scope proxy: `/api/fmp/revenue-product-segmentation`, POST `{symbol, limit, period}`) | ✅ **Free (Basic)** — max 10 responses/call (`L`), annual-period only (`A`) | Company page → Charts section, "Revenue by Segment" card — `https://alphascope.trade/dashboard/company/AAPL` | New chart card in `client/pages/Index.tsx` charts grid + new `/api` route in `server/index.ts` — `http://localhost:3000/stock/MSFT` | ❌ No |
| P/E and P/S charted over time | FMP `/stable/ratios` (period = quarter/annual + limit). Alpha Scope proxy: `/api/fmp/ratios` | ✅ **Free (Basic)** — max 5 responses/call (`L`), annual-period only (`A`) | Company page → Charts section, "Price to Earnings Ratio" and "Price to Sales Ratio" cards — `https://alphascope.trade/dashboard/company/AAPL` | New historical-ratio chart cards in `Index.tsx` charts grid + extend `ChartModal`. Vantage currently fetches TTM ratios only (`/api/stock-metrics`) — `http://localhost:3000/stock/MSFT` | ❌ No |
| Peers / comparables table | FMP `/stable/stock-peers` (peer symbols) → per-peer quote + metrics (server-rendered) | ✅ **Free (Basic)** — full access, no limit | Company page → "Peers Similar to …" table (Market Cap, Revenue, Net Income, FCF, P/E, Fwd P/EG, P/B, P/S) — `https://alphascope.trade/dashboard/company/AAPL` | New section below `CompanyProfile.tsx` in `Index.tsx`, backed by a new `/api/stock-peers` route + existing batch-quote/metrics hooks — `http://localhost:3000/stock/MSFT` | ❌ No |
| Trending browse | FMP market-movers: `/stable/biggest-gainers`, `/stable/biggest-losers`, `/stable/most-actives` (server-rendered, no client route) | ✅ **Free (Basic)** — full access, no limit | Dashboard home → "Trending" tab — `https://alphascope.trade/dashboard?category=trending` | `client/pages/Insights.tsx` "Trending" filter. Done via `stockService.getTrendingUniverse()` + `fetchTrendingMovers()` (`server/services/stockService.ts`), with the curated list as fallback — `http://localhost:3000/insights` | ✅ Yes — live movers wired, curated fallback |

---

## C. Missing data — needs a new provider (OpenAI, not FMP)

| Metric | Provider & call (Alpha Scope) | FMP plan (free vs premium) | Where in Alpha Scope | Suggested location in Vantage | Implemented? |
|---|---|---|---|---|---|
| Positive Catalysts | OpenAI (`/api/openai/positives`, POST `{symbol}`) → `output_text` → `{positiveCatalysts:[{catalyst, details}]}` | ⚠️ **Not FMP** — OpenAI API (separate key, pay-per-token; free tier = limited trial credits) | Company page → "More Information" → "Positive Catalysts" + "Generate AI Summary" button — `https://alphascope.trade/dashboard/company/AAPL` | New panel in `client/pages/Index.tsx` near `CompanyProfile.tsx`, behind a new `/api/openai/positives` route. Vantage has no LLM provider yet — needs a key + provider-health wiring — `http://localhost:3000/stock/MSFT` | ❌ No |
| Risks | OpenAI (`/api/openai/risks`, POST `{symbol}`) → `output_text` → `{risks:[{risk, details}]}` | ⚠️ **Not FMP** — OpenAI API (separate key, pay-per-token) | Company page → "More Information" → "Risks" + "Generate AI Summary" button — `https://alphascope.trade/dashboard/company/AAPL` | New panel beside Catalysts in `Index.tsx`, behind a new `/api/openai/risks` route — `http://localhost:3000/stock/MSFT` | ❌ No |

---

## Notes

- **Every FMP endpoint Alpha Scope uses is on the free (Basic) plan.** Verified against FMP's "Compare individual Use Plans" matrix: `profile`, `balance-sheet-statement`, `dividends`, `ratios-ttm`, `key-metrics-ttm`, `revenue-product-segmentation`, `ratios`, `stock-peers`, and the market-movers all show **Full** or **Limited** coverage in the Basic column — none are gated behind Starter/Premium/Ultimate. The "premium" aspects are only *depth limits* (response caps, ~87-ticker symbol whitelist, annual-only periods), not hard paywalls.
- **The only true premium dependency is OpenAI** (Catalysts/Risks): a separate billed provider, unrelated to FMP's plan tiers.
- **Trending was previously mislabeled as "needs a higher FMP tier"** — that's wrong. The movers endpoints are free; Vantage's 404s come from calling the old `/stable/gainers` and `/actives` paths, which FMP renamed to `/stable/biggest-gainers`, `/stable/biggest-losers`, and `/stable/most-actives`. Fix the paths, not the plan.
- **Everything Alpha Scope shows is FMP + OpenAI.** Logos and news thumbnails come from `images.financialmodelingprep.com`; financials/ratios/peers/segment data all route through its own `/api/fmp/*` proxy routes (see the client bundle) or are server-rendered from FMP.
- **Vantage already has the FMP plumbing** (`stockService.ts` normalizes profile/statements/ratios/metrics/dividends), so items in section A are near-free and most of section B are additive field/route work, not a new integration.
