import {
  Banknote,
  CircleDollarSign,
  ChartNoAxesCombined,
  Landmark,
  Percent,
} from "lucide-react";
import DataStatusBadge from "@/components/DataStatusBadge";
import type {
  FinancialStatements,
  StockMetrics,
  StockQuote,
} from "@shared/api";

interface StockFundamentalsStripProps {
  quote: StockQuote | null | undefined;
  metrics: StockMetrics | null | undefined;
  annualFinancials: FinancialStatements | null | undefined;
  quarterlyFinancials: FinancialStatements | null | undefined;
  marketCap?: number | null;
  loading?: boolean;
}

type MetricValue = string | number | null | undefined;
type Source = { label: string } | undefined;

function finite(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(value: unknown, digits = 2): string | null {
  const n = finite(value);
  if (n === null) return null;
  const abs = Math.abs(n);
  const suffix = abs >= 1e12 ? "T" : abs >= 1e9 ? "B" : abs >= 1e6 ? "M" : "";
  const divisor = abs >= 1e12 ? 1e12 : abs >= 1e9 ? 1e9 : abs >= 1e6 ? 1e6 : 1;
  // Keep the minus sign before the currency symbol (-$4.80B, not $-4.80B).
  const sign = n < 0 ? "-" : "";
  return `${sign}$${(abs / divisor).toFixed(suffix ? digits : 2)}${suffix}`;
}

function formatNumber(value: unknown, digits = 2): string | null {
  const n = finite(value);
  return n === null ? null : n.toFixed(digits);
}

function percentValue(value: unknown): number | null {
  const n = finite(value);
  return n === null ? null : n;
}

function formatPercent(value: unknown): string | null {
  const n = percentValue(value);
  return n === null ? null : `${n.toFixed(2)}%`;
}

function latest<T extends { date: string }>(rows: T[] | undefined): T | null {
  if (!rows?.length) return null;
  const ordered = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  return ordered[ordered.length - 1] ?? null;
}

function sourceLabel(
  source: "fmp" | "yahoo" | null | undefined,
): string | undefined {
  return source === "fmp"
    ? "FMP"
    : source === "yahoo"
      ? "Yahoo Finance"
      : undefined;
}

function unavailable(label: string) {
  return (
    <span
      className="inline-flex items-center gap-1"
      title={`${label} unavailable from the current data providers`}
    >
      <span>—</span>
      <span className="rounded-full border border-chart-amber/30 bg-chart-amber/5 px-1.5 py-0.5 text-[9px] font-sans font-medium uppercase leading-none tracking-wide text-chart-amber">
        Unavailable
      </span>
    </span>
  );
}

function Value({
  value,
  label,
  loading,
}: {
  value: MetricValue;
  label: string;
  loading?: boolean;
}) {
  if (loading) return <span className="text-muted-foreground/60">…</span>;
  if (value === null || value === undefined || value === "")
    return unavailable(label);
  return <span dir="ltr">{value}</span>;
}

function MetricRow({
  label,
  value,
  loading,
  source,
}: {
  label: string;
  value: MetricValue;
  loading?: boolean;
  source?: Source;
}) {
  const hasValue = value !== null && value !== undefined && value !== "";
  return (
    <div className="flex items-baseline justify-between gap-1.5 overflow-hidden border-b border-border/40 py-1.5 text-xs last:border-0">
      <span
        className="min-w-0 truncate font-medium leading-tight text-muted-foreground"
        title={label}
      >
        {label}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-right font-mono font-semibold tabular-nums text-foreground">
        <Value value={value} label={label} loading={loading} />
        {!loading && hasValue && source && (
          <DataStatusBadge
            status="live"
            source={source.label}
            compact
            iconOnly
          />
        )}
      </span>
    </div>
  );
}

const GROUP_ICONS = {
  Valuation: CircleDollarSign,
  "Cash Flow": Banknote,
  "Margins & Growth": ChartNoAxesCombined,
  Balance: Landmark,
  Dividend: Percent,
} as const;

function MetricGroup({
  title,
  children,
}: {
  title: keyof typeof GROUP_ICONS;
  children: React.ReactNode;
}) {
  const Icon = GROUP_ICONS[title];
  return (
    <section className="min-w-0 border-border/50 px-0 sm:border-l sm:px-3 first:pl-0 first:sm:border-l-0 last:pr-0">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/80">
        <Icon className="h-3.5 w-3.5 text-primary/80" aria-hidden="true" />
        <span>{title}</span>
      </h3>
      <div>{children}</div>
    </section>
  );
}

/** Dense fundamentals summary containing only provider-reported values. */
export default function StockFundamentalsStrip({
  quote,
  metrics,
  annualFinancials,
  quarterlyFinancials,
  marketCap: marketCapProp,
  loading = false,
}: StockFundamentalsStripProps) {
  const hasQuarterly = Boolean(
    quarterlyFinancials?.income?.length ||
      quarterlyFinancials?.balance?.length ||
      quarterlyFinancials?.cash?.length,
  );
  const statements = hasQuarterly ? quarterlyFinancials : annualFinancials;
  const balance = latest(statements?.balance);
  const marketCap = finite(marketCapProp) ?? finite(quote?.marketCap);
  const balanceSource = sourceLabel(statements?.sources?.balance);
  const metricsSource = sourceLabel(metrics?.source) ?? undefined;
  const quoteSource = quote ? "Yahoo Finance" : undefined;

  return (
    <div className="mt-8 w-full border-t border-border/60 pt-6 text-left">
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-5">
        <MetricGroup title="Valuation">
          <MetricRow
            label="Market Cap"
            value={formatMoney(marketCap)}
            loading={loading}
            source={quoteSource ? { label: quoteSource } : undefined}
          />
          <MetricRow
            label="P/E (TTM)"
            value={formatNumber(
              quote?.pe ??
                metrics?.ratios?.priceEarningsRatioTTM ??
                metrics?.metrics?.peRatioTTM,
            )}
            loading={loading}
            source={
              quoteSource
                ? { label: quoteSource }
                : metricsSource
                  ? { label: metricsSource }
                  : undefined
            }
          />
          <MetricRow
            label="Price to Sales"
            value={formatNumber(
              metrics?.metrics?.priceToSalesRatioTTM ??
                metrics?.ratios?.priceToSalesRatioTTM,
            )}
            loading={loading}
            source={metricsSource ? { label: metricsSource } : undefined}
          />
          <MetricRow
            label="EV to EBITDA"
            value={formatNumber(metrics?.metrics?.evToEBITDATTM)}
            loading={loading}
            source={metricsSource ? { label: metricsSource } : undefined}
          />
          <MetricRow
            label="Price to Book"
            value={formatNumber(
              metrics?.metrics?.priceToBookRatioTTM ??
                metrics?.ratios?.priceToBookRatioTTM,
            )}
            loading={loading}
            source={metricsSource ? { label: metricsSource } : undefined}
          />
        </MetricGroup>

        <MetricGroup title="Cash Flow">
          <MetricRow
            label="FCF Yield"
            value={formatPercent(metrics?.metrics?.freeCashFlowYieldTTM)}
            loading={loading}
            source={metricsSource ? { label: metricsSource } : undefined}
          />
        </MetricGroup>

        <MetricGroup title="Margins & Growth">
          <MetricRow
            label="Profit Margin"
            value={formatPercent(metrics?.ratios?.netProfitMargin)}
            loading={loading}
            source={metricsSource ? { label: metricsSource } : undefined}
          />
          <MetricRow
            label="Operating Margin"
            value={formatPercent(metrics?.ratios?.operatingProfitMarginTTM)}
            loading={loading}
            source={metricsSource ? { label: metricsSource } : undefined}
          />
        </MetricGroup>

        <MetricGroup title="Balance">
          <MetricRow
            label="Cash"
            value={formatMoney(balance?.cashAndCashEquivalents)}
            loading={loading}
            source={balanceSource ? { label: balanceSource } : undefined}
          />
          <MetricRow
            label="Debt"
            value={formatMoney(balance?.totalDebt)}
            loading={loading}
            source={balanceSource ? { label: balanceSource } : undefined}
          />
          <MetricRow
            label="Net Debt"
            value={formatMoney(balance?.netDebt)}
            loading={loading}
            source={balanceSource ? { label: balanceSource } : undefined}
          />
        </MetricGroup>

        <MetricGroup title="Dividend">
          <MetricRow
            label="Dividend Yield"
            value={formatPercent(
              quote?.dividendYield ?? metrics?.metrics?.dividendYielTTM,
            )}
            loading={loading}
            source={
              quote?.dividendYield != null
                ? { label: "Yahoo Finance" }
                : metricsSource
                  ? { label: metricsSource }
                  : undefined
            }
          />
          <MetricRow
            label="Payout Ratio"
            value={formatPercent(
              quote?.payoutRatio ?? metrics?.ratios?.dividendPayoutRatioTTM,
            )}
            loading={loading}
            source={
              quote?.payoutRatio != null
                ? { label: "Yahoo Finance" }
                : metricsSource
                  ? { label: metricsSource }
                  : undefined
            }
          />
          <MetricRow label="Payout Date" value={null} loading={loading} />
        </MetricGroup>
      </div>
    </div>
  );
}
