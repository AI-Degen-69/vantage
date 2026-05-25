import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
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
  Legend,
} from "recharts";
import { FinancialMetric } from "@/lib/mockData";
import { cn } from "@/lib/utils";

interface ChartModalProps {
  metric: FinancialMetric;
  isOpen: boolean;
  onClose: () => void;
}

type TimeframeType = "1Y" | "3Y" | "5Y";

export default function ChartModal({ metric, isOpen, onClose }: ChartModalProps) {
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
      margin: { top: 5, right: 30, left: 0, bottom: 5 },
    };

    switch (metric.type) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  color: "#ffffff",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="value" fill={chartColor} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "area":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  color: "#ffffff",
                  borderRadius: "8px",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                fill={chartColor}
                fillOpacity={0.2}
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
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  color: "#ffffff",
                  borderRadius: "8px",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                dot={false}
                strokeWidth={2}
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
            <img
              src="/api/company-logo?ticker=AAPL"
              alt="Apple Inc. logo"
              className="w-8 h-8 rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div>
              <h2 className="text-xl font-semibold text-foreground">{metric.name}</h2>
              <p className="text-sm text-muted-foreground">Apple Inc.</p>
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
            <span>Download</span>
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
                  label: "1Y (YoY)",
                  value: metric.yoy,
                  description: "Year-over-year growth: absolute change in the most recent 12-month period"
                },
                {
                  label: "3Y (CAGR)",
                  value: metric.cagr3Y,
                  description: "Compound annual growth rate: annualized average growth over 3 years"
                },
                {
                  label: "5Y (CAGR)",
                  value: metric.cagr5Y,
                  description: "Compound annual growth rate: annualized average growth over 5 years"
                },
              ].map((item, idx) => (
                <div key={idx} className="text-center group cursor-help">
                  <p className="text-sm text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-2xl font-semibold text-chart-green">
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
