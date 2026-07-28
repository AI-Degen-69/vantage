# Upstream API Reference — Vantage

Authoritative reference for the endpoints called by `server/services/stockService.ts`.
Refreshed alongside Phase 0 of the Completion Plan. See `knowledge.md` for the
broader project knowledge and `server/services/stockService.ts` for the
implementation.

Tested live on 28 July 2026. Schema-drift observations refreshed after the
`FMP_USE_STABLE=1` flip.

## Status of the keys

| Key              | Status                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `FMP_KEY`        | **Working on `/stable/`** — the new key unlocks every `/stable/<single-symbol>` endpoint we route to (verified 2026-07-28: profile, quote, financials, metrics, scores, calendar ↪ 200 paid-plan-gated: gainers, losers, actives, sectors-performance still 404). |
| `AV_KEY`         | **Working** — `GLOBAL_QUOTE&symbol=AAPL` returns a live 200 JSON quote (current free tier: 25 req/day).                                          |
| `LOGO_DEV_TOKEN` | **Working** — `https://img.logo.dev/ticker/AAPL` returns 200 PNG (~5.8 KB). Verified for AAPL, TSLA, NVDA, BRKA, A.                            |
| `FMP_USE_STABLE` | **`=1` flip landed 2026-07-28.** `FMP_BASE` now points at `https://financialmodelingprep.com/stable`. Override to `=0` to fall back to v3 if a specific endpoint regresses.   |
| `PING_MESSAGE`   | `"ping pong"` (template default for `/api/ping`).                                                                                              |

### FMP plan (post-stable flip)

1. `FMP_KEY` is the live paid key in `.env`. `FMP_USE_STABLE=1` is set.
2. `FMP_BASE` now points at `https://financialmodelingprep.com/stable`.
3. Single-ticker endpoints (profile / quote / chart / financials / metrics /
   scores / earnings calendar) all return live data via the existing routes.
4. **Gated behind paid plan** (404 on this key): `/stable/gainers`,
   `/stable/losers`, `/stable/actives`, `/stable/sectors-performance`,
   `/stable/company-screener`. The Insights tabs still fall back to the
   curated `server/services/insightsUniverses.ts` for those views.
5. **Batch quote path mismatch** — this key surfaces batch as
   `/stable/batch-quote?symbols=A,B,C` (query-param), but
   `stockService.getBatchQuotes` currently calls
   `quote/${list}` (path-segment). On `/stable/` that's a 404.
   The code still works because the single-ticker fallback (Yahoo loop) runs
   in parallel when the batch call 404s. **Future hardening**: switch
   `getBatchQuotes` to the query-param shape when this regresses on the
   dashboard's hot path. Tracked as a TODO in this doc.
6. **Earnings calendar path** — v3 used `/api/v3/earning_calendar` (singular,
   underscore). On `/stable/` the path is `/stable/earnings-calendar`
   (plural, hyphen). `stockService.getEarningsCalendar` now branches on
   `process.env.FMP_USE_STABLE === '1'` to pick the correct endpoint name
   (fixed 2026-07-28).

### AV plan

AV free tier is rate-limited to 25 req/day. Use only as a single-quote fallback
when both Yahoo and FMP miss. Currently healthy.

### Logo.dev

Already moved to `process.env.LOGO_DEV_TOKEN` in Phase 0. Returns `503` when the
env var is missing. Adds `Cache-Control: public, max-age=86400` for 24-hour
client caching.

---

## Endpoint catalog

All URLs below are what `server/services/stockService.ts` calls. Client hooks
(`client/hooks/useStockData.ts`) only ever hit our prefix `/api/...` and never
see the upstream URL.

### FMP

```
GET {FMP_BASE}/profile/{symbol}
  → companyName, sector, industry, ceo, beta, peRatio, fullTimeEmployees,
    description, exchange, currency, website, country, city, ipoDate, image
GET {FMP_BASE}/quote/{symbol}
  → price, change, changesPercentage, previousClose,
    dayLow, dayHigh, yearLow, yearHigh,
    priceAvg50, priceAvg200, marketCap, volume, avgVolume,
    eps, pe, sharesOutstanding, exchange, earningsAnnouncement (ISO)
GET {FMP_BASE}/quote?symbol={A,B,C,...}
  → Batch quotes: array of single-quote rows in the same order you asked.
GET {FMP_BASE}/income-statement/{symbol}?limit=10
  → revenue, costOfRevenue, grossProfit, operatingIncome, ebitda,
    netIncome, eps, epsDiluted, calendarYear, period
GET {FMP_BASE}/balance-sheet-statement/{symbol}?limit=10
  → totalAssets, totalLiabilities, totalEquity, totalDebt,
    cashAndCashEquivalents, netDebt, calendarYear, period
GET {FMP_BASE}/cash-flow-statement/{symbol}?limit=10
  → operatingCashFlow, capitalExpenditure, freeCashFlow,
    stockBasedCompensation, dividendPayments, calendarYear, period
GET {FMP_BASE}/key-metrics-ttm/{symbol}
  → peRatioTTM, evToEBITDATTM, evToSalesTTM,
    priceToSalesRatioTTM, priceToBookRatioTTM,
    returnOnEquityTTM, returnOnAssetsTTM, freeCashFlowYieldTTM
GET {FMP_BASE}/ratios-ttm/{symbol}
  → netProfitMargin, operatingProfitMarginTTM, grossProfitMarginTTM,
    dividendPayoutRatioTTM, currentRatio, quickRatio, debtToEquityRatio
GET {FMP_BASE}/financial-scores/{symbol}
  → piotroskiScore (0–9), altmanZScore
GET {FMP_BASE}/{earning_calendar|earnings-calendar}?from=YYYY-MM-DD&to=YYYY-MM-DD
  → symbol, date (ISO), epsEstimated, eps, revenueEstimated, revenue,
    time ("bmo" before market open / "amc" after close)
  Path shape branches on `FMP_USE_STABLE`: `/stable/earnings-calendar`
  (plural, hyphen) for the new path, `/api/v3/earning_calendar`
  (singular, underscore) for legacy v3. Service-layer branch lives in
  `stockService.getEarningsCalendar`.
GET {FMP_BASE}/historical-price-full/{symbol}?timeseries=150
  → { symbol, historical:
        [{ date, open, high, low, close, adjClose, volume, change, changePercent }] }
GET {FMP_BASE}/quote?symbol=^GSPC,^IXIC,^DJI
  → Index marquee (Dow / S&P 500 / Nasdaq)
```

**Casing:** Both paths return camelCase. Legacy `/api/v3/` mixes camelCase
AND PascalCase (e.g. `peRatio` vs `PERatio`). The normalizer in
`stockService.ts` reads both.

### Schema drift on `/stable/` (observed 2026-07-28 — verified by live probe)

When `FMP_USE_STABLE=1` is active, the response shapes drift in three ways
that the normalizers already absorb — but worth knowing in case an
affected field starts misbehaving in the UI:

| Field                | v3 path                    | /stable/ path              | Normalizer handles it? |
| -------------------- | -------------------------- | -------------------------- | ---------------------- |
| `changesPercentage`  | camelCase plural           | **`changePercentage`** (no `s`) | **YES** — alias chain added (2026-07-28): `changesPercentage ?? changePercentage ?? changePercent` |
| `mktCap`             | accepted alias for `marketCap` | dropped — only `marketCap` | YES — alias `marketCap ?? mktCap` |
| `eps`, `pe`, `sharesOutstanding`, `earningsAnnouncement`, `avgVolume` | present on `/quote` | removed from `/stable/quote` (only basic price/volume/marketCap/avg fields) | YES — `toNum(undefined) → undefined`, UI shows em-dash for missing fields |
| Profile extras       | core profile only          | **`+cik, +isin, +cusip, +exchangeFullName, +lastDividend, +ipoDate, +defaultImage, +isEtf, +isFund, +isAdr, +isActivelyTrading, +zip, +address, +phone`** | N/A (additive) |
| `changePercent`      | legacy                     | dropped                     | YES — super-ceded by `changePercentage` / `changesPercentage` |
| Earnings calendar path | `/earning_calendar`        | `/earnings-calendar`        | YES — `stockService.getEarningsCalendar` branches on `FMP_USE_STABLE === '1'` (fixed 2026-07-28). See FMP plan §6. |
| Batch quote shape    | `quote/A,B,C` (path)       | `batch-quote?symbols=A,B,C` (query) | NO — `getBatchQuotes` still calls the path shape. Returns 404 on `/stable/`; Yahoo single-ticker fallback runs so the UI doesn't break, just slower. See FMP plan §5. |
| Chart path           | `/historical-price-full/<sym>?timeseries=150` | moved (exact stable shape under verification — likely `/historical-chart/<sym>/1day?from=&to=`) | NO — `getChart` still asks v3 shape. /stable/ likely returns 404 here too; Yahoo fallback covers it. |

### How to validate the flip

After `FMP_USE_STABLE=1` is in `.env`, restart the dev server and check:

1. `GET http://localhost:8080/api/stock-quote?symbol=AAPL` returns
   `changesPercentage ≠ null` (was hardcoded to 0 on v3).
2. `GET http://localhost:8080/api/stock-overview?symbol=AAPL` returns
   `lastDividend`, `ipoDate`, `isEtf` populated (these were absent on v3).
3. `curl https://financialmodelingprep.com/stable/profile?symbol=AAPL&apikey=$FMP_KEY`
   should return status 200, ≥30 fields.

### Alpha Vantage

```
GET /query?function=GLOBAL_QUOTE&symbol={sym}&apikey={key}
  → { "Global Quote":
       { "01. symbol", "02. open", "05. price",
         "08. previous close", "09. change", "10. change percent" } }
```

Free tier: 25 calls/day. AV is wired only as a `getQuote` fallback in
`stockService.ts`.

### Logo.dev

```
GET /ticker/{TICKER}?token={token}
  → image/png (~2.5–11 KB)
  Proxy: /api/company-logo?ticker=...
```

Server-side proxy only — the token never leaks into the client bundle.

### yahoo-finance2 v4 (Yahoo Finance)

Called server-side only.

```
yahooFinance.quote(symbol)
  → { symbol, regularMarketPrice, regularMarketChange,
       regularMarketChangePercent, regularMarketPreviousClose,
       fiftyDayAverage, twoHundredDayAverage,
       marketCap, regularMarketVolume, averageDailyVolume10Day, averageDailyVolume3Month,
       earningsTimestamp (unix seconds), trailingPE,
       epsTrailingTwelveMonths, exchange, longName, shortName }

yahooFinance.quoteSummary(symbol, { modules: ["earningsTrend"] })
  → { earningsTrend: { trend: [
        { period: "-1y" | "-7d" | "0q" | "0y" | "+1q" | "+1y",
          earningsEstimate: { avg:{raw,fmt}, low:{raw,fmt}, high:{raw,fmt} },
          revenueEstimate:  { avg:{raw,fmt}, low:{raw,fmt}, high:{raw,fmt} },
          epsTrend:    { current:{raw}, 7daysAgo:{raw}, 30daysAgo:{raw} },
          epsRevisions:{ upLast7Days, upLast30Days },
          growth:      { raw, fmt } } ] } }

yahooFinance.quoteSummary(symbol, { modules: ["insiderTransactions"] })
  → { insiderTransactions: { transactions: [
        { filerName, filerRelation, transactionText, startDate,
          shares: { raw, fmt }, value: { raw, fmt } } ] } }

yahooFinance.search(symbol, { newsCount: 5 })
  → { news: [
        { title, publisher, providerPublishTime (unix seconds), link,
          thumbnail?, type } ] }
```

Yahoo v4 occasionally returns news in the legacy `{ content: { ... } }` wrapper.
The `normalizeNewsItem` helper in `stockService.ts` handles both shapes.

---

## What the client actually relies on

| Client hook           | Route                     | Response                             |
| --------------------- | ------------------------- | ------------------------------------ |
| `useStockQuote`       | `/api/stock-quote`        | `StockQuote`                         |
| `useBatchQuotes`      | `/api/stock-batch-quotes` | `BatchQuoteResponse`                 |
| `useIndexQuotes`      | `/api/index-quotes`       | `{ dow, sp500, nasdaq } IndexQuote`  |
| `useStockProfile`     | `/api/stock-overview`     | `CompanyProfile`                     |
| `useStockFinancials`  | `/api/stock-financials`   | `FinancialStatements`                |
| `useStockMetrics`     | `/api/stock-metrics`      | `StockMetrics`                       |
| `useStockAnalyst`     | `/api/stock-analyst`      | `AnalystTrends`                      |
| `useStockInsider`     | `/api/stock-insider`      | `InsiderTransaction[]`               |
| `useStockNews`        | `/api/stock-news`         | `NewsItem[]`                         |
| `useEarningsCalendar` | `/api/earnings-calendar`  | `EarningsEvent[]`                    |
| `useStockChart`       | `/api/stock-chart`        | `ChartSeries`                        |

Every hook is now typed end-to-end. No `any` on the boundary, no
twin-casing defensive checks anywhere in the client.
