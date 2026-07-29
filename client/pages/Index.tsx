import { useState } from "react";
import { useParams } from "react-router-dom";
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
import { ChevronDown, Loader2, ExternalLink, Newspaper } from "lucide-react";
import { useStockData, FinancialMetric } from "@/hooks/useStockData";

export default function Index() {
  const { ticker: urlTicker } = useParams<{ ticker?: string }>();
  const [selectedMetric, setSelectedMetric] = useState<FinancialMetric | null>(null);
  const [expandedStats, setExpandedStats] = useState<{ [key: number]: boolean }>({});

  const ticker = urlTicker?.toUpperCase() || "AAPL";

  const { data: stockData, isLoading, isError } = useStockData(ticker);

  const colorMap: { [key: string]: string } = {
    "chart-green": "#00d084",
    "chart-orange": "#ff9500",
    "chart-blue": "#3b82f6",
    "chart-cyan": "#06b6d4",
    "chart-purple": "#a855f7",
    "chart-pink": "#ec4899",
  };

  const toggleStatExpand = (idx: number) => {
    setExpandedStats((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const renderSmallChart = (metric: FinancialMetric) => {
    const chartColor = colorMap[metric.color] || "#3b82f6";
    const data = metric.data.slice(-8);

    if (data.length === 0 || data.every((d) => d.value === 0)) {
      return (
        <div className="h-[140px] flex items-center justify-center text-muted-foreground text-sm">
          No data available
        </div>
      );
    }

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
                fill={chartColor}
                fillOpacity={0.2}
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
            <img
              src={`/api/company-logo?ticker=${ticker}`}
              alt={`${ticker} logo`}
              className="w-12 h-12 rounded-md"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {stockData?.name || ticker}
              </h1>
              <p className="text-sm text-muted-foreground">
                {ticker}
                {stockData?.exchange ? ` | ${stockData.exchange}` : ""}
                {stockData?.profile?.sector ? ` | ${stockData.profile.sector}` : ""}
              </p>
            </div>
          </div>

          {/* Stock Price */}
          <div className="mb-3">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading real-time data...</span>
              </div>
            ) : quote && quote.price != null ? (
              <div className="flex items-baseline justify-center gap-3">
                <span className="text-5xl font-bold text-foreground">
                  ${typeof quote.price === "number" ? quote.price.toFixed(2) : quote.price}
                </span>
                <span className="flex items-center gap-1">
                  {quote.change != null && (
                    <span
                      className={`text-lg font-semibold ${
                        quote.change >= 0 ? "text-chart-green" : "text-red-400"
                      }`}
                    >
                      {quote.change >= 0 ? "+" : ""}
                      {typeof quote.change === "number" ? quote.change.toFixed(2) : quote.change}
                    </span>
                  )}
                  {quote.changePercent != null && (
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        quote.changePercent >= 0
                          ? "bg-chart-green/20 text-chart-green"
                          : "bg-red-400/20 text-red-400"
                      }`}
                    >
                      {quote.changePercent >= 0 ? "+" : ""}
                      {typeof quote.changePercent === "number"
                        ? quote.changePercent.toFixed(2)
                        : quote.changePercent}
                      %
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <div className="text-center text-slate-400 text-xl">
                {isError ? "Failed to load data" : "Unavailable via API"}
              </div>
            )}
          </div>

          {/* After Hours & Price Changes */}
          <div className="flex justify-center gap-6 text-sm text-muted-foreground">
            {quote?.afterHoursPrice != null && (
              <span>
                After hours:{" "}
                <span
                  className={
                    quote.afterHoursChange != null && quote.afterHoursChange >= 0
                      ? "text-chart-green"
                      : "text-red-400"
                  }
                >
                  ${quote.afterHoursPrice.toFixed(2)}
                </span>
                {quote.afterHoursChange != null && (
                  <span
                    className={
                      quote.afterHoursChange >= 0 ? "text-chart-green" : "text-red-400"
                    }
                  >
                    {" "}
                    {quote.afterHoursChange >= 0 ? "+" : ""}
                    {quote.afterHoursChange.toFixed(2)}
                    {quote.afterHoursChangePercent != null
                      ? ` ${quote.afterHoursChangePercent >= 0 ? "+" : ""}${quote.afterHoursChangePercent.toFixed(2)}%`
                      : ""}
                  </span>
                )}
              </span>
            )}
            {stockData?.priceChange && (
              <>
                {stockData.priceChange.ytd != null && (
                  <span>
                    YTD:{" "}
                    <span
                      className={
                        stockData.priceChange.ytd >= 0 ? "text-chart-green" : "text-red-400"
                      }
                    >
                      {stockData.priceChange.ytd >= 0 ? "+" : ""}
                      {stockData.priceChange.ytd.toFixed(2)}%
                    </span>
                  </span>
                )}
                {stockData.priceChange["1Y"] != null && (
                  <span>
                    1Y:{" "}
                    <span
                      className={
                        stockData.priceChange["1Y"] >= 0 ? "text-chart-green" : "text-red-400"
                      }
                    >
                      {stockData.priceChange["1Y"] >= 0 ? "+" : ""}
                      {stockData.priceChange["1Y"].toFixed(2)}%
                    </span>
                  </span>
                )}
                {stockData.priceChange["3Y"] != null && (
                  <span>
                    3Y:{" "}
                    <span
                      className={
                        stockData.priceChange["3Y"] >= 0 ? "text-chart-green" : "text-red-400"
                      }
                    >
                      {stockData.priceChange["3Y"] >= 0 ? "+" : ""}
                      {stockData.priceChange["3Y"].toFixed(2)}%
                    </span>
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Company Description */}
        {stockData?.profile?.description && (
          <div className="bg-card rounded-lg p-8 border border-border mb-12">
            <h2 className="text-xl font-semibold text-foreground mb-4">Company Overview</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {stockData.profile.description}
            </p>
            {stockData.profile.website && (
              <a
                href={stockData.profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-blue-400 hover:text-blue-300 text-sm font-medium"
              >
                Visit website →
              </a>
            )}
          </div>
        )}

        {/* Company News */}
        <div className="bg-card rounded-lg p-6 border border-border mb-12">
          <div className="flex items-center gap-2 mb-5">
            <Newspaper className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-semibold text-foreground">Latest News</h2>
            {news.length > 0 && (
              <span className="text-xs text-muted-foreground ml-auto">
                {news.length} articles • Finnhub
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted/50 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : news.length > 0 ? (
              <div className="space-y-1">
                {news.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 -mx-3 rounded-lg hover:bg-secondary/50 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      {item.image && (
                        <img
                          src={item.image}
                          alt=""
                          className="w-16 h-16 rounded-md object-cover flex-shrink-0 border border-border"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                          loading="lazy"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getCategoryStyle(
                              item.category
                            )}`}
                          >
                            {item.category}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {item.source}
                          </span>
                          <span className="text-[11px] text-muted-foreground ml-auto flex-shrink-0">
                            {formatNewsDate(item.datetime)}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-foreground group-hover:text-blue-400 transition-colors leading-snug">
                          {item.headline}
                        </p>
                        {item.summary && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {item.summary}
                          </p>
                        )}
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </a>
                ))}
              </div>
            ) : (
            <p className="text-sm text-muted-foreground py-4">
              No recent news available for {ticker}.
            </p>
          )}
        </div>

        {/* Quick Stats Section */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-lg border border-border p-4 animate-pulse"
              >
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-6 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {quickStats.map((stat, idx) => (
              <div key={idx} className="bg-card rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => toggleStatExpand(idx)}
                  className="w-full p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
                >
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                    <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-muted-foreground transition-transform ${
                      expandedStats[idx] ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {expandedStats[idx] && stat.details && (
                  <div className="border-t border-border bg-secondary/30 p-4 space-y-2">
                    {stat.details.map((detail, dIdx) => (
                      <div key={dIdx} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{detail.label}</span>
                        <span className="text-foreground font-medium">{detail.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Charts Grid */}
        <h2 className="text-2xl font-semibold text-foreground mb-6">Financial Metrics</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-lg p-6 border border-border animate-pulse"
              >
                <div className="h-5 bg-muted rounded w-1/2 mb-4" />
                <div className="h-[140px] bg-muted/50 rounded" />
              </div>
            ))}
          </div>
        ) : financialMetrics.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {financialMetrics.map((metric, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedMetric(metric)}
                className="bg-card rounded-lg p-6 border border-border hover:border-foreground/50 cursor-pointer transition-all duration-200 hover:shadow-lg"
              >
                <h3 className="text-lg font-semibold text-foreground mb-4">{metric.name}</h3>
                <div className="h-[140px]">{renderSmallChart(metric)}</div>
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Latest:{" "}
                    {metric.data.length > 0
                      ? `${metric.data[metric.data.length - 1].value.toFixed(1)}${metric.unit}`
                      : "—"}
                  </span>
                  <span className="text-xs bg-foreground/10 text-foreground px-2 py-1 rounded">
                    {metric.type === "bar" ? "Bar" : metric.type === "area" ? "Area" : "Line"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No financial statement data available. (FMP free tier may be exhausted — 250 req/day limit)
          </div>
        )}
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
