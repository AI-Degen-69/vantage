import { useState } from "react";
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
import ChartModal from "@/components/ChartModal";
import { appleStockData, quickStats, financialMetrics, FinancialMetric } from "@/lib/mockData";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function Index() {
  const [selectedMetric, setSelectedMetric] = useState<FinancialMetric | null>(null);

  const colorMap: { [key: string]: string } = {
    "chart-green": "#00d084",
    "chart-orange": "#ff9500",
    "chart-blue": "#3b82f6",
    "chart-cyan": "#06b6d4",
    "chart-purple": "#a855f7",
    "chart-pink": "#ec4899",
  };

  const renderSmallChart = (metric: FinancialMetric) => {
    const chartColor = colorMap[metric.color] || "#3b82f6";
    const data = metric.data.slice(-8); // Last 2 years (8 quarters)

    const commonProps = {
      data,
      margin: { top: 5, right: 10, left: 0, bottom: 5 },
    };

    switch (metric.type) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  color: "#ffffff",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
                cursor={false}
              />
              <Bar dataKey="value" fill={chartColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "area":
        return (
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart {...commonProps}>
              <defs>
                <linearGradient id={`gradient-${metric.name}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  color: "#ffffff",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
                cursor={false}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                fillOpacity={1}
                fill={`url(#gradient-${metric.name})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      case "line":
      default:
        return (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  color: "#ffffff",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
                cursor={false}
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

  return (
    <div className="min-h-screen bg-background dark">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-4">
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="white">
              <circle cx="12" cy="12" r="11" fill="#333" stroke="white" strokeWidth="1.5" />
              <text x="12" y="15" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">
                A
              </text>
            </svg>
            <div>
              <h1 className="text-4xl font-bold text-foreground">Apple Inc.</h1>
              <p className="text-muted-foreground">{appleStockData.symbol}</p>
            </div>
          </div>

          {/* Stock Price Section */}
          <div className="bg-card rounded-xl p-8 border border-border">
            <div className="flex items-baseline gap-4 mb-2">
              <span className="text-5xl font-bold text-foreground">
                ${appleStockData.currentPrice.toFixed(2)}
              </span>
              <span className="text-2xl font-semibold text-chart-green">
                +${appleStockData.priceChange.toFixed(2)}
              </span>
              <span className="px-3 py-1 bg-chart-green/20 text-chart-green rounded-full text-sm font-semibold">
                +{appleStockData.percentChange.toFixed(2)}%
              </span>
            </div>
            <p className="text-muted-foreground text-sm">Earnings: Q2 2024 | Trading: NASDAQ</p>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {quickStats.map((stat, idx) => (
            <div key={idx} className="bg-card rounded-lg p-5 border border-border">
              <p className="text-sm text-muted-foreground mb-2">{stat.label}</p>
              <p className="text-2xl font-bold text-foreground mb-2">{stat.value}</p>
              {stat.change && (
                <div className="flex items-center gap-1">
                  {stat.changeType === "positive" ? (
                    <TrendingUp className="w-4 h-4 text-chart-green" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <span
                    className={
                      stat.changeType === "positive" ? "text-chart-green" : "text-red-500"
                    }
                  >
                    {stat.change} ({stat.changePercent?.toFixed(2)}%)
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {financialMetrics.map((metric, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedMetric(metric)}
              className="bg-card rounded-xl p-6 border border-border hover:border-foreground/50 cursor-pointer transition-all duration-200 hover:shadow-lg"
            >
              <h3 className="text-lg font-semibold text-foreground mb-4">{metric.name}</h3>
              <div className="h-[140px]">{renderSmallChart(metric)}</div>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Latest: {metric.data[metric.data.length - 1].value.toFixed(1)}{metric.unit}</span>
                <span className="text-xs bg-foreground/10 text-foreground px-2 py-1 rounded">
                  {metric.type === "bar" ? "Bar" : metric.type === "area" ? "Area" : "Line"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart Modal */}
      <ChartModal
        metric={selectedMetric || financialMetrics[0]}
        isOpen={selectedMetric !== null}
        onClose={() => setSelectedMetric(null)}
      />
    </div>
  );
}
