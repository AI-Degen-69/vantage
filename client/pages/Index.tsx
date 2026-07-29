import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ChartModal from "@/components/ChartModal";
import InsightsCard from "@/components/InsightsCard";
import CompanyProfile from "@/components/CompanyProfile";
import TickerLogo from "@/components/TickerLogo";
import { HeaderPriceSkeleton, MetricCardSkeleton } from "@/components/Skeleton";
import { financialMetrics, FinancialMetric } from "@/lib/mockData";
import { useStockQuote, useStockProfile, useStockFinancials } from "@/hooks/useStockData";

/**
 * Displays a localized stock overview with quote information, company details, financial metrics, and interactive charts for the selected ticker.
 */
export default function Index() {
  const { t } = useTranslation();
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

      metricsResult = [
        {
          name: "insights.revenue",
          unit: "B",
          yoy: safeYoy(incAsc, "revenue"),
          data: incAsc.map((d) => ({ date: d.calendarYear, value: d.revenue / 1e9 })),
          type: "bar",
          color: "blue",
        },
        {
          name: "insights.ebitda",
          unit: "B",
          yoy: safeYoy(incAsc, "ebitda"),
          data: incAsc.map((d) => ({ date: d.calendarYear, value: d.ebitda / 1e9 })),
          type: "bar",
          color: "blue",
        },
        {
          name: "insights.grossProfit",
          unit: "B",
          yoy: safeYoy(incAsc, "grossProfit"),
          data: incAsc.map((d) => ({ date: d.calendarYear, value: d.grossProfit / 1e9 })),
          type: "bar",
          color: "blue",
        },
        {
          name: "insights.operatingIncome",
          unit: "B",
          yoy: safeYoy(incAsc, "operatingIncome"),
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
          data: incAsc.map((d) => ({ date: d.calendarYear, value: d.netIncome / 1e9 })),
          type: "bar",
          color: "blue",
        },
        {
          name: "insights.eps",
          unit: "$",
          yoy: safeYoy(incAsc, "eps"),
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
          data: balAsc.map((d) => ({ date: d.calendarYear, value: (d.totalAssets ?? 0) / 1e9 })),
          type: "bar",
          color: "purple",
        },
      ];
    }
    return metricsResult;
  }, [financialsData]);

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

  const earningsDate = useMemo(() => {
    if (!quoteData?.earningsAnnouncement) return null;
    const d = new Date(quoteData.earningsAnnouncement);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }, [quoteData?.earningsAnnouncement]);

  const quickStats = stockData?.quickStats ?? [];
  const financialMetrics = stockData?.financialMetrics ?? [];
  const quote = stockData?.quote;
  const news = stockData?.news ?? [];

  const formatNewsDate = (datetime: number) => {
    const diff = Date.now() - datetime * 1000;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(datetime * 1000).toLocaleDateString();
  };

  const categoryColor: Record<string, string> = {
    earnings: "text-chart-green bg-chart-green/10 border-chart-green/30",
    "merger & acquisition": "text-purple-400 bg-purple-400/10 border-purple-400/30",
    "analyst": "text-blue-400 bg-blue-400/10 border-blue-400/30",
    "guidance": "text-amber-400 bg-amber-400/10 border-amber-400/30",
    "general": "text-slate-400 bg-slate-400/10 border-slate-400/30",
  };

  const getCategoryStyle = (category: string) => {
    const key = Object.keys(categoryColor).find((k) =>
      category.toLowerCase().includes(k)
    );
    return key ? categoryColor[key] : categoryColor["general"];
  };

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
            <div className="col-span-full bg-card border border-border rounded-xl px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {t("index.metricsUnavailable", { ticker })}
              </p>
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
