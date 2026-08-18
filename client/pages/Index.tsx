import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import AnimatedNumber from "@/components/AnimatedNumber";
import ChartModal from "@/components/ChartModal";
import InsightsCard from "@/components/InsightsCard";
import RevenueSegmentsCard from "@/components/RevenueSegmentsCard";
import CompanyProfile from "@/components/CompanyProfile";
import StockFundamentalsStrip from "@/components/StockFundamentalsStrip";
import TickerLogo from "@/components/TickerLogo";
import {
  AnalystCardSkeleton,
  HeaderPriceSkeleton,
  MetricCardSkeleton,
  NewsCardSkeleton,
} from "@/components/Skeleton";
import type { FinancialMetric } from "@/lib/mockData";
import {
  useStockQuote,
  useStockProfile,
  useStockFinancials,
  useStockMetrics,
  useStockAnalyst,
  useProviderHealth,
  useScreenerAsset,
  useStockYahooFallbackFinancials,
  useStockNews,
  useTickerEarningsCalendar,
} from "@/hooks/useStockData";
import DataStatusBadge from "@/components/DataStatusBadge";
import PageHeader from "@/components/PageHeader";
import { nextUpcomingEarningsDate } from "@/lib/earningsDate";
import {
  cagrAtYearsBack,
  detectPeriodGranularity,
  formatEarningsDate,
  yoyGrowth,
} from "@/lib/finance";
/**
 * Displays a localized stock overview with quote information, company details, financial metrics, and interactive charts for the selected ticker.
 */
export default function Index() {
  const { t } = useI18n();
  const { ticker: urlTicker } = useParams<{ ticker?: string }>();
  const [selectedMetric, setSelectedMetric] = useState<FinancialMetric | null>(
    null,
  );

  const ticker = urlTicker?.toUpperCase() || "AAPL";

  const {
    data: quoteData,
    isLoading: quoteLoading,
    dataUpdatedAt: quoteUpdatedAt,
  } = useStockQuote(ticker);
  const { data: overviewData, isLoading: overviewLoading } =
    useStockProfile(ticker);
  // isFetched becomes true once the first query attempt settles (success
  // OR failure). We need it to distinguish "still loading" from "loaded
  // with no data" — otherwise the metrics grid shows skeletons forever
  // when FMP returns null (which happens on the free tier for many tickers).
  const {
    data: financialsData,
    isFetched: financialsFetched,
    dataUpdatedAt: financialsUpdatedAt,
    refetch: refetchFinancials,
  } = useStockFinancials(ticker);
  const {
    data: quarterlyFinancialsData,
    isLoading: quarterlyFinancialsLoading,
  } = useStockFinancials(ticker, { period: "quarter" });
  const { data: stockMetricsData, isLoading: stockMetricsLoading } =
    useStockMetrics(ticker);
  const { data: analystData, isLoading: analystLoading } =
    useStockAnalyst(ticker);
  const { data: newsData, isLoading: newsLoading } = useStockNews(ticker);
  const todayIso = new Date().toISOString().slice(0, 10);
  const calendarToIso = new Date(Date.now() + 45 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data: earningsCalendar = [] } = useTickerEarningsCalendar(
    ticker,
    todayIso,
    calendarToIso,
  );
  // Stable header badge value — always rendered (placeholder while analyst
  // data loads) so the header row never changes height or jumps. `AnimatedNumber`
  // counts it up from zero (ease-out cubic) the moment data lands; `tabular-nums`
  // on the badge keeps the width steady while digits tick.
  const targetEps = analystData?.[0]?.earningsEstimate?.avg;
  // First-paint skeleton for the analyst card: block while either the quote
  // or the analyst estimate is still loading so the card frame never snaps.
  const analystCardLoading = quoteLoading || analystLoading;

  // Provider-health probe (already polled by the global indicator) — when
  // FMP is degraded we KNOW the financials fetch likely landed on a 429,
  // so the empty-state below can surface the actual cause instead of a
  // vague "Retry" button. Shares the same query key as the global banner;
  // React Query dedupes so this is a zero-cost subscription.
  const { data: providerHealth } = useProviderHealth();
  const fmpProbe = providerHealth?.providers?.find(
    (p) => p.provider === "fmp" && p.feature === "quote",
  );
  // Any FMP feature on the quote-plane being degraded is enough — the free
  // tier's 250/day budget lets a single 429 in any quote-path probe stand
  // in for "the whole /stable/ surface is rate-limited" because the
  // window is a rolling 24h. showFmpRateLimit then renders a localized
  // hint under the empty-state with hours-until-reset math.
  const fmpDown =
    fmpProbe?.status === "down" || fmpProbe?.status === "degraded";

  const metrics = useMemo(() => {
    // Keep the data decision separate from rendering: an empty API response
    // must remain empty here so the page can label the local demo series MOCK.
    if (!financialsFetched) return [];
    if (!financialsData || financialsData.income.length === 0) return [];

    let metricsResult: FinancialMetric[] = [];

    const inc = financialsData?.income ?? [];
    const bal = financialsData?.balance ?? [];
    if (inc.length > 0) {
      const incAsc = [...inc].sort((a, b) => (a.date < b.date ? -1 : 1));
      const balAsc = [...bal].sort((a, b) => (a.date < b.date ? -1 : 1));

      const safeYoy = (arr: typeof inc, key: keyof (typeof inc)[number]) => {
        if (arr.length < 2) return null;
        const prev = arr[arr.length - 2][key] as number;
        const current = arr[arr.length - 1][key] as number;
        return yoyGrowth(prev, current);
      };

      // CAGR helpers close the gap between the working "1Y YoY" column and
      // the 3Y / 5Y columns the modal used to render as "-" because the
      // metric builder never set their fields. `detectPeriodGranularity`
      // reads the most recent row's `period` label so an annual series
      // uses a 1-row stride back per year and a quarterly series uses
      // 4 rows per year. The helper returns `null` when the series is
      // too short, so the modal renders "-" cleanly without throwing.
      const granularity = detectPeriodGranularity(incAsc);
      const safeCagrAtYears = (
        arr: typeof inc,
        key: keyof (typeof inc)[number],
        years: number,
      ): number | null => cagrAtYearsBack(arr, key, years, granularity);

      metricsResult = [
        {
          name: "insights.revenue",
          unit: "B",
          yoy: safeYoy(incAsc, "revenue"),
          cagr3Y: safeCagrAtYears(incAsc, "revenue", 3),
          data: incAsc.map((d) => ({
            date: d.calendarYear,
            value: d.revenue / 1e9,
          })),
          type: "bar",
          color: "blue",
        },
        {
          name: "insights.ebitda",
          unit: "B",
          yoy: safeYoy(incAsc, "ebitda"),
          cagr3Y: safeCagrAtYears(incAsc, "ebitda", 3),
          data: incAsc.map((d) => ({
            date: d.calendarYear,
            value: d.ebitda / 1e9,
          })),
          type: "bar",
          color: "blue",
        },
        {
          name: "insights.grossProfit",
          unit: "B",
          yoy: safeYoy(incAsc, "grossProfit"),
          cagr3Y: safeCagrAtYears(incAsc, "grossProfit", 3),
          data: incAsc.map((d) => ({
            date: d.calendarYear,
            value: d.grossProfit / 1e9,
          })),
          type: "bar",
          color: "blue",
        },
        {
          name: "insights.operatingIncome",
          unit: "B",
          yoy: safeYoy(incAsc, "operatingIncome"),
          cagr3Y: safeCagrAtYears(incAsc, "operatingIncome", 3),
          data: (
            incAsc.filter(
              (row) => row.operatingIncome !== undefined,
            ) as typeof inc
          ).map((d) => ({
            date: d.calendarYear,
            value: (d.operatingIncome ?? 0) / 1e9,
          })),
          type: "bar",
          color: "blue",
        },
        {
          name: "insights.netIncome",
          unit: "B",
          yoy: safeYoy(incAsc, "netIncome"),
          cagr3Y: safeCagrAtYears(incAsc, "netIncome", 3),
          data: incAsc.map((d) => ({
            date: d.calendarYear,
            value: d.netIncome / 1e9,
          })),
          type: "bar",
          color: "blue",
        },
        {
          name: "insights.eps",
          unit: "$",
          yoy: safeYoy(incAsc, "eps"),
          cagr3Y: safeCagrAtYears(incAsc, "eps", 3),
          data: incAsc.map((d) => ({ date: d.calendarYear, value: d.eps })),
          type: "line",
          color: "blue",
        },
        {
          name: "insights.cashAndEquivalents",
          unit: "B",
          yoy:
            balAsc.length >= 2
              ? yoyGrowth(
                  balAsc[balAsc.length - 2].cashAndCashEquivalents,
                  balAsc[balAsc.length - 1].cashAndCashEquivalents,
                )
              : null,
          cagr3Y: cagrAtYearsBack(
            balAsc,
            "cashAndCashEquivalents",
            3,
            granularity,
          ),
          data: balAsc.map((d) => ({
            date: d.calendarYear,
            value: d.cashAndCashEquivalents / 1e9,
          })),
          type: "bar",
          color: "green",
        },
        {
          name: "insights.totalAssets",
          unit: "B",
          yoy:
            balAsc.length >= 2
              ? yoyGrowth(
                  balAsc[balAsc.length - 2].totalAssets,
                  balAsc[balAsc.length - 1].totalAssets,
                )
              : null,
          cagr3Y: cagrAtYearsBack(balAsc, "totalAssets", 3, granularity),
          data: balAsc.map((d) => ({
            date: d.calendarYear,
            value: (d.totalAssets ?? 0) / 1e9,
          })),
          type: "bar",
          color: "purple",
        },
      ];
    }
    return metricsResult;
  }, [financialsData]);

  // ── Yahoo fallback path (FMP rate-limited) ────────────────────────────────
  // When FMP is degraded AND the primary metrics grid is empty, swap to a
  // Yahoo-driven 4-card snapshot view: Revenue / EBITDA / Gross Profit /
  // EPS-est, each labeled "(Yahoo estimate)" so stale-free-tier data
  // can't read as a real primary source. Gated by `enabled` so a healthy
  // FMP probe never fires the Yahoo round-trip. Shares the query key
  // `["stockYahooFallbackFinancials", ticker]` with any other observer,
  // so React Query dedupes across renders.
  const { data: yahooFallbackData } = useStockYahooFallbackFinancials(ticker, {
    enabled: fmpDown && financialsFetched && metrics.length === 0,
  });
  // `hasAnyFallbackValue` gates the fallback render on the basis that a
  // valid Yahoo response always carries at least one finite number — a
  // payload of all `null` (which the server emits on total upstream
  // failure) should fall through to the existing "Metrics unavailable"
  // empty-state rather than render four dashes posing as a snapshot.
  const hasAnyFallbackValue = (yf?: typeof yahooFallbackData): boolean => {
    if (!yf) return false;
    return (
      yf.revenue !== null ||
      yf.ebitda !== null ||
      yf.grossProfit !== null ||
      yf.operatingMargin !== null ||
      yf.profitMargin !== null ||
      yf.grossMargin !== null ||
      yf.revenueGrowth !== null ||
      yf.earningsGrowth !== null ||
      yf.totalCash !== null ||
      yf.totalDebt !== null ||
      yf.enterpriseValue !== null ||
      yf.trailingEps !== null ||
      yf.forwardEps !== null ||
      yf.epsEstimateNextQtr !== null ||
      yf.revenueEstimateNextQtr !== null
    );
  };
  const showYahooFallback =
    fmpDown &&
    financialsFetched &&
    metrics.length === 0 &&
    hasAnyFallbackValue(yahooFallbackData);
  // Never substitute local demo metrics for a missing provider response.
  // Historical cards are shown only when real statement data was fetched;
  // Yahoo fallback is intentionally limited to its explicit single-point view.
  const displayMetrics = metrics.length > 0 ? metrics : [];

  // Locale-aware earnings-date formatted via `formatEarningsDate` (en:
  // "Apr 22, 2026", he: "22 באפר 2026"). The previous `toISOString().slice(0,10)`
  // produced bare ISO "2026-04-22" which read like a YAML key to non-technical
  // users. `formatEarningsDate` also survives upstream Unix-second epoch
  // values because it routes through `parseTradeDate` (handles both halves).
  const earningsDate = useMemo(() => {
    const raw = nextUpcomingEarningsDate(
      ticker,
      quoteData?.earningsAnnouncement,
      earningsCalendar,
    );
    return formatEarningsDate(raw);
  }, [ticker, quoteData?.earningsAnnouncement, earningsCalendar]);

  // NOTE: `categoryColor` and `getCategoryStyle` previously lived here to
  // color news-pill chips per category, but Index.tsx no longer renders
  // news pills (the CompanyProfile sub-component handles news). Both
  // aliases are removed so future readers don't wire them back up — news
  // styling lives in `client/components/CompanyProfile.tsx`.

  return (
    <div className="w-full bg-background dark">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Centered Header Section */}
        <div className="mb-12 text-center">
          <PageHeader
            eyebrow={t("nav.insights")}
            title={`${ticker} • ${(overviewData?.companyName && overviewData.companyName.toUpperCase() !== ticker ? overviewData.companyName : undefined) ?? quoteData?.name ?? ticker}${overviewData?.exchange ? ` • ${overviewData.exchange}` : ""}`}
            className="mb-8 text-left"
          />

          {/* Stock Price — the hero number counts up when the quote lands,
              in sync with the Analyst card below. `placeholder={null}` keeps
              the first pre-frame paint empty rather than flashing a "—" in
              the text-5xl headline. */}
          <div className="mb-3 flex items-center justify-center gap-4">
            <TickerLogo
              ticker={ticker}
              size="xl"
              variant="bare"
              className="self-stretch h-auto min-h-[7.5rem] w-24"
              ariaLabel={`${ticker} company logo`}
            />
            <div className="min-w-0">
              {quoteLoading ? (
                <HeaderPriceSkeleton />
              ) : quoteData?.price ? (
                <div className="flex items-center justify-center gap-3">
                  <span
                    className="text-5xl font-bold text-foreground tabular-nums"
                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                    dir="ltr"
                  >
                    <AnimatedNumber
                      value={quoteData.price}
                      placeholder={null}
                      format={(v) => `$${v.toFixed(2)}`}
                    />
                  </span>
                  <div
                    className="flex flex-col items-start justify-center gap-1 tabular-nums"
                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                    dir="ltr"
                  >
                    <span
                      className={`text-lg font-semibold leading-none ${quoteData.change >= 0 ? "text-chart-green" : "text-red-400"}`}
                    >
                      <AnimatedNumber
                        value={quoteData.change ?? null}
                        placeholder={null}
                        format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`}
                      />
                    </span>
                    <span
                      className={`text-lg font-semibold leading-none ${quoteData.changesPercentage >= 0 ? "text-chart-green" : "text-red-400"}`}
                    >
                      <AnimatedNumber
                        value={quoteData.changesPercentage ?? null}
                        placeholder={null}
                        format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`}
                      />
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-400 text-xl">
                  {t("index.unavailableApi")}
                </div>
              )}
              <div className="flex justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground mt-3">
                <span>
                  {t("index.earnings")}{" "}
                  {earningsDate ? (
                    <span className="text-blue-400" dir="ltr">
                      {earningsDate}
                    </span>
                  ) : (
                    <span className="text-slate-500" dir="ltr">
                      —
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <StockFundamentalsStrip
            quote={quoteData}
            metrics={stockMetricsData}
            annualFinancials={financialsData}
            quarterlyFinancials={quarterlyFinancialsData}
            marketCap={quoteData?.marketCap ?? overviewData?.marketCap}
            loading={
              quoteLoading || stockMetricsLoading || quarterlyFinancialsLoading
            }
          />
        </div>

        {/* Quality in Brief & Analyst Outlook 2-Column Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-10 text-left">
          {/* Quality in Brief (News) Card */}
          <div className="bg-card/60 border border-border/60 rounded-xl p-5 backdrop-blur-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-foreground/90 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-chart-green animate-pulse" />
                  {t("index.qualityInBrief")}
                </h2>
              </div>

              {newsLoading ? (
                <NewsCardSkeleton />
              ) : (
                <div className="flex flex-col gap-3.5">
                  {newsData?.slice(0, 3).map((news) => (
                    <div
                      key={news.link}
                      className="group flex flex-col gap-1 p-2.5 rounded-lg hover:bg-muted/40 transition-colors"
                    >
                      <a
                        href={news.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-base font-medium text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2"
                      >
                        {news.title}
                      </a>
                      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wide">
                        <span className="px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-semibold">
                          {news.publisher}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(
                            news.providerPublishTime * 1000,
                          ).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                  {!newsData?.length && (
                    <div className="text-sm text-muted-foreground/60 italic p-4 text-center">
                      No recent news available for {ticker}.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Analyst Outlook & 52-Week Range Card */}
          <div className="bg-card/60 border border-border/60 rounded-xl p-5 backdrop-blur-sm flex flex-col justify-between">
            {analystCardLoading ? (
              <AnalystCardSkeleton />
            ) : (
              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-foreground/90 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    Analyst Outlook & Range
                  </h2>
                  <span
                    className={`shrink-0 text-xs font-mono font-medium px-2 py-0.5 rounded border whitespace-nowrap tabular-nums ${
                      targetEps != null
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        : "bg-muted/40 text-muted-foreground/70 border-border/40"
                    }`}
                  >
                    Target EPS:{" "}
                    <AnimatedNumber
                      value={targetEps}
                      format={(v) => `$${v.toFixed(2)}`}
                    />
                  </span>
                </div>

                {/* 52-Week Price Range Indicator */}
                {quoteData?.yearLow &&
                  quoteData?.yearHigh &&
                  quoteData?.price && (
                    <div className="mb-4 p-3.5 rounded-lg bg-muted/30 border border-border/40">
                      <div className="flex justify-between text-sm font-medium text-muted-foreground mb-2">
                        <span>
                          52W Low:{" "}
                          <strong
                            className="text-foreground font-mono"
                            dir="ltr"
                          >
                            ${quoteData.yearLow.toFixed(2)}
                          </strong>
                        </span>
                        <span>
                          52W High:{" "}
                          <strong
                            className="text-foreground font-mono"
                            dir="ltr"
                          >
                            ${quoteData.yearHigh.toFixed(2)}
                          </strong>
                        </span>
                      </div>

                      {(() => {
                        const range = quoteData.yearHigh - quoteData.yearLow;
                        // Colors derive from the final price so they don't flash
                        // through red→amber→green while the value counts up.
                        const finalPct = Math.max(
                          0,
                          Math.min(
                            100,
                            range > 0
                              ? ((quoteData.price - quoteData.yearLow) /
                                  range) *
                                  100
                              : 50,
                          ),
                        );
                        const barColor =
                          finalPct > 66
                            ? "bg-chart-green"
                            : finalPct >= 33
                              ? "bg-amber-400"
                              : "bg-red-400";
                        const textColor =
                          finalPct > 66
                            ? "text-chart-green"
                            : finalPct >= 33
                              ? "text-amber-400"
                              : "text-red-400";
                        const arrowColor =
                          finalPct > 66
                            ? "text-chart-green"
                            : finalPct >= 33
                              ? "text-amber-400"
                              : "text-red-400";
                        const pctOf = (price: number) =>
                          Math.max(
                            0,
                            Math.min(
                              100,
                              range > 0
                                ? ((price - quoteData.yearLow) / range) * 100
                                : 50,
                            ),
                          );
                        return (
                          <div className="relative pb-7 pt-1">
                            {/* Static track always rendered — the block keeps its
                            full height even on the first paint before the
                            animation starts. */}
                            <div className="relative w-full h-2.5 bg-muted/80 rounded-full overflow-hidden">
                              {/* Fill rides the animated price (AnimatedNumber
                              render-prop) so the bar slides up from the 52W
                              low while the card settles in sync with the EPS
                              badge and avg tiles. */}
                              <AnimatedNumber
                                value={quoteData.price}
                                placeholder={null}
                              >
                                {(price) => (
                                  <div
                                    className={`h-full rounded-full ${barColor}`}
                                    style={{ width: `${pctOf(price)}%` }}
                                  />
                                )}
                              </AnimatedNumber>
                            </div>

                            {/* Arrow Pointer & Current Price Tag — driven by the
                            same animated price, so marker and fill stay glued
                            together as they slide in. */}
                            <AnimatedNumber
                              value={quoteData.price}
                              placeholder={null}
                            >
                              {(price) => (
                                <div
                                  className="absolute flex flex-col items-center pointer-events-none"
                                  style={{
                                    left: `${pctOf(price)}%`,
                                    transform: "translateX(-50%)",
                                    top: "14px",
                                  }}
                                >
                                  <span
                                    className={`text-xs leading-none ${arrowColor}`}
                                  >
                                    ▲
                                  </span>
                                  <span
                                    className={`text-xs font-mono font-bold whitespace-nowrap tabular-nums ${textColor}`}
                                    dir="ltr"
                                  >
                                    ${price.toFixed(2)}
                                  </span>
                                </div>
                              )}
                            </AnimatedNumber>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                {/* Analyst Consensus EPS & Averages */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
                      50-Day Avg
                    </span>
                    <span
                      className="font-mono font-medium text-foreground text-sm tabular-nums"
                      dir="ltr"
                    >
                      <AnimatedNumber
                        value={quoteData?.priceAvg50 ?? null}
                        format={(v) => `$${v.toFixed(2)}`}
                      />
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
                      200-Day Avg
                    </span>
                    <span
                      className="font-mono font-medium text-foreground text-sm tabular-nums"
                      dir="ltr"
                    >
                      <AnimatedNumber
                        value={quoteData?.priceAvg200 ?? null}
                        format={(v) => `$${v.toFixed(2)}`}
                      />
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
                      EPS Est. (Curr Qtr)
                    </span>
                    <span
                      className="font-mono font-medium text-foreground text-sm"
                      dir="ltr"
                    >
                      {analystData?.[0]?.earningsEstimate?.avg != null
                        ? `$${analystData[0].earningsEstimate.avg.toFixed(2)}`
                        : "—"}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
                      Revenue Est. (Avg)
                    </span>
                    <span
                      className="font-mono font-medium text-foreground text-sm"
                      dir="ltr"
                    >
                      {analystData?.[0]?.revenueEstimate?.avg
                        ? `$${(analystData[0].revenueEstimate.avg / 1e9).toFixed(2)}B`
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Charts Grid - 4x2 — three render states driven by query fetch status */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-sm font-semibold text-foreground">
                {t("index.financialMetricsTitle")}
              </h2>
              {financialsData && (
                <DataStatusBadge
                  status="live"
                  source="Financial statements API"
                  updatedAt={financialsUpdatedAt}
                  compact
                  iconOnly
                />
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {showYahooFallback
                ? "Historical statements are unavailable; no synthetic series is shown."
                : "Only recently fetched provider statement data is displayed."}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Cache-key switch (e.g. /stock/AAPL → /stock/MSFT) resets isFetched
              to false even though we may have stale data on disk; the skeleton
              flash masks the cache-miss transition so don't add an enabled:
              guard here without also handling that path. */}
          {!financialsFetched ? (
            <>
              {Array.from({ length: 8 }).map((_, i) => (
                <MetricCardSkeleton key={i} />
              ))}
            </>
          ) : showYahooFallback ? (
            <div className="col-span-full rounded-panel border border-chart-blue/30 bg-chart-blue/5 px-6 py-8 text-center">
              <DataStatusBadge
                status="estimate"
                source="Yahoo Finance"
                updatedAt={financialsUpdatedAt}
              />
              <p className="mt-3 text-sm text-muted-foreground">
                Showing a single-point estimate instead of a historical YoY/CAGR
                series.
              </p>
            </div>
          ) : displayMetrics.length === 0 ? (
            <div className="col-span-full bg-card border border-border rounded-panel px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {t("index.metricsUnavailable", { ticker })}
              </p>
              {/* When FMP is degraded AND metrics are empty, the "Retry"
                    button by itself is a misleading hint — it's the budget,
                    not the request. Surface the real cause (free-tier 429)
                    so users know why Retry is honest about a likely no-op,
                    and links them to docs that explain the rate limit. Hidden
                    until both conditions are met so a benign empty-upstream
                    state (e.g. a symbol FMP doesn't cover) still reads as
                    "no data" without alarm. */}
              {fmpDown && (
                <p className="mt-3 text-xs text-chart-amber/90 max-w-md mx-auto leading-relaxed">
                  {t("index.metricsRateLimitedUnknownReset")}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  // .catch(() => null) future-proofs against the void-discard
                  // shape — if anyone later awaits this or chains .then(), the
                  // pipeline still won't surface an unhandled rejection. The
                  // FMP free tier frequently returns the same empty array on
                  // refetch, so this button is honest about a likely no-op.
                  refetchFinancials().catch(() => null);
                }}
                className="mt-4 text-xs text-primary hover:opacity-80 transition-opacity"
              >
                {t("index.metricsRetry")}
              </button>
            </div>
          ) : (
            displayMetrics.map((metric, idx) => {
              // Revenue is the one card that can show a product-segment
              // breakdown (FMP revenue-product-segmentation) with segment
              // filters. When the free-tier quota is exhausted the card falls
              // back to this exact total-revenue render but keeps the segment
              // filters visible as a locked premium feature.
              if (metric.name === "insights.revenue") {
                return (
                  <RevenueSegmentsCard
                    key={idx}
                    metric={metric}
                    ticker={ticker}
                  />
                );
              }
              const latestVal = metric.data[metric.data.length - 1]?.value;
              const yoyChange = metric.yoy;
              return (
                <InsightsCard
                  key={idx}
                  title={
                    t(metric.name) === metric.name
                      ? metric.name.split(".")[1]
                      : t(metric.name)
                  }
                  value={
                    latestVal == null
                      ? "—"
                      : `${latestVal.toFixed(2)}${metric.unit === "$" ? "" : metric.unit}`
                  }
                  badgeText={
                    yoyChange == null
                      ? "—"
                      : `${yoyChange >= 0 ? "+" : ""}${yoyChange.toFixed(2)}%`
                  }
                  badgeType={
                    yoyChange == null
                      ? "neutral"
                      : yoyChange >= 0
                        ? "positive"
                        : "negative"
                  }
                  metricId={metric.name}
                  metricData={metric}
                  ticker={ticker}
                />
              );
            })
          )}
        </div>

        {/* Company Profile Section */}
        <CompanyProfile ticker={ticker} />
      </div>

      {/* Chart Modal */}
      {selectedMetric && (
        <ChartModal
          metric={selectedMetric}
          isOpen={selectedMetric !== null}
          onClose={() => setSelectedMetric(null)}
          ticker={ticker}
        />
      )}
    </div>
  );
}
