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
export default function InsightsCard({ title, value, badgeText, badgeType = "neutral", metricId, metricData }: InsightsCardProps) {
  const { t } = useI18n();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getBadgeColor = () => {
    switch (badgeType) {
      case "positive": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "negative": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

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
  const pointsLabel = t("insights.card.points", { count: metricData.data.length });

  return (
    <>
      <div
        className="bg-card border border-border rounded-xl p-4 flex flex-col hover:border-slate-600 transition-colors cursor-pointer relative group"
        onClick={handleOpenModal}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
      >
        <button
          className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-white z-10"
          aria-label="Expand chart"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenModal();
          }}
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        <div className="flex flex-col mb-4">
          <span className="text-sm text-muted-foreground font-medium mb-1">{title}</span>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-foreground tracking-tight">{value}</span>
            {badgeText && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${getBadgeColor()} mb-1`} dir="ltr">
                {badgeText}
              </span>
            )}
          </div>
        </div>

        {/* Small Sparkline area chart */}
        <div className="h-16 w-full -mx-2 mt-auto">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData}>
              <defs>
                <linearGradient id={`gradient-${metricId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill={`url(#gradient-${metricId})`} strokeWidth={2} isAnimationActive={true} animationDuration={1000} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Data-span footer — replaces the misleading static "1D / 5D / 1M /
            ... / All" row. Reports the actual period range + sample count so
            users know what they're looking at. */}
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800 text-xs text-slate-500">
          <span className="truncate" dir="ltr">{dataSpanLabel ?? pointsLabel}</span>
          <span className="text-slate-400 font-medium">{pointsLabel}</span>
        </div>
      </div>

      <ChartModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        metric={metricData}
      />
    </>
  );
}
