import { useI18n } from "@/lib/i18n";
import {
  useStockProfile,
  useStockAnalyst,
  useStockInsider,
  useStockNews,
  useStockMetrics,
} from "@/hooks/useStockData";
import {
  mockCompanyProfile,
  mockAnalystEstimates,
  mockInsiderTrades,
  mockNews,
  mockEmployeeCount,
} from "@/lib/mockData";
import { formatTradeDateLocale, parseTradeDateMs } from "@/lib/finance";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { SectionCardSkeleton } from "@/components/Skeleton";

/**
 * Renders a company profile and insights page for a stock ticker.
 *
 * @param ticker - The stock ticker to display; defaults to `AAPL`.
 * @returns The company profile page, loading skeleton, or mock-backed profile content.
 */
export default function CompanyProfile({ ticker = "AAPL" }: { ticker?: string }) {
  const { t } = useI18n();

  const { data: overviewData, isLoading: overviewLoading } = useStockProfile(ticker);
  const { data: analystData } = useStockAnalyst(ticker);
  const { data: insiderData } = useStockInsider(ticker);
  const { data: newsData } = useStockNews(ticker);
  const { data: metricsData } = useStockMetrics(ticker);

  const description =
    overviewData?.description ||
    mockCompanyProfile.description.replace("Apple Inc.", `${ticker} Corporation`);
  const sector = overviewData?.sector || mockCompanyProfile.sector;
  const industry = overviewData?.industry || mockCompanyProfile.industry;
  const ceo = overviewData?.ceo || mockCompanyProfile.ceo;
  const beta = overviewData?.beta ?? mockCompanyProfile.beta;

  const employees =
    typeof overviewData?.fullTimeEmployees === "number"
      ? overviewData.fullTimeEmployees
      : mockCompanyProfile.employees;

  // Fix: previously displayed peRatio under "Piotroski Score / 9". Use the real
  // piotroskiScore from FMP financial-scores when available; otherwise fall
  // back to peRatio but render the correct label.
  const piotroskiScore = metricsData?.scores?.piotroskiScore ?? null;
  const peRatio = overviewData?.peRatio ?? null;
  const piotroskiDisplayValue =
    piotroskiScore !== null ? `${piotroskiScore} / 9` : peRatio !== null ? peRatio.toFixed(2) : "—";
  const piotroskiLabelKey =
    piotroskiScore !== null ? "insights.piotroskiScore" : "metrics.pe";

  const translatePeriod = (period: string) => {
    if (period === "0q" || period === "Current Qtr") return t("insights.currentQtr");
    if (period === "0y" || period === "Current Year") return t("insights.currentYear");
    if (period === "+1y" || period === "Next Year") return t("insights.nextYear");
    return period;
  };

  // ---- News mapping (handles Yahoo v4 flat shape AND legacy content-wrapped shape) ----
  const news =
    newsData && newsData.length > 0
      ? newsData.map((n) => ({
          headline: n.title,
          publisher: n.publisher,
          // formatTradeDateLocale handles unix-seconds + unparseable gracefully;
          // null result → "Recent" so the row still has a sensible label.
          timestamp: n.providerPublishTime
            ? formatTradeDateLocale(n.providerPublishTime) ?? "Recent"
            : "Recent",
          url: n.link || "#",
        }))
      : mockNews;
  const isNewsMock = !newsData || newsData.length === 0;

  // ---- Insider mapping (Yahoo raw: shares/value come as {raw, fmt} objects) ----
  // Sort on the RAW upstream `startDate` (string|number) BEFORE mapping to
  // a render shape. Sorting the rendered locale-formatted string would be
  // fragile — browsers don't all re-parse every locale output via Date.parse.
  const insiders =
    insiderData && insiderData.length > 0
      ? [...insiderData]
          .sort((a, b) => parseTradeDateMs(b.startDate) - parseTradeDateMs(a.startDate))
          .map((i) => ({
            name: i.filerName,
            // formatTradeDateLocale accepts both unix-seconds and ISO; null
            // is rendered as "—" rather than "Invalid Date" or "1/1/1970".
            date: formatTradeDateLocale(i.startDate) ?? "—",
            type: i.transactionText,
            price: i.price,
            transacted: i.shares,
            value: i.value,
          }))
      : [...mockInsiderTrades].sort(
          (a, b) => parseTradeDateMs(b.date) - parseTradeDateMs(a.date)
        );
  const isInsiderMock = !insiderData || insiderData.length === 0;

  // ---- Analyst trends (normalized upstream: earningsEstimate.avg is plain number) ----
  let epsEstimates = mockAnalystEstimates.filter((e) => e.metric === "EPS");
  let revEstimates = mockAnalystEstimates.filter((e) => e.metric === "Revenue");
  let isAnalystMock = true;

  if (analystData && analystData.length > 0) {
    isAnalystMock = false;
    epsEstimates = [];
    revEstimates = [];
    analystData.forEach((trend) => {
      if (trend.period === "0q" || trend.period === "0y" || trend.period === "+1y") {
        if (trend.earningsEstimate) {
          epsEstimates.push({
            metric: "EPS",
            period: trend.period as never,
            avg: trend.earningsEstimate.avg ?? 0,
            low: trend.earningsEstimate.low ?? 0,
            high: trend.earningsEstimate.high ?? 0,
          });
        }
        if (trend.revenueEstimate) {
          revEstimates.push({
            metric: "Revenue",
            period: trend.period as never,
            avg: (trend.revenueEstimate.avg ?? 0) / 1e9,
            low: (trend.revenueEstimate.low ?? 0) / 1e9,
            high: (trend.revenueEstimate.high ?? 0) / 1e9,
          });
        }
      }
    });
  }

  // Employee-count historical series is rarely free-Tier-available — keep as MOCK.
  const employeeCount = mockEmployeeCount;
  const isEmployeeMock = true;

  const isProfileMock = !overviewData && !overviewLoading;

  if (overviewLoading) {
    return (
      <div className="space-y-6 mt-8">
        <SkeletonHeader />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1 lg:col-span-2 space-y-6">
            <SectionCardSkeleton height={120} />
            <SectionCardSkeleton height={260} />
          </div>
          <div className="space-y-6">
            <SectionCardSkeleton height={220} />
            <SectionCardSkeleton height={220} />
            <SectionCardSkeleton height={220} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-8">
      <h2 className="text-2xl font-bold text-foreground">
        {t("insights.companyProfile")}
        {isProfileMock && (
          <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded ml-2 align-middle">
            [MOCK]
          </span>
        )}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Details & Description */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">{description}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-2">
              <KV label={t("insights.ceo")} value={ceo} />
              <KV label={t("insights.sector")} value={sector} />
              <KV label={t("insights.industry")} value={industry} />
              <KV
                label={t("insights.employees")}
                value={typeof employees === "number" ? employees.toLocaleString() : String(employees)}
              />
              <KV label={t("insights.beta")} value={beta !== null ? beta.toFixed(2) : "—"} />
              <KV
                label={t(piotroskiLabelKey)}
                value={piotroskiDisplayValue}
                accentClass="text-green-400"
              />
            </div>

            {(overviewData?.cik ||
              overviewData?.isin ||
              overviewData?.cusip ||
              overviewData?.ipoDate ||
              overviewData?.lastDividend !== undefined ||
              overviewData?.exchangeFullName ||
              overviewData?.isEtf ||
              overviewData?.isFund ||
              overviewData?.isAdr ||
              overviewData?.isActivelyTrading !== undefined) && (
              <div className="mt-6 pt-4 border-t border-border">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-3">
                  {t("insights.idChips")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {overviewData?.cik && (
                    <Chip label={t("insights.cik")} value={overviewData.cik} />
                  )}
                  {overviewData?.isin && (
                    <Chip label={t("insights.isin")} value={overviewData.isin} />
                  )}
                  {overviewData?.cusip && (
                    <Chip label={t("insights.cusip")} value={overviewData.cusip} />
                  )}
                  {overviewData?.ipoDate && (
                    <Chip label={t("insights.ipoDate")} value={overviewData.ipoDate} />
                  )}
                  {overviewData?.exchangeFullName && (
                    <Chip
                      label={t("insights.exchangeDescription")}
                      value={overviewData.exchangeFullName}
                    />
                  )}
                  {overviewData?.lastDividend !== undefined && (
                    <Chip
                      label={t("insights.lastDividend")}
                      value={`$${overviewData.lastDividend.toFixed(2)}`}
                      tone="success"
                    />
                  )}
                  {overviewData?.isEtf === true && (
                    <FlagBadge label={t("insights.isEtf")} tone="purple" />
                  )}
                  {overviewData?.isFund === true && (
                    <FlagBadge label={t("insights.isFund")} tone="cyan" />
                  )}
                  {overviewData?.isAdr === true && (
                    <FlagBadge label={t("insights.isAdr")} tone="amber" />
                  )}
                  {overviewData?.isActivelyTrading !== undefined && (
                    <FlagBadge
                      label={t("insights.activeStatus")}
                      tone={overviewData.isActivelyTrading ? "success" : "danger"}
                      value={overviewData.isActivelyTrading ? t("insights.yes") : t("insights.no")}
                    />
                  )}
                  {overviewData?.defaultImage !== undefined && (
                    <FlagBadge
                      label="LOGO"
                      tone={overviewData.defaultImage ? "amber" : "success"}
                      value={overviewData.defaultImage ? "generic" : "company"}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Insider Trading Table */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">
              {t("insights.insiderTrading")}
              {isInsiderMock && (
                <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded ml-2">
                  [MOCK]
                </span>
              )}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase border-b border-border">
                  <tr>
                    <th className="pb-3 font-medium">{t("common.name")}</th>
                    <th className="pb-3 font-medium">{t("common.date")}</th>
                    <th className="pb-3 font-medium">{t("common.type")}</th>
                    <th className="pb-3 font-medium">{t("common.price")}</th>
                    <th className="pb-3 font-medium">{t("common.transacted")}</th>
                    <th className="pb-3 font-medium text-right">{t("common.value")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {insiders.slice(0, 5).map((trade, i) => (
                    <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 font-medium">{trade.name}</td>
                      <td className="py-3 text-muted-foreground">{trade.date}</td>
                      <td className="py-3 truncate max-w-[150px]">{trade.type}</td>
                      <td className="py-3" dir="ltr">
                        ${(trade.price || 0).toFixed(2)}
                      </td>
                      <td
                        className={`py-3 ${trade.transacted > 0 ? "text-green-400" : "text-red-400"}`}
                        dir="ltr"
                      >
                        {trade.transacted > 0 ? "+" : ""}
                        {(trade.transacted || 0).toLocaleString()}
                      </td>
                      <td className="py-3 text-right" dir="ltr">
                        ${Math.abs(trade.value || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Charts & News */}
        <div className="space-y-6">
          {/* Analyst Estimates */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">
              {t("insights.analystEstimates")}
              {isAnalystMock && (
                <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded ml-2">
                  [MOCK]
                </span>
              )}
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground uppercase pb-2 border-b border-border">
                <div className="col-span-1">{t("insights.period")}</div>
                <div className="text-right">{t("insights.avg")}</div>
                <div className="text-right">{t("insights.low")}</div>
                <div className="text-right">{t("insights.high")}</div>
              </div>
              <div className="text-sm font-medium mb-2 text-blue-400">EPS</div>
              {epsEstimates.map((est, i) => (
                <div key={`eps-${i}`} className="grid grid-cols-4 gap-2 text-sm items-center py-1">
                  <div className="text-muted-foreground">{translatePeriod(est.period)}</div>
                  <div className="text-right font-bold text-blue-400" dir="ltr">
                    <span className="bg-blue-500/10 px-2 py-0.5 rounded">
                      {(est.avg ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right text-slate-400" dir="ltr">
                    {(est.low ?? 0).toFixed(2)}
                  </div>
                  <div className="text-right text-slate-400" dir="ltr">
                    {(est.high ?? 0).toFixed(2)}
                  </div>
                </div>
              ))}
              <div className="text-sm font-medium mt-4 mb-2 text-green-400">Revenue (B)</div>
              {revEstimates.map((est, i) => (
                <div key={`rev-${i}`} className="grid grid-cols-4 gap-2 text-sm items-center py-1">
                  <div className="text-muted-foreground">{translatePeriod(est.period)}</div>
                  <div className="text-right font-bold text-blue-400" dir="ltr">
                    <span className="bg-blue-500/10 px-2 py-0.5 rounded">
                      {(est.avg ?? 0).toFixed(1)}
                    </span>
                  </div>
                  <div className="text-right text-slate-400" dir="ltr">
                    {(est.low ?? 0).toFixed(1)}
                  </div>
                  <div className="text-right text-slate-400" dir="ltr">
                    {(est.high ?? 0).toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Employee Count Chart (stays [MOCK] — free tier has no historical series) */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">
              {t("insights.employeeCount")}
              {isEmployeeMock && (
                <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded ml-2">
                  [MOCK]
                </span>
              )}
            </h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={employeeCount}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="year"
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                    content={({ active, payload, label }: any) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
                            <p className="text-muted-foreground text-xs mb-1">{label}</p>
                            <p className="text-sm font-bold text-blue-400">
                              <span dir="ltr">{payload[0].value.toLocaleString()}</span>{" "}
                              <span className="mx-1">{t("insights.employees")}</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="url(#colorCount)"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={true}
                    animationDuration={1000}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* News Aggregator */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">
              {t("insights.news")}
              {isNewsMock && (
                <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded ml-2">
                  [MOCK]
                </span>
              )}
            </h3>
            <div className="space-y-4">
              {news.slice(0, 5).map((n, i) => (
                <a
                  key={i}
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group border-b border-border last:border-0 pb-4 last:pb-0"
                >
                  <p className="text-sm font-medium group-hover:text-blue-400 transition-colors line-clamp-2 mb-1">
                    {n.headline}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold">{n.publisher}</span>
                    <span>&bull;</span>
                    <span>{n.timestamp}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a labeled key-value display block.
 *
 * @param label - The text displayed above the value
 * @param value - The value to display
 * @param accentClass - Optional CSS classes applied to the value
 */
function KV({
  label,
  value,
  accentClass,
}: {
  label: string;
  value: string;
  accentClass?: string;
}) {
  return (
    <div className="flex flex-col items-start">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium inline-block ${accentClass ?? ""}`} dir="ltr">
        {value}
      </p>
    </div>
  );
}

/** Compact "LABEL value" pill used inside the identify strip. */
function Chip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "normal";
}) {
  const valueCls =
    tone === "success" ? "text-emerald-300 font-semibold" : "text-slate-200 font-medium";
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/60 border border-slate-700/50 text-[11px]"
      dir="ltr"
      title={`${label}: ${value}`}
    >
      <span className="text-slate-500 font-medium uppercase tracking-wider text-[9px]">
        {label}
      </span>
      <span className={valueCls}>{value}</span>
    </span>
  );
}

/**
 * Renders a colored badge for a boolean-style label, optionally including a value.
 *
 * @param label - The badge label
 * @param tone - The badge color theme
 * @param value - An optional value displayed alongside the label
 */
function FlagBadge({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "purple" | "cyan" | "amber" | "success" | "danger";
  value?: string;
}) {
  const toneCls: Record<typeof tone, string> = {
    purple: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    success: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    danger: "bg-red-500/10 text-red-300 border-red-500/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium uppercase tracking-wider ${toneCls[tone]}`}
      title={value ? `${label}: ${value}` : label}
    >
      {label}
      {value && <span className="text-[10px] opacity-75 normal-case tracking-normal">{value}</span>}
    </span>
  );
}

/**
 * Renders a shimmering placeholder for a section header.
 */
function SkeletonHeader() {
  return (
    <div className="h-7 w-48 bg-slate-800/60 rounded-md relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.4s_infinite] before:bg-gradient-to-r before:from-transparent before:via-slate-700/40 before:to-transparent" />
  );
}
