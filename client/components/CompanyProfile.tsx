import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  useStockProfile,
  useStockAnalyst,
  useStockInsider,
  useStockNews,
  useStockMetrics,
  useScreenerAsset,
} from "@/hooks/useStockData";
import { formatTradeDateLocale, parseTradeDateMs } from "@/lib/finance";
import type { InsiderTransactionCategory } from "@shared/api";
import { SectionCardSkeleton } from "@/components/Skeleton";
import DataStatusBadge from "@/components/DataStatusBadge";
import { Building2, ChartNoAxesCombined, Newspaper, Scale } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type EstimateRow = {
  period: string;
  avg: number | null;
  low: number | null;
  high: number | null;
};

export default function CompanyProfile({
  ticker = "AAPL",
}: {
  ticker?: string;
}) {
  const { t } = useI18n();
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const { data: overviewData, isLoading: overviewLoading } =
    useStockProfile(ticker);
  const { data: screenerAsset } = useScreenerAsset(ticker);
  const { data: analystData } = useStockAnalyst(ticker);
  const { data: insiderData } = useStockInsider(ticker);
  const { data: newsData } = useStockNews(ticker);
  const { data: metricsData } = useStockMetrics(ticker);

  const description =
    overviewData?.description || screenerAsset?.summary || null;
  const canExpandDescription = Boolean(description && description.length > 260);
  const sector = overviewData?.sector || screenerAsset?.sector || null;
  const industry = overviewData?.industry || screenerAsset?.industry || null;
  const ceo = overviewData?.ceo || null;
  const beta = overviewData?.beta ?? null;
  const piotroskiScore = metricsData?.scores?.piotroskiScore ?? null;
  const translatePeriod = (period: string) => {
    if (period === "0q") return t("insights.currentQtr");
    if (period === "0y") return t("insights.currentYear");
    if (period === "+1y") return t("insights.nextYear");
    return period;
  };

  const news = (newsData ?? []).map((item) => ({
    headline: item.title,
    publisher: item.publisher,
    timestamp: item.providerPublishTime
      ? (formatTradeDateLocale(item.providerPublishTime) ?? "Recent")
      : "Recent",
    thumbnail: item.thumbnail ?? null,
    url: item.link || "#",
  }));

  const insiders = (insiderData ?? [])
    .slice()
    .sort(
      (a, b) => parseTradeDateMs(b.startDate) - parseTradeDateMs(a.startDate),
    )
    .map((item) => ({
      name: item.filerName,
      relation: item.filerRelation ?? null,
      date: formatTradeDateLocale(item.startDate) ?? "—",
      typeLabel: i18nInsiderCategory(t, item.category, item.transactionText),
      category: item.category,
      isAdministrative: item.isAdministrative,
      transactionText: item.transactionText,
      shares: item.shares,
      price: item.price,
      priceLow: item.priceLow ?? null,
      priceHigh: item.priceHigh ?? null,
      value: item.value,
      marketClosePrice: item.marketClosePrice ?? null,
    }));

  const epsEstimates: EstimateRow[] = [];
  const revenueEstimates: EstimateRow[] = [];
  for (const trend of analystData ?? []) {
    if (!["0q", "0y", "+1y"].includes(trend.period)) continue;
    if (trend.earningsEstimate) {
      epsEstimates.push({
        period: trend.period,
        avg: trend.earningsEstimate.avg ?? null,
        low: trend.earningsEstimate.low ?? null,
        high: trend.earningsEstimate.high ?? null,
      });
    }
    if (trend.revenueEstimate) {
      revenueEstimates.push({
        period: trend.period,
        avg: toBillions(trend.revenueEstimate.avg),
        low: toBillions(trend.revenueEstimate.low),
        high: toBillions(trend.revenueEstimate.high),
      });
    }
  }

  if (overviewLoading) {
    return (
      <div className="mt-8 space-y-6">
        <SkeletonHeader />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <SectionCardSkeleton height={360} />
            <SectionCardSkeleton height={260} />
          </div>
          <div className="space-y-6">
            <SectionCardSkeleton height={360} />
            <SectionCardSkeleton height={220} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <SectionHeading
        icon={Building2}
        title={t("insights.companyProfile")}
        live={Boolean(overviewData || screenerAsset)}
        source="FMP / FinanceDatabase"
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <section
          className={`order-1 rounded-panel border border-border bg-card p-5 lg:col-span-2 ${
            descriptionExpanded ? "" : "lg:h-[364px] overflow-hidden"
          }`}
          aria-labelledby="company-profile-card-title"
        >
          <h2 id="company-profile-card-title" className="sr-only">
            {t("insights.companyProfile")}
          </h2>
          {description && (
            <div className="mb-4">
              <p
                id="company-description"
                className={`text-base leading-7 text-muted-foreground ${descriptionExpanded ? "" : "line-clamp-4"}`}
              >
                {description}
              </p>
              {canExpandDescription && (
                <button
                  type="button"
                  className="mt-2 inline-flex min-h-8 items-center rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  onClick={() => setDescriptionExpanded((value) => !value)}
                  aria-expanded={descriptionExpanded}
                  aria-controls="company-description"
                >
                  {descriptionExpanded
                    ? t("insights.showLess")
                    : t("insights.showMore")}
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
            <KV label={t("insights.ceo")} value={ceo} />
            <KV label={t("insights.sector")} value={sector} />
            <KV label={t("insights.industry")} value={industry} />
            <KV
              label={t("insights.beta")}
              value={beta !== null ? beta.toFixed(2) : "—"}
            />
            <KV
              label={t("insights.piotroskiScore")}
              value={piotroskiScore !== null ? `${piotroskiScore} / 9` : "—"}
              accentClass="text-chart-positive"
            />
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                <Chip
                  label={t("insights.ipoDate")}
                  value={overviewData.ipoDate}
                />
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
              {overviewData?.isActivelyTrading !== undefined && (
                <FlagBadge
                  label={t("insights.activeStatus")}
                  tone={overviewData.isActivelyTrading ? "success" : "danger"}
                  value={
                    overviewData.isActivelyTrading
                      ? t("insights.yes")
                      : t("insights.no")
                  }
                />
              )}
            </div>
          </div>
        </section>

        <section className="order-2 rounded-panel border border-border bg-card p-5 lg:col-span-1 lg:h-[364px] lg:overflow-hidden">
          <SectionHeading
            icon={ChartNoAxesCombined}
            title={t("insights.analystEstimates")}
            live={Boolean(analystData?.length)}
            source="Yahoo Finance consensus"
          />
          <EstimateTable
            title="EPS"
            rows={epsEstimates}
            format={formatEstimate}
            tone="primary"
            translatePeriod={translatePeriod}
            t={t}
          />
          <EstimateTable
            title="Revenue (B)"
            rows={revenueEstimates}
            format={formatRevenueEstimate}
            tone="positive"
            translatePeriod={translatePeriod}
            t={t}
          />
        </section>

        <section className="order-3 rounded-panel border border-border bg-card p-6 lg:col-span-3">
          <SectionHeading
            icon={Scale}
            title={t("insights.insiderTrading")}
            live={Boolean(insiderData?.length)}
            source="Yahoo Finance"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-3 font-medium">{t("common.name")}</th>
                  <th className="pb-3 font-medium">{t("common.date")}</th>
                  <th className="pb-3 font-medium">{t("common.type")}</th>
                  <th className="pb-3 font-medium">{t("common.shares")}</th>
                  <th className="pb-3 font-medium">
                    {t("common.pricePerShare")}
                  </th>
                  <th className="pb-3 font-medium">{t("common.value")}</th>
                  <th className="pb-3 text-right font-medium">
                    {t("common.marketClose")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {insiders.slice(0, 8).map((trade, index) => {
                  const tone =
                    trade.category === "purchase"
                      ? "text-chart-positive"
                      : trade.category === "sale"
                        ? "text-chart-negative"
                        : "text-muted-foreground";
                  const price =
                    trade.price !== null
                      ? `$${trade.price.toFixed(2)}`
                      : trade.priceLow !== null && trade.priceHigh !== null
                        ? `$${trade.priceLow.toFixed(2)}–$${trade.priceHigh.toFixed(2)}`
                        : "—";
                  return (
                    <tr
                      key={`${trade.name}-${trade.date}-${index}`}
                      className="transition-colors hover:bg-muted/60"
                    >
                      <td className="py-3 font-medium">
                        {trade.name}
                        {trade.relation && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {trade.relation}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {trade.date}
                      </td>
                      <td
                        className={`max-w-[190px] py-3 ${tone}`}
                        title={trade.transactionText}
                      >
                        {trade.typeLabel}
                        {trade.isAdministrative && (
                          <span className="block text-[10px] text-muted-foreground">
                            {t("insider.administrative")}
                          </span>
                        )}
                      </td>
                      <td className="py-3 font-mono tabular-nums" dir="ltr">
                        {trade.shares.toLocaleString()}{" "}
                        <span className="text-xs text-muted-foreground">
                          {t("common.sharesUnit")}
                        </span>
                      </td>
                      <td
                        className="py-3 font-mono tabular-nums"
                        dir="ltr"
                        title={
                          trade.price !== null
                            ? t("insider.reportedPrice")
                            : t("insider.priceUnavailable")
                        }
                      >
                        {price}
                      </td>
                      <td className="py-3 font-mono tabular-nums" dir="ltr">
                        {trade.value !== null
                          ? `$${formatCompactUsd(trade.value)}`
                          : "—"}
                      </td>
                      <td
                        className="py-3 text-right font-mono tabular-nums text-muted-foreground"
                        dir="ltr"
                        title={t("insider.marketCloseContext")}
                      >
                        {trade.marketClosePrice !== null
                          ? `$${trade.marketClosePrice.toFixed(2)}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="order-4 rounded-panel border border-border bg-card p-5 lg:col-span-3">
          <SectionHeading
            icon={Newspaper}
            title={t("insights.news")}
            live={Boolean(newsData?.length)}
            source="Yahoo Finance"
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {news.slice(0, 8).map((item, index) => {
              const initial = (item.publisher || "?")
                .trim()
                .charAt(0)
                .toUpperCase();
              return (
                <a
                  key={index}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex min-w-0 gap-3 rounded-lg border-b border-border p-2.5 transition-colors hover:bg-muted/40 md:border-b-0 md:border-r md:last:border-r-0"
                >
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-14 w-14 shrink-0 rounded-md bg-muted object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-muted to-card text-base font-bold text-muted-foreground"
                      aria-hidden="true"
                    >
                      {initial}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className="line-clamp-2 text-[15px] font-medium leading-6 text-foreground transition-colors group-hover:text-primary"
                      title={item.headline}
                    >
                      {item.headline}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="truncate font-semibold"
                        title={item.publisher}
                      >
                        {item.publisher}
                      </span>
                      <span aria-hidden="true">•</span>
                      <span className="shrink-0">{item.timestamp}</span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
          {news.length > 0 && (
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              {t("news.footer", { count: Math.min(news.length, 8) })}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function EstimateTable({
  title,
  rows,
  format,
  tone,
  translatePeriod,
  t,
}: {
  title: string;
  rows: EstimateRow[];
  format: (value: number | null) => string;
  tone: "primary" | "positive";
  translatePeriod: (period: string) => string;
  t: (key: string) => string;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div
        className={`mb-2 text-sm font-medium ${tone === "positive" ? "text-chart-positive" : "text-primary"}`}
      >
        {title}
      </div>
      <div className="grid grid-cols-4 gap-3 border-b border-border pb-2 text-xs uppercase text-muted-foreground">
        <div>{t("insights.period")}</div>
        <div className="text-right">{t("insights.avg")}</div>
        <div className="text-right">{t("insights.low")}</div>
        <div className="text-right">{t("insights.high")}</div>
      </div>
      {rows.map((row, index) => (
        <div
          key={`${title}-${index}`}
          className="grid grid-cols-4 items-center gap-3 py-1.5 text-sm"
        >
          <div className="truncate text-muted-foreground">
            {translatePeriod(row.period)}
          </div>
          <div
            className="text-right font-mono font-bold tabular-nums text-primary"
            dir="ltr"
          >
            <span className="rounded bg-primary/10 px-1.5 py-0.5">
              {format(row.avg)}
            </span>
          </div>
          <div
            className="text-right font-mono tabular-nums text-muted-foreground"
            dir="ltr"
          >
            {format(row.low)}
          </div>
          <div
            className="text-right font-mono tabular-nums text-muted-foreground"
            dir="ltr"
          >
            {format(row.high)}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatEstimate(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(2);
}

function formatRevenueEstimate(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(1);
}

function toBillions(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : value / 1e9;
}

function KV({
  label,
  value,
  accentClass = "",
}: {
  label: string;
  value: string | null;
  accentClass?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-start">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`truncate text-sm font-medium ${accentClass}`}
        dir="ltr"
        title={value ?? "—"}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

function Chip({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?: "success" | "normal";
}) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-[6px] border border-border bg-muted px-2.5 py-1 text-xs"
      dir="ltr"
      title={`${label}: ${value}`}
    >
      <span className="shrink-0 font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={
          tone === "success"
            ? "truncate font-semibold text-chart-positive"
            : "truncate font-medium text-foreground"
        }
      >
        {value}
      </span>
    </span>
  );
}

function FlagBadge({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "success" | "danger";
  value: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium uppercase tracking-wider ${tone === "success" ? "border-chart-positive/30 bg-chart-positive/10 text-chart-positive" : "border-chart-negative/30 bg-chart-negative/10 text-chart-negative"}`}
    >
      {label}
      <span className="normal-case tracking-normal opacity-75">{value}</span>
    </span>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  live,
  source,
}: {
  icon: LucideIcon;
  title: string;
  live: boolean;
  source: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="flex min-w-0 items-center gap-2 text-lg font-semibold text-foreground">
        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="truncate">{title}</span>
      </h3>
      {live && (
        <DataStatusBadge status="live" source={source} compact iconOnly />
      )}
    </div>
  );
}

function SkeletonHeader() {
  return (
    <div className="relative h-7 w-48 overflow-hidden rounded-[6px] bg-muted before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.4s_infinite] before:bg-gradient-to-r before:from-transparent before:via-border/40 before:to-transparent" />
  );
}

function i18nInsiderCategory(
  t: (key: string) => string,
  category: InsiderTransactionCategory,
  fallback: string,
): string {
  switch (category) {
    case "purchase":
      return t("insider.type.P");
    case "sale":
      return t("insider.type.S");
    case "award":
      return t("insider.type.A");
    case "gift":
      return t("insider.type.G");
    case "optionExercise":
      return t("insider.type.M");
    case "withholding":
      return t("insider.type.F");
    case "disposal":
      return t("insider.type.D");
    case "optionGrant":
      return t("insider.type.X");
    case "conversion":
      return t("insider.type.C");
    default:
      return fallback || t("insider.type.other");
  }
}

function formatCompactUsd(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}
