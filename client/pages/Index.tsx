import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import ChartModal from "@/components/ChartModal";
import InsightsCard from "@/components/InsightsCard";
import CompanyProfile from "@/components/CompanyProfile";
import TickerLogo from "@/components/TickerLogo";
import { HeaderPriceSkeleton, MetricCardSkeleton } from "@/components/Skeleton";
import { financialMetrics, FinancialMetric } from "@/lib/mockData";
import { useStockQuote, useStockProfile, useStockFinancials, useProviderHealth, useStockYahooFallbackFinancials } from "@/hooks/useStockData";
import {
  cagrAtYearsBack,
  detectPeriodGranularity,
  formatEarningsDate,
} from "@/lib/finance";
import type { YahooFallbackFinancials } from "@shared/api";

/**
 * Compact 4-card snapshot grid for the FMP-rate-limited fallback path.
 * Yahoo free tier doesn't ship historical fundamentals, so this can't
 * render the YoY/CAGR 8-card grid the FMP primary does — instead it
 * surfaces single-point TTM / estimate values from `defaultKeyStatistics` /
 * `financialData` / `earningsTrend`. Each card carries a "(Yahoo estimate)"
 * chip + tooltip so stale-free-tier data can't read as a real primary
 * source. This component is local to the page because (a) it isn't used
 * anywhere else, and (b) moving it to a shared file would force the
 * shared component to know about the Index page's render state machine.
 */
function YahooFallbackGrid({
  data,
  chipLabel,
  chipTitle,
  formatBillions,
  formatPercent,
  formatUSD,
  emDash,
}: {
  data: YahooFallbackFinancials;
  chipLabel: string;
  chipTitle: string;
  formatBillions: (n: number) => string;
  formatPercent: (n: number) => string;
  formatUSD: (n: number) => string;
  emDash: string;
}) {
  const safeText = (
    value: number | null,
    formatter: (n: number) => string,
  ): string => (value === null || !Number.isFinite(value) ? emDash : formatter(value));
  const safeBadge = (value: number | null): string =>
    value === null || !Number.isFinite(value) ? emDash : formatPercent(value);
  const cards: Array<{
    title: string;
    value: string;
    badge: string;
    badgeType: "positive" | "negative" | "neutral";
  }> = [
    // Revenue (TTM) with revenueGrowth as the YoY chip.
    {
      title: "Revenue (TTM)",
      value: safeText(data.revenue, formatBillions),
      badge: safeBadge(data.revenueGrowth),
      badgeType:
        data.revenueGrowth === null || !Number.isFinite(data.revenueGrowth)
          ? "neutral"
          : data.revenueGrowth >= 0
            ? "positive"
            : "negative",
    },
    // EBITDA (TTM) with operatingMargin as the chip.
    {
      title: "EBITDA (TTM)",
      value: safeText(data.ebitda, formatBillions),
      badge: safeBadge(data.operatingMargin),
      badgeType:
        data.operatingMargin === null || !Number.isFinite(data.operatingMargin)
          ? "neutral"
          : data.operatingMargin >= 0
            ? "positive"
            : "negative",
    },
    // Gross Profit (TTM) with grossMargin as the chip.
    {
      title: "Gross Profit (TTM)",
      value: safeText(data.grossProfit, formatBillions),
      badge: safeBadge(data.grossMargin),
      badgeType:
        data.grossMargin === null || !Number.isFinite(data.grossMargin)
          ? "neutral"
          : data.grossMargin >= 0
            ? "positive"
            : "negative",
    },
    // EPS est (next quarter consensus) with earningsGrowth as the chip.
    {
      title: "EPS Estimate (Next Qtr)",
      value: safeText(data.epsEstimateNextQtr, formatUSD),
      badge: safeBadge(data.earningsGrowth),
      badgeType:
        data.earningsGrowth === null || !Number.isFinite(data.earningsGrowth)
          ? "neutral"
          : data.earningsGrowth >= 0
            ? "positive"
            : "negative",
    },
  ];
  return (
    <>
      {cards.map((card, idx) => {
        const valueClass = card.badgeType === "positive"
          ? "border-green-500/30"
          : card.badgeType === "negative"
            ? "border-red-500/30"
            : "border-slate-500/30";
        const badgeClass = card.badgeType === "positive"
          ? "bg-green-500/20 text-green-400"
          : card.badgeType === "negative"
            ? "bg-red-500/20 text-red-400"
            : "bg-slate-500/20 text-slate-300";
        return (
          <div
            key={idx}
            className={`bg-card border ${valueClass} rounded-xl p-4 flex flex-col`}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <span className="text-sm text-muted-foreground font-medium">
                {card.title}
              </span>
              <span
                className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded shrink-0 ${badgeClass}`}
                title={chipTitle}
                dir="ltr"
              >
                {chipLabel}
              </span>
            </div>
            <div className="flex items-end gap-3 mb-1">
              <span className="text-3xl font-bold text-foreground tracking-tight" dir="ltr">
                {card.value}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded border mb-1 ${badgeClass} border-current/20`}
                dir="ltr"
              >
                {card.badge}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}

/**
 * Displays a localized stock overview with quote information, company details, financial metrics, and interactive charts for the selected ticker.
 */
export default function Index() {
  const { t } = useI18n();
  const { ticker: urlTicker } = useParams<{ ticker?: string }>();
  const [selectedMetric, setSelectedMetric] = useState<FinancialMetric | null>(null);

  const ticker = urlTicker?.toUpperCase() || "AAPL";

  const { data: quoteData, isLoading: quoteLoading } = useStockQuote(ticker);
  const { data: overviewData, isLoading: overviewLoading } = useStockProfile(ticker);
  // isFetched becomes true once the first query attempt settles (success
  // OR failure). We need it to distinguish "still loading" from "loaded
  // with no data" — otherwise the metrics grid shows skeletons forever
  // when FMP returns null (which happens on the free tier for many tickers).
  const {
    data: financialsData,
    isFetched: financialsFetched,
    refetch: refetchFinancials,
  } = useStockFinancials(ticker);

  // Provider-health probe (already polled by the global indicator) — when
  // FMP is degraded we KNOW the financials fetch likely landed on a 429,
  // so the empty-state below can surface the actual cause instead of a
  // vague "Retry" button. Shares the same query key as the global banner;
  // React Query dedupes so this is a zero-cost subscription.
  const { data: providerHealth, dataUpdatedAt: providerHealthCheckedAt } = useProviderHealth();
  const fmpProbe = providerHealth?.providers?.find(
    (p) => p.provider === "fmp" && p.feature === "quote",
  );
  // Any FMP feature on the quote-plane being degraded is enough — the free
  // tier's 250/day budget lets a single 429 in any quote-path probe stand
  // in for "the whole /stable/ surface is rate-limited" because the
  // window is a rolling 24h. showFmpRateLimit then renders a localized
  // hint under the empty-state with hours-until-reset math.
  const fmpDown = fmpProbe?.status === "down" || fmpProbe?.status === "degraded";
  // FMP's free tier window is per-day (rolling 24h). The probe gives us a
  // timestamp; we report "resets in ~N hours" rather than a hard promise,
  // and clamp to a sane range so a long-quiet probe doesn't read as
  // "resets in 0 minutes".
  const fmpHoursUntilReset = providerHealthCheckedAt
    ? Math.max(1, Math.min(24, 24 - Math.floor((Date.now() - providerHealthCheckedAt) / 3_600_000)))
    : null;

  const metrics = useMemo(() => {
    // When no real financials land for the active ticker, do NOT silently
    // surface financialMetrics (which is hardcoded AAPL data) for a
    // non-AAPL ticker. Render empty so the `metrics.length === 0` branch
    // below shows MetricCardSkeleton instead.
    let metricsResult: typeof financialMetrics = [];

    const inc = financialsData?.income ?? [];
    const bal = financialsData?.balance ?? [];
    if (inc.length > 0) {
      const incAsc = [...inc].sort((a, b) => (a.date < b.date ? -1 : 1));
      const balAsc = [...bal].sort((a, b) => (a.date < b.date ? -1 : 1));

      const safeYoy = (arr: typeof inc, key: keyof typeof inc[number]) => {
        if (arr.length < 2) return 0;
        const prev = arr[arr.length - 2][key] as number;
        const current = arr[arr.length - 1][key] as number;
        if (!prev) return 0;
        return ((current - prev) / Math.abs(prev)) * 100;
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
        key: keyof typeof inc[number],
        years: number,
      ): number | null => cagrAtYearsBack(arr, key, years, granularity);

      metricsResult = [
        {
          name: "insights.revenue",
          unit: "B",
          yoy: safeYoy(incAsc, "revenue"),
          cagr3Y: safeCagrAtYears(incAsc, "revenue", 3),
          cagr5Y: safeCagrAtYears(incAsc, "revenue", 5),
          data: incAsc.map((d) => ({ date: d.calendarYear, value: d.revenue / 1e9 })),
          type: "bar",
          color: "blue",
        },
        {
          name: "insights.ebitda",
          unit: "B",
          yoy: safeYoy(incAsc, "ebitda"),
          cagr3Y: safeCagrAtYears(incAsc, "ebitda", 3),
          cagr5Y: safeCagrAtYears(incAsc, "ebitda", 5),
          data: incAsc.map((d) => ({ date: d.calendarYear, value: d.ebitda / 1e9 })),
          type: "bar",
          color: "blue",
        },
        {
          name: "insights.grossProfit",
          unit: "B",
          yoy: safeYoy(incAsc, "grossProfit"),
          cagr3Y: safeCagrAtYears(incAsc, "grossProfit", 3),
          cagr5Y: safeCagrAtYears(incAsc, "grossProfit", 5),
          data: incAsc.map((d) => ({ date: d.calendarYear, value: d.grossProfit / 1e9 })),
          type: "bar",
          color: "blue",
        },
        {
          name: "insights.operatingIncome",
          unit: "B",
          yoy: safeYoy(incAsc, "operatingIncome"),
          cagr3Y: safeCagrAtYears(incAsc, "operatingIncome", 3),
          cagr5Y: safeCagrAtYears(incAsc, "operatingIncome", 5),
          data: (incAsc.filter((row) => row.operatingIncome !== undefined) as typeof inc).map((d) => ({
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
          cagr5Y: safeCagrAtYears(incAsc, "netIncome", 5),
          data: incAsc.map((d) => ({ date: d.calendarYear, value: d.netIncome / 1e9 })),
          type: "bar",
          color: "blue",
        },
        {
          name: "insights.eps",
          unit: "$",
          yoy: safeYoy(incAsc, "eps"),
          cagr3Y: safeCagrAtYears(incAsc, "eps", 3),
          cagr5Y: safeCagrAtYears(incAsc, "eps", 5),
          data: incAsc.map((d) => ({ date: d.calendarYear, value: d.eps })),
          type: "line",
          color: "blue",
        },
        {
          name: "insights.cashAndEquivalents",
          unit: "B",
          yoy:
            balAsc.length >= 2
              ? ((balAsc[balAsc.length - 1].cashAndCashEquivalents - balAsc[balAsc.length - 2].cashAndCashEquivalents) /
                  Math.abs(balAsc[balAsc.length - 2].cashAndCashEquivalents)) *
                100
              : 0,
          cagr3Y: cagrAtYearsBack(balAsc, "cashAndCashEquivalents", 3, granularity),
          cagr5Y: cagrAtYearsBack(balAsc, "cashAndCashEquivalents", 5, granularity),
          data: balAsc.map((d) => ({ date: d.calendarYear, value: d.cashAndCashEquivalents / 1e9 })),
          type: "bar",
          color: "green",
        },
        {
          name: "insights.totalAssets",
          unit: "B",
          yoy:
            balAsc.length >= 2
              ? ((balAsc[balAsc.length - 1].totalAssets - balAsc[balAsc.length - 2].totalAssets) / Math.abs(balAsc[balAsc.length - 2].totalAssets)) * 100
              : 0,
          cagr3Y: cagrAtYearsBack(balAsc, "totalAssets", 3, granularity),
          cagr5Y: cagrAtYearsBack(balAsc, "totalAssets", 5, granularity),
          data: balAsc.map((d) => ({ date: d.calendarYear, value: (d.totalAssets ?? 0) / 1e9 })),
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
  const { data: yahooFallbackData } = useStockYahooFallbackFinancials(
    ticker,
    { enabled: fmpDown && financialsFetched && metrics.length === 0 },
  );
  // `hasAnyFallbackValue` gates the fallback render on the basis that a
  // valid Yahoo response always carries at least one finite number — a
  // payload of all `null` (which the server emits on total upstream
  // failure) should fall through to the existing "Metrics unavailable"
  // empty-state rather than render four dashes posing as a snapshot.
  const hasAnyFallbackValue = (
    yf?: typeof yahooFallbackData,
  ): boolean => {
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

  // Today vs previous-close delta (NOT a true post-market price — FMP free
  // tier doesn't carry after-hours quote). When a paid key/upgrade adds a
  // dedicated extended-hours field, replace this with that value.
  // Note: surfacing as "Today vs Prev Close" rather than "After Hours" so the
  // label matches the math.
  const todayVsPrevClose = useMemo(() => {
    if (!quoteData?.price || !quoteData?.previousClose) return null;
    const delta = quoteData.price - quoteData.previousClose;
    return {
      price: quoteData.price,
      delta,
      deltaPct: (delta / quoteData.previousClose) * 100,
    };
  }, [quoteData]);

  // Locale-aware earnings-date formatted via `formatEarningsDate` (en:
  // "Apr 22, 2026", he: "22 באפר 2026"). The previous `toISOString().slice(0,10)`
  // produced bare ISO "2026-04-22" which read like a YAML key to non-technical
  // users. `formatEarningsDate` also survives upstream Unix-second epoch
  // values because it routes through `parseTradeDate` (handles both halves).
  const earningsDate = useMemo(
    () => formatEarningsDate(quoteData?.earningsAnnouncement),
    [quoteData?.earningsAnnouncement],
  );

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
          <div className="flex items-center justify-center gap-4 mb-4">
            <TickerLogo ticker={ticker} size="md" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {overviewData?.companyName ?? ticker}
              </h1>
              <p className="text-sm text-muted-foreground">
                {ticker} | {overviewData?.exchange ?? "—"}
              </p>
            </div>
          </div>

          {/* Stock Price */}
          <div className="mb-3">
            {quoteLoading ? (
              <HeaderPriceSkeleton />
            ) : quoteData?.price ? (
              <div className="flex items-baseline justify-center gap-3">
                <span className="text-5xl font-bold text-foreground" dir="ltr">
                  ${quoteData.price.toFixed(2)}
                </span>
                <span className="flex items-center gap-1" dir="ltr">
                  <span
                    className={`text-lg font-semibold ${quoteData.change >= 0 ? "text-chart-green" : "text-red-400"}`}
                  >
                    {quoteData.change >= 0 ? "+" : ""}
                    {quoteData.change.toFixed(2)}
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${quoteData.changesPercentage >= 0 ? "bg-chart-green/20 text-chart-green" : "bg-red-400/20 text-red-400"}`}
                  >
                    {quoteData.changesPercentage >= 0 ? "+" : ""}
                    {quoteData.changesPercentage.toFixed(2)}%
                  </span>
                </span>
              </div>
            ) : (
              <div className="text-center text-slate-400 text-xl">{t("index.unavailableApi")}</div>
            )}
          </div>

          {/* Today vs Prev Close — fed by live quote */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span>
              {t("index.change")}{" "}
              {todayVsPrevClose ? (
                <span
                  className={todayVsPrevClose.delta >= 0 ? "text-green-400" : "text-red-400"}
                  dir="ltr"
                >
                  {todayVsPrevClose.delta >= 0 ? "+" : ""}
                  {todayVsPrevClose.delta.toFixed(2)} ({todayVsPrevClose.delta >= 0 ? "+" : ""}
                  {todayVsPrevClose.deltaPct.toFixed(2)}%)
                </span>
              ) : (
                <span className="text-slate-500" dir="ltr">—</span>
              )}
            </span>
            <span>
              {t("index.earnings")}{" "}
              {earningsDate ? (
                <span className="text-blue-400" dir="ltr">{earningsDate}</span>
              ) : (
                <span className="text-slate-500" dir="ltr">—</span>
              )}
            </span>
          </div>
        </div>

        {/* Quality Brief Section */}
        <div className="bg-card rounded-lg p-8 border border-border mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-4">{t("index.qualityInBrief")}</h2>
          <ul className="space-y-3 text-sm text-foreground">
            <li className="flex gap-2">
              <span className="text-chart-green font-bold shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: t("index.news1") }} />
            </li>
            <li className="flex gap-2">
              <span className="text-chart-green font-bold shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: t("index.news2") }} />
            </li>
          </ul>
          <button className="mt-4 text-blue-400 hover:text-blue-300 text-sm font-medium">
            {t("index.viewMore")}
          </button>
        </div>

        {/* Charts Grid - 4x2 — three render states driven by query fetch status */}
        <h2 className="text-2xl font-semibold text-foreground mb-6">
          {t("index.financialMetricsTitle")}
        </h2>
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
          ) : metrics.length === 0 ? (
            showYahooFallback && yahooFallbackData ? (
              <YahooFallbackGrid
                data={yahooFallbackData}
                chipLabel={t("index.metricsYahooFallbackChip")}
                chipTitle={t("index.metricsYahooFallbackTitle")}
                formatBillions={(n: number) => `${(n / 1e9).toFixed(2)}B`}
                formatPercent={(n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`}
                formatUSD={(n: number) => `$${n.toFixed(2)}`}
                emDash="—"
              />
            ) : (
              <div className="col-span-full bg-card border border-border rounded-xl px-6 py-10 text-center">
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
                  <p className="mt-3 text-xs text-amber-300/90 max-w-md mx-auto leading-relaxed">
                    {fmpHoursUntilReset !== null
                      ? t("index.metricsRateLimited", {
                          hours: fmpHoursUntilReset,
                        })
                      : t("index.metricsRateLimitedUnknownReset")}
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
                  className="mt-4 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {t("index.metricsRetry")}
                </button>
              </div>
            )
          ) : (
            metrics.map((metric, idx) => {
              const latestVal = metric.data[metric.data.length - 1]?.value || 0;
              const yoyChange = metric.yoy || 0;
              return (
                <InsightsCard
                  key={idx}
                  title={t(metric.name) === metric.name ? metric.name.split(".")[1] : t(metric.name)}
                  value={`${latestVal.toFixed(2)}${metric.unit === "$" ? "" : metric.unit}`}
                  badgeText={`${yoyChange >= 0 ? "+" : ""}${yoyChange.toFixed(2)}%`}
                  badgeType={yoyChange >= 0 ? "positive" : "negative"}
                  metricId={metric.name}
                  metricData={metric}
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
