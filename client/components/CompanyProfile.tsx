import { useI18n } from "@/lib/i18n";
import {
  useStockProfile,
  useStockAnalyst,
  useStockInsider,
  useStockNews,
  useStockMetrics,
  useYahooDown,
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

  // News / analyst / insider all come from Yahoo — when it's down those
  // sections render mock fallbacks (and stale cached payloads look live),
  // so surface [MOCK] from the health probe rather than waiting on data.
  const yahooDown = useYahooDown();

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
          // Pass `thumbnail` through so the render can build a news-card
          // layout. Most Yahoo v4 news items carry `thumbnail.resolutions[]`
          // upscaled already; the server normalizers extract one URL.
          thumbnail: n.thumbnail ?? null,
          // Type lets the UI hint "video" / "article" badges when Yahoo
          // ships that classification (some sessions expose `type`).
          type: n.type ?? null,
          url: n.link || "#",
        }))
      : mockNews;
  const isNewsMock = !newsData || newsData.length === 0 || yahooDown;

  // ---- Insider mapping (Yahoo raw: shares/value come as {raw, fmt} objects) ----
  // Sort on the RAW upstream `startDate` (number|string|null) BEFORE mapping
  // to a render shape. Sorting the rendered locale-formatted string would
  // be fragile — browsers don't all re-parse every locale output via
  // Date.parse.
  //
  // Branching: `transactionCode` (Yahoo single-letter code) drives which
  // short label we render AND whether the price/value columns are cash
  // numbers vs "—". Without this branch, Award / Gift / Tax Withholding
  // rows showed `0.00` and `$0` because the upstream `value` field was
  // null/0 — the price column was `value / shares`, which is meaningless
  // for non-cash grants and read as "the grant price was $0".
  const insiders =
    insiderData && insiderData.length > 0
      ? [...insiderData]
          .sort((a, b) => parseTradeDateMs(b.startDate) - parseTradeDateMs(a.startDate))
          .map((i) => {
            const code = (i.transactionCode ?? "").toUpperCase();
            const typeLabel = i18nInsiderType(t, code, i.transactionText);
            const isCash = code === "P" || code === "S";
            return {
              name: i.filerName,
              // formatTradeDateLocale accepts UTC ms via parseTradeDate
              // (the normalizer now guarantees UTC ms). Null renders as
              // "—" rather than "Invalid Date" or "1/1/1970".
              date: formatTradeDateLocale(i.startDate) ?? "—",
              typeLabel,
              code: code || "—",
              isCash,
              price: isCash && i.price > 0 ? i.price : null,
              transacted: i.shares,
              value: isCash && i.value !== 0 ? Math.abs(i.value) : null,
            };
          })
      : [...mockInsiderTrades].sort(
          (a, b) => parseTradeDateMs(b.date) - parseTradeDateMs(a.date)
        );
  const isInsiderMock = !insiderData || insiderData.length === 0 || yahooDown;

  // ---- Analyst trends (normalized upstream: earningsEstimate.avg is plain number) ----
  let epsEstimates = mockAnalystEstimates.filter((e) => e.metric === "EPS");
  let revEstimates = mockAnalystEstimates.filter((e) => e.metric === "Revenue");
  let isAnalystMock = true;

  if (analystData && analystData.length > 0) {
    // Keep rendering real (possibly cached) estimates, but badge MOCK while
    // Yahoo is down — the estimates are not live during the outage.
    isAnalystMock = yahooDown;
    epsEstimates = [];
    revEstimates = [];
    analystData.forEach((trend) => {
      if (trend.period === "0q" || trend.period === "0y" || trend.period === "+1y") {
        if (trend.earningsEstimate) {
          // Preserve `null` from upstream — `?? 0` previously rendered every
          // missing value as "0.00" which read like a real estimate of zero.
          // The renderer falls back to `insights.unavailable` (\u2014) for
          // genuinely missing cells so analysts can tell data absence from a real zero.
          epsEstimates.push({
            metric: "EPS",
            period: trend.period as never,
            avg: trend.earningsEstimate.avg ?? null,
            low: trend.earningsEstimate.low ?? null,
            high: trend.earningsEstimate.high ?? null,
          });
        }
        if (trend.revenueEstimate) {
          revEstimates.push({
            metric: "Revenue",
            period: trend.period as never,
            avg: trend.revenueEstimate.avg === null || trend.revenueEstimate.avg === undefined
              ? null
              : trend.revenueEstimate.avg / 1e9,
            low: trend.revenueEstimate.low === null || trend.revenueEstimate.low === undefined
              ? null
              : trend.revenueEstimate.low / 1e9,
            high: trend.revenueEstimate.high === null || trend.revenueEstimate.high === undefined
              ? null
              : trend.revenueEstimate.high / 1e9,
          });
        }
      }
    });
  }

  // Render an em-dash for any estimate that the server returned as null.
  // Mirrors the upstream's "missing data" sentinel — keeps the row width
  // intact so an all-missing row visually reads as "no live estimates"
  // instead of "6.55 + 0.00 + 0.00".
  const formatEstimate = (value: number | null): string =>
    value === null || value === undefined || !Number.isFinite(value)
      ? t("insights.unavailable")
      : value.toFixed(2);
  // Revenue is rendered in $B with a single decimal; EPS keeps two.
  // Split helpers (instead of a precision arg) so each call site reads
  // cleanly and a future refactor into a shared "<Metric>Estimate" row
  // component stays a search-and-replace away.
  const formatEstimateRev = (value: number | null): string =>
    value === null || value === undefined || !Number.isFinite(value)
      ? t("insights.unavailable")
      : value.toFixed(1);

  // Employee count: pull the *current* full-time-equivalent from FMP profile
  // and inject it as the latest-year bar. Historical years stay mock-backed
  // because the free tier has no historical employee-count endpoint (FMP
  // `/stable/profile` is a current snapshot only). When the FTE is live the
  // card drops `[MOCK]`; otherwise it stays to flag the gap honestly.
  const currentYear = String(new Date().getFullYear());
  const currentFte =
    typeof overviewData?.fullTimeEmployees === "number" &&
    Number.isFinite(overviewData.fullTimeEmployees) &&
    overviewData.fullTimeEmployees > 0
      ? overviewData.fullTimeEmployees
      : null;
  // Display only the live current-year snapshot when available (no mock history
  // mix). If currentFte is null, keep the entire mock series with [MOCK] indicator.
  const employeeCount =
    currentFte !== null
      ? [{ year: currentYear, count: currentFte }]
      : mockEmployeeCount;
  // Keep [MOCK] indicator enabled whenever synthetic history remains in the chart
  // (which is whenever currentFte is null).
  const isEmployeeMock = currentFte === null;

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
                      <td className="py-3 truncate max-w-[150px]">
                        <span data-code={trade.code} title={trade.code}>
                          {trade.typeLabel ?? "—"}
                        </span>
                      </td>
                      <td className="py-3" dir="ltr">
                        {trade.price !== null && trade.price !== undefined
                          ? `$${trade.price.toFixed(2)}`
                          : <span className="text-slate-500">—</span>}
                      </td>
                      <td
                        className={`py-3 ${trade.transacted > 0 ? "text-green-400" : "text-red-400"}`}
                        dir="ltr"
                      >
                        {trade.transacted > 0 ? "+" : ""}
                        {(trade.transacted || 0).toLocaleString()}
                      </td>
                      <td className="py-3 text-right" dir="ltr">
                        {trade.value !== null && trade.value !== undefined && trade.value !== 0
                          ? `$${trade.value.toLocaleString()}`
                          : <span className="text-slate-500">—</span>}
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
                      {formatEstimate(est.avg)}
                    </span>
                  </div>
                  <div className="text-right text-slate-400" dir="ltr">
                    {formatEstimate(est.low)}
                  </div>
                  <div className="text-right text-slate-400" dir="ltr">
                    {formatEstimate(est.high)}
                  </div>
                </div>
              ))}
              <div className="text-sm font-medium mt-4 mb-2 text-green-400">Revenue (B)</div>
              {revEstimates.map((est, i) => (
                <div key={`rev-${i}`} className="grid grid-cols-4 gap-2 text-sm items-center py-1">
                  <div className="text-muted-foreground">{translatePeriod(est.period)}</div>
                  <div className="text-right font-bold text-blue-400" dir="ltr">
                    <span className="bg-blue-500/10 px-2 py-0.5 rounded">
                      {formatEstimateRev(est.avg)}
                    </span>
                  </div>
                  <div className="text-right text-slate-400" dir="ltr">
                    {formatEstimateRev(est.low)}
                  </div>
                  <div className="text-right text-slate-400" dir="ltr">
                    {formatEstimateRev(est.high)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Employee Count Chart — latest year is live from FMP profile;
              historical years stay mock-backed (free tier has no historical
              employee-count endpoint). We surface the gap with a footnote
              rather than a [MOCK] chip when only the snapshot is live. */}
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
            {!isEmployeeMock && (
              <p
                className="text-[11px] text-muted-foreground mt-2 leading-snug"
                title={t("insights.chartLiveSingleYear")}
              >
                {t("insights.chartLiveSingleYear")}
              </p>
            )}
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
            <div className="space-y-3">
              {news.slice(0, 8).map((n, i) => {
                // Gradient placeholder when Yahoo didn't ship a thumbnail.
                // Falls back to a single-letter chip with the publisher so the
                // row still reads as "news" rather than a giant empty box.
                const initial = (n.publisher || "?").trim().charAt(0).toUpperCase();
                return (
                  <a
                    key={i}
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 group border-b border-border last:border-0 pb-3 last:pb-0"
                  >
                    {n.thumbnail ? (
                      <img
                        src={n.thumbnail}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="w-16 h-16 rounded-md object-cover bg-slate-800 flex-shrink-0"
                      />
                    ) : (
                      <div
                        className="w-16 h-16 rounded-md bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-base font-bold text-slate-300 flex-shrink-0"
                        aria-hidden="true"
                      >
                        {initial}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium group-hover:text-blue-400 transition-colors line-clamp-2 mb-1">
                        {n.headline}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold truncate max-w-[140px]">{n.publisher}</span>
                        <span>&bull;</span>
                        <span>{n.timestamp}</span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
            {!isNewsMock && news.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border">
                {t("news.footer", { count: Math.min(news.length, 8) })}
              </p>
            )}
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

/**
 * Map Yahoo's single-letter `transactionCode` to a short localised label.
 *
 * Yahoo's `quoteSummary.insiderTransactions.transactions[]` exposes a
 * `transactionCode` per row (`P`urchase / `S`ale / `A`ward / `G`ift /
 * `M` option-exercise / `F` tax-withholding / `D`isposal / `X` option
 * grant / `C` conversion / etc). The upstream `transactionText`
 * ("Stock Gift at price 0.00 per share.") doesn't fit a table cell, so
 * this helper reduces each row to a short noun via `t("insider.type.X")`,
 * falling back to the upstream text on `""` / unknown codes so legacy
 * rows still render something readable.
 *
 * Pure function — module scope rather than inline so the i18n-audit
 * static scanner picks up each literal `t("insider.type.X")` call site
 * independently. (A `\`insider.type.${code}\`` template literal would
 * collapse to `"insider.type.<code>"` in static scan, missing the 9
 * distinct keys; this switch exposes all of them to the audit.)
 *
 * Pure function — kept at module scope because the mapping is data-side,
 * not React-side, and unit tests can pin both known + unknown codes
 * without spinning up a renderer.
 */
function i18nInsiderType(
  t: (key: string) => string,
  code: string,
  fallback: string,
): string {
  if (!code) return fallback || t("insider.type.other");
  switch (code) {
    case "P": return t("insider.type.P");
    case "S": return t("insider.type.S");
    case "A": return t("insider.type.A");
    case "G": return t("insider.type.G");
    case "M": return t("insider.type.M");
    case "F": return t("insider.type.F");
    case "D": return t("insider.type.D");
    case "X": return t("insider.type.X");
    case "C": return t("insider.type.C");
    default:  return fallback || code;
  }
}
