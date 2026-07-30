import { useEffect, useState } from "react";
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

interface ChartModalProps {
  metric: FinancialMetric;
  isOpen: boolean;
  onClose: () => void;
  ticker?: string;
}

type TimeframeType = "1Y" | "3Y" | "5Y";

/**
 * Displays a modal containing a selectable timeframe chart and optional growth metrics for a financial metric.
 *
 * @param metric - The financial metric whose data and growth values are displayed.
 * @param isOpen - Whether the modal is visible.
 * @param onClose - Callback invoked when the modal is closed.
 * @param ticker - The company ticker used for the logo and modal header.
 */
export default function ChartModal({ metric, isOpen, onClose, ticker = "AAPL" }: ChartModalProps) {
  const { t } = useI18n();
  const [timeframe, setTimeframe] = useState<TimeframeType>("1Y");
  const [filteredData, setFilteredData] = useState(metric.data);

  useEffect(() => {
    if (!isOpen) return;
    
    const quarterCount = timeframe === "1Y" ? 4 : timeframe === "3Y" ? 12 : 20;
    const filtered = metric.data.slice(-quarterCount);
    setFilteredData(filtered);
  }, [timeframe, metric, isOpen]);

  if (!isOpen) return null;

  const handleDownload = () => {
    const csv = ["Date,Value", ...filteredData.map(d => `${d.date},${d.value}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${metric.name}.csv`;
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

        {/* Timeframe Selector and Download */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-secondary/30">
          <div className="flex gap-2">
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
                  value: metric.yoy,
                  description: t("chart.descYoY")
                },
                {
                  label: t("chart.cagr3Y"),
                  value: metric.cagr3Y,
                  description: t("chart.descCagr3Y")
                },
                {
                  label: t("chart.cagr5Y"),
                  value: metric.cagr5Y,
                  description: t("chart.descCagr5Y")
                },
              ].map((item, idx) => (
                <div key={idx} className="text-center group cursor-help">
                  <p className="text-sm text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-2xl font-semibold text-chart-green" dir="ltr">
                    {item.value ? `${item.value.toFixed(2)}%` : "-"}
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
