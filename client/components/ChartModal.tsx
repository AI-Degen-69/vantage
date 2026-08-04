import { useEffect, useMemo, useState } from "react";
import { X, Download } from "lucide-react";
import TickerLogo from "@/components/TickerLogo";
import { useI18n } from "@/lib/i18n";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { FinancialMetric } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import {
  cagrAtYearsBack,
  detectPeriodGranularity,
  metricStatementKey,
  projectMetricSeries,
} from "@/lib/finance";
import { useStockFinancials } from "@/hooks/useStockData";

interface ChartModalProps {
  metric: FinancialMetric;
  isOpen: boolean;
  onClose: () => void;
  ticker?: string;
}

type TimeframeType = "1Y" | "3Y" | "5Y";
type Granularity = "annual" | "quarter";

/**
 * Granularity toggle reads as `Quarterly | Yearly` (Q | Y). When Q is
 * active we re-fetch `/api/stock-financials?period=quarter` so each bar
 * is one FMP quarter (e.g. Q1 2025, Q2 2025, ...) and CAGR windows walk
 * back 4 / 12 / 20 rows — flipped cardinality vs. the annual path so
 * the 5Y badge means "20 quarters of growth, annualized".
 *
 * The metric passed in from `Index.tsx` is built from the annual
 * payload, so we recompute the (date, value) series from the matching
 * `useStockFinancials(ticker, { period })` response and ignore the
 * pre-built `metric.data` whenever quarter mode is on; the annual path
 * keeps `metric.data` untouched (no extra fetch, no flicker).
 */
export default function ChartModal({ metric, isOpen, onClose, ticker = "AAPL" }: ChartModalProps) {
  const { t } = useI18n();
  const [timeframe, setTimeframe] = useState<TimeframeType>("1Y");
  const [granularity, setGranularity] = useState<Granularity>("annual");

  // Quarterly fetch only kicks in when needed; the hook is still safe to
  // call unconditionally because it disables on `!ticker`, but skipping
  // the request on the default annual render keeps the FMP budget lower
  // (the free tier is already at 5-statement-rows max).
  const {
    data: quarterlyStatements,
    dataUpdatedAt: quarterlyUpdatedAt,
  } = useStockFinancials(ticker, { period: "quarter" });

  // Series used by the chart. Annual = pre-built points from Index.tsx.
  // Quarterly = freshly projected from the Q-fetch. Recomputed only when
  // the period switches or the quarterly payload lands — keeps the
  // "switching tabs doesn't refetch the same 20 bars" guarantee.
  const filteredData = useMemo(() => {
    if (granularity === "quarter") {
      const series = metricStatementKey(metric.name)
        ? projectMetricSeries(metric.name, quarterlyStatements ?? { income: [], balance: [], cash: [] })
        : [];
      // 1Y = 4Q, 3Y = 12Q, 5Y = 20Q — quarter-stride back per year.
      const quarterCount = timeframe === "1Y" ? 4 : timeframe === "3Y" ? 12 : 20;
      return series.slice(-quarterCount);
    }
    // Annual path: scale the 1/3/5-year window off the precomputed
    // `metric.data` (which already covers ~5 FY). Year-stride back.
    const yearCount = timeframe === "1Y" ? 1 : timeframe === "3Y" ? 3 : 5;
    return metric.data.slice(-yearCount);
  // `quarterlyUpdatedAt` deliberately included so the chart re-projects
  // when the Q-fetch lands without us having to share a `data` identity
  // that's freshly-built per render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity, timeframe, metric, quarterlyStatements, quarterlyUpdatedAt]);

  // Drive live CAGR/YoY numbers off the projected series so they flip
  // when the user toggles Q ↔ Y. `detectPeriodGranularity` peeks at the
  // most-recent row's `period` label so a Q* string picks the quarterly
  // stride automatically.
  const liveGrowth = useMemo(() => {
    const statements = granularity === "quarter"
      ? quarterlyStatements ?? { income: [], balance: [], cash: [] }
      : null;
    const seriesInfo = statements
      ? { granularity: detectPeriodGranularity(statements.income), statements }
      : null;
    if (!seriesInfo) {
      // Annual path — read the precomputed CAGR off the metric object
      // (Index.tsx computed it from the same ascending annual series).
      return {
        yoy: metric.yoy,
        cagr3Y: metric.cagr3Y,
        cagr5Y: metric.cagr5Y,
        methodology: "annual",
      } as const;
    }
    // Quarter path — recompute from the quarterly rows. `cagrAtYearsBack`
    // accepts either the ascending `income` slice or the period-auto
    // granularity; both routes converge here. The `unknown`-double-cast
    // isolates a single seam that bridges `IncomeStatementRow[]
    // (which lacks an index signature) into the permissive shapes the
    // helpers need — keeps the rest of the file narrow and the cast
    // auditable in exactly one place.
    const rows = statements.income as unknown as ReadonlyArray<Record<string, unknown>>;
    const meta = metricStatementKey(metric.name);
    if (!meta) {
      return { yoy: null, cagr3Y: null, cagr5Y: null, methodology: "quarter" } as const;
    }
    return {
      yoy: computeYoYFromRows(rows, meta.key),
      cagr3Y: cagrAtYearsBack(rows, meta.key, 3, "quarter"),
      cagr5Y: cagrAtYearsBack(rows, meta.key, 5, "quarter"),
      methodology: "quarter",
    } as const;
  }, [granularity, quarterlyStatements, metric, quarterlyUpdatedAt]);

  // Reset toggle + timeframe when the modal closes / reopens so the next
  // open starts at the default annual 1Y. Without this a user who
  // closed the modal on "Quarterly · 5Y" would see "—" everywhere else
  // unexpectedly.
  useEffect(() => {
    if (!isOpen) {
      setGranularity("annual");
      setTimeframe("1Y");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownload = () => {
    const csv = ["Date,Value", ...filteredData.map(d => `${d.date},${d.value}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${metric.name}${granularity === "quarter" ? "_quarterly" : "_annual"}.csv`;
    a.click();
  };

  const colorMap: { [key: string]: string } = {
    "chart-green": "#00d084",
    "chart-orange": "#ff9500",
    "chart-blue": "#3b82f6",
    "chart-cyan": "#06b6d4",
    "chart-purple": "#a855f7",
    "chart-pink": "#ec4899",
  };

  const chartColor = colorMap[metric.color] || "#3b82f6";

  const renderChart = () => {
    const commonProps = {
      data: filteredData,
      margin: { top: 20, right: 30, left: 20, bottom: 20 },
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg text-xs text-white shadow-lg text-left rtl:text-right">
            <p className="text-gray-400 mb-2" dir="ltr">{label}</p>
            <p className="font-bold text-lg flex gap-1" style={{ color: chartColor }}>
              <span>{t(metric.name)}:</span>
              <span dir="ltr">
                {payload[0].value.toFixed(2)}{metric.unit}
              </span>
            </p>
          </div>
        );
      }
      return null;
    };

    switch (metric.type) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart {...commonProps}>
              <defs>
                <linearGradient id={`colorValue-bar-${metric.name}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0.2}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Bar dataKey="value" fill={`url(#colorValue-bar-${metric.name})`} radius={[8, 8, 0, 0]} isAnimationActive={true} animationDuration={1000} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "area":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart {...commonProps}>
              <defs>
                <linearGradient id={`colorValue-area-${metric.name}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                fill={`url(#colorValue-area-${metric.name})`}
                fillOpacity={1}
                isAnimationActive={true}
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      case "line":
      default:
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                dot={false}
                strokeWidth={2}
                isAnimationActive={true}
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        );
    }
  };

  const showGrowthMetrics = timeframe !== "1Y";

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card">
          <div className="flex items-center gap-3">
            <TickerLogo ticker={ticker} size="sm" />
            <div>
              <h2 className="text-xl font-semibold text-foreground">{t(metric.name)}</h2>
              <p className="text-sm text-muted-foreground">{ticker}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeframe + Granularity selector and Download */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-secondary/30 gap-2 flex-wrap">
          <div className="flex gap-2" role="tablist" aria-label={t("chart.granularity")}>
            <div className="flex" role="tablist" aria-label={t("chart.timeframe")}>
              {["1Y", "3Y", "5Y"].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf as TimeframeType)}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-all",
                    timeframe === tf
                      ? "bg-blue-600 text-white"
                      : "bg-secondary text-foreground hover:bg-secondary/80"
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>
            <div className="flex border border-border rounded-lg overflow-hidden ms-2">
              <button
                onClick={() => setGranularity("annual")}
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-all",
                  granularity === "annual"
                    ? "bg-blue-600 text-white"
                    : "bg-transparent text-foreground hover:bg-secondary/80"
                )}
                title={t("chart.annualHint")}
              >
                {t("chart.yearly")}
              </button>
              <button
                onClick={() => setGranularity("quarter")}
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-all",
                  granularity === "quarter"
                    ? "bg-blue-600 text-white"
                    : "bg-transparent text-foreground hover:bg-secondary/80"
                )}
                title={t("chart.quarterlyHint")}
              >
                {t("chart.quarterly")}
              </button>
            </div>
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>{t("chart.download")}</span>
          </button>
        </div>

        {/* Chart */}
        <div className="p-6">{renderChart()}</div>

        {/* Growth Metrics */}
        {showGrowthMetrics && (
          <div className="border-t border-border bg-secondary/30">
            <div className="grid grid-cols-3 gap-4 p-6">
              {[
                {
                  label: t("chart.yoy1Y"),
                  value: liveGrowth.yoy,
                  description: granularity === "quarter" ? t("chart.descYoYQuarter") : t("chart.descYoY")
                },
                {
                  label: t("chart.cagr3Y"),
                  value: liveGrowth.cagr3Y,
                  description: granularity === "quarter" ? t("chart.descCagr3YQuarter") : t("chart.descCagr3Y")
                },
                {
                  label: t("chart.cagr5Y"),
                  value: liveGrowth.cagr5Y,
                  description: granularity === "quarter" ? t("chart.descCagr5YQuarter") : t("chart.descCagr5Y")
                },
              ].map((item, idx) => (
                <div key={idx} className="text-center group cursor-help">
                  <p className="text-sm text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-2xl font-semibold text-chart-green" dir="ltr">
                    {item.value !== null && item.value !== undefined
                      ? `${Number(item.value).toFixed(2)}%`
                      : "-"}
                  </p>
                  <div className="mt-2 invisible group-hover:visible text-xs text-muted-foreground bg-card p-2 rounded absolute z-10 w-max border border-border">
                    {item.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Quarter-over-prior-quarter YoY helper. We expose it locally (not in
 * finance.ts) because it's only consumed here; adding it to finance.ts
 * would tempt future readers to use it for annual series and miss the
 * "same-quarter-prior-year" vs "consecutive-period" distinction.
 *
 * Strategy: walk the ascending series back 4 rows so the trailing-edge
 * comparison aligns the bar to the same calendar quarter (Q2 2025 vs
 * Q2 2024) — that mirrors how research desks talk about quarterly
 *
 * Q-o-Q growth, not "Q1→Q2 sequential". Returns `null` if the series is
 * too short or either endpoint is non-positive/non-finite so the modal
 * badge renders "-" instead of an integer "-" / undefined mismatch.
 */
function computeYoYFromRows(rows: ReadonlyArray<Record<string, unknown>>, key: string): number | null {
  if (!Array.isArray(rows) || rows.length < 5) return null;
  const last = Number(rows[rows.length - 1][key]);
  const priorYearSameQuarter = Number(rows[rows.length - 5][key]);
  if (!Number.isFinite(last) || !Number.isFinite(priorYearSameQuarter)) return null;
  if (Math.abs(priorYearSameQuarter) === 0) return null;
  return ((last - priorYearSameQuarter) / Math.abs(priorYearSameQuarter)) * 100;
}

/**
 * Type-safe adapter around `cagrAtYearsBack` that accepts the typed
 * `IncomeStatementRow[]` from `useStockFinancials` directly. The
 * underlying helper needs to look up arbitrary `key` values off each
 * row, but the shared API's row interfaces intentionally omit an index
 * signature so TS refuses to widen them through `unknown`. The
 * `unknown`-double-cast here is the seam; it lives in exactly one place
 * so a future contributor who wants a stronger contract can tighten it
 * without hunting through caller code.
 */
function quarterCagr(
  rows: ReadonlyArray<Record<string, unknown>> | undefined,
  key: string,
  years: number,
): number | null {
  return cagrAtYearsBack(
    rows as unknown as ReadonlyArray<Record<string, unknown>>,
    key,
    years,
    "quarter",
  );
}
