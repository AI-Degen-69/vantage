import { useState } from "react";
import { Maximize2 } from "lucide-react";
import ChartModal from "./ChartModal";
import { FinancialMetric } from "@/lib/mockData";
import { useI18n } from "@/lib/i18n";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

interface InsightsCardProps {
  title: string;
  value: string;
  badgeText?: string;
  badgeType?: "positive" | "negative" | "neutral";
  metricId: string; // Refers to the financialMetric name to pull historical data
  metricData: FinancialMetric; // The actual metric data with historical series
  ticker?: string;
}

/**
 * Displays a financial metric card with its current value, trend badge, sparkline, and detailed chart modal.
 *
 * @param title - The metric title displayed on the card
 * @param value - The current metric value displayed on the card
 * @param badgeText - Optional text displayed alongside the metric value
 * @param badgeType - The badge style indicating a positive, negative, or neutral trend
 * @param metricId - Identifies the metric whose historical data is displayed
 * @param metricData - The metric's historical data for sparkline and chart modal
 */
export default function InsightsCard({
  title,
  value,
  badgeText,
  badgeType = "neutral",
  metricId,
  metricData,
  ticker,
}: InsightsCardProps) {
  const { t } = useI18n();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getBadgeColor = () => {
    switch (badgeType) {
      case "positive":
        return "bg-chart-positive/10 text-chart-positive border-chart-positive/30";
      case "negative":
        return "bg-chart-negative/10 text-chart-negative border-chart-negative/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  // Light-curve stroke tracks the metric's trend direction — Aurora Green
  // for growth, Ember Red for decline, Starlight Gold when flat/unknown.
  // See DESIGN.md: The Instrument, Not Alarm Rule.
  const lineColor =
    badgeType === "positive"
      ? "hsl(155 55% 50%)"
      : badgeType === "negative"
        ? "hsl(6 70% 58%)"
        : "hsl(42 65% 70%)";

  const handleOpenModal = () => setIsModalOpen(true);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleOpenModal();
    }
  };

  // Extract a small sparkline dataset (last 20 items)
  const sparklineData = metricData.data.slice(-20);

  // Compute the real visible window for the footer strip — first / last date
  // labels from the underlying series, NOT a hardcoded "1D/5D/1M/…/All"
  // string row that looks like a timeframe toggle but does nothing on click.
  const firstDate = metricData.data[0]?.date;
  const lastDate = metricData.data[metricData.data.length - 1]?.date;
  const dataSpanLabel =
    firstDate && lastDate
      ? t("insights.card.dataSpan", { first: firstDate, last: lastDate })
      : null;
  const pointsLabel = t("insights.card.points", {
    count: metricData.data.length,
  });

  return (
    <>
      <div
        className="bg-card border border-border rounded-panel p-4 flex flex-col hover:border-primary/40 transition-all cursor-pointer relative group"
        onClick={handleOpenModal}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
      >
        <button
          className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary z-10"
          aria-label="Expand chart"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenModal();
          }}
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        <div className="flex flex-col mb-4">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
            {title}
          </span>
          <div className="flex items-end gap-3">
            <span className="text-2xl font-semibold text-foreground font-mono tabular-nums tracking-tight">
              {value}
            </span>
            {badgeText && (
              <span
                className={`text-xs font-semibold font-mono tabular-nums px-2 py-0.5 rounded border whitespace-nowrap ${getBadgeColor()} mb-1`}
                dir="ltr"
              >
                {badgeText}
              </span>
            )}
          </div>
        </div>

        {/* Light-curve sparkline — a thin traced line against the panel's
            own graticule, not a filled gradient blob. Glow is earned by
            being the metric's own data line (DESIGN.md: Earned Glow Rule). */}
        <div
          className="h-16 w-full -mx-2 mt-auto"
          style={{ filter: `drop-shadow(0 0 3px ${lineColor}80)` }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData}>
              <defs>
                <linearGradient
                  id={`gradient-${metricId}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={lineColor} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={lineColor}
                fillOpacity={1}
                fill={`url(#gradient-${metricId})`}
                strokeWidth={1.5}
                isAnimationActive={true}
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Data-span footer — replaces the misleading static "1D / 5D / 1M /
            ... / All" row. Reports the actual period range + sample count so
            users know what they're looking at. */}
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-border text-xs text-muted-foreground font-mono">
          <span className="truncate" dir="ltr">
            {dataSpanLabel ?? pointsLabel}
          </span>
          <span className="text-muted-foreground font-medium">
            {pointsLabel}
          </span>
        </div>
      </div>

      <ChartModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        metric={metricData}
        ticker={ticker}
      />
    </>
  );
}
