import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import InsightsCard from "@/components/InsightsCard";
import CompanyProfile from "@/components/CompanyProfile";
import { financialMetrics, FinancialMetric } from "@/lib/mockData";
import { useStockQuote, useStockOverview } from "@/hooks/useStockData";

export default function Index() {
  const { t } = useTranslation();
  const { ticker: urlTicker } = useParams<{ ticker?: string }>();
  const [selectedMetric, setSelectedMetric] = useState<FinancialMetric | null>(null);
  const [expandedStats, setExpandedStats] = useState<{ [key: number]: boolean }>({});

  // Use ticker from URL or default to AAPL
  const ticker = urlTicker?.toUpperCase() || "AAPL";

  // Fetch real stock data from API
  const { data: quoteData, loading: quoteLoading } = useStockQuote(ticker);
  const { data: overviewData, loading: overviewLoading } = useStockOverview(ticker);

  // Removed QuickStats and renderSmallChart functions

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
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {overviewData ? overviewData["Name"] || ticker : ticker}
              </h1>
              <p className="text-sm text-muted-foreground">{ticker} | NASDAQ</p>
            </div>
          </div>

          {/* Stock Price */}
          <div className="mb-3">
            {quoteLoading ? (
              <div className="text-center text-slate-400">{t("index.loadingPrice")}</div>
            ) : quoteData ? (
              <div className="flex items-baseline justify-center gap-3">
                <span className="text-5xl font-bold text-foreground" dir="ltr">
                  ${quoteData.price}
                </span>
                <span className="flex items-center gap-1" dir="ltr">
                  <span className={`text-lg font-semibold ${
                    typeof quoteData.change === "string"
                      ? (parseFloat(quoteData.change) >= 0 ? "text-chart-green" : "text-red-400")
                      : (quoteData.change >= 0 ? "text-chart-green" : "text-red-400")
                  }`}>
                    {typeof quoteData.change === "string" ? quoteData.change : quoteData.change}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    typeof quoteData.changePercent === "string"
                      ? (parseFloat(quoteData.changePercent) >= 0 ? "bg-chart-green/20 text-chart-green" : "bg-red-400/20 text-red-400")
                      : (quoteData.changePercent >= 0 ? "bg-chart-green/20 text-chart-green" : "bg-red-400/20 text-red-400")
                  }`}>
                    {quoteData.changePercent}%
                  </span>
                </span>
              </div>
            ) : (
              <div className="text-center text-slate-400 text-xl">{t("index.unavailableApi")}</div>
            )}
          </div>

          {/* After Hours & Earnings */}
          <div className="flex justify-center gap-6 text-sm text-muted-foreground">
            <span>{t("index.afterHours")} <span className="text-red-400" dir="ltr">$308.40</span> <span className="text-red-400" dir="ltr">-$0.42 -0.14%</span></span>
            <span>{t("index.earnings")} <span className="text-blue-400" dir="ltr">Jul 30, 2024</span></span>
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
          <button className="mt-4 text-blue-400 hover:text-blue-300 text-sm font-medium">{t("index.viewMore")}</button>
        </div>

        {/* Charts Grid - 4x2 */}
        <h2 className="text-2xl font-semibold text-foreground mb-6">{t("index.financialMetricsTitle")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {financialMetrics.slice(0, 8).map((metric, idx) => {
            const latestVal = metric.data[metric.data.length - 1].value;
            const yoyChange = metric.yoy || 0;
            return (
              <InsightsCard
                key={idx}
                title={t(metric.name)}
                value={`${latestVal.toFixed(2)}${metric.unit === "$" ? "" : metric.unit}`}
                badgeText={`${yoyChange >= 0 ? "+" : ""}${yoyChange.toFixed(2)}%`}
                badgeType={yoyChange >= 0 ? "positive" : "negative"}
                metricId={metric.name}
              />
            );
          })}
        </div>

        {/* Company Profile Section */}
        <CompanyProfile />
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
