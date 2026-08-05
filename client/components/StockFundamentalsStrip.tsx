import type {
  AnalystTrends,
  FinancialStatements,
  StockMetrics,
  StockQuote,
} from "@shared/api";

interface StockFundamentalsStripProps {
  quote: StockQuote | null | undefined;
  metrics: StockMetrics | null | undefined;
  annualFinancials: FinancialStatements | null | undefined;
  quarterlyFinancials: FinancialStatements | null | undefined;
  analyst: AnalystTrends | null | undefined;
  marketCap?: number | null;
  loading?: boolean;
}

type MetricValue = string | number | null | undefined;

function finite(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function percentValue(value: unknown): number | null {
  const n = finite(value);
  if (n === null) return null;
  // FMP ratios are inconsistent across endpoint generations: some return
  // 0.3112 and others return 31.12. Keep the strip presentation stable.
  return Math.abs(n) <= 1 ? n * 100 : n;
}

function formatMoney(value: unknown, digits = 2): string | null {
  const n = finite(value);
  if (n === null) return null;
  const abs = Math.abs(n);
  const suffix = abs >= 1e12 ? "T" : abs >= 1e9 ? "B" : abs >= 1e6 ? "M" : "";
  const divisor = abs >= 1e12 ? 1e12 : abs >= 1e9 ? 1e9 : abs >= 1e6 ? 1e6 : 1;
  return `$${(n / divisor).toFixed(suffix ? digits : 2)}${suffix}`;
}

function formatNumber(value: unknown, digits = 2): string | null {
  const n = finite(value);
  return n === null ? null : n.toFixed(digits);
}

function formatPercent(value: unknown, signed = false): string | null {
  const n = percentValue(value);
  if (n === null) return null;
  return `${signed && n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function latest<T extends { date: string }>(rows: T[] | undefined): T | null {
  if (!rows?.length) return null;
  const ordered = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  return ordered[ordered.length - 1] ?? null;
}

function sumField<T>(rows: T[] | undefined, key: keyof T): number | null {
  if (!rows?.length) return null;
  const values = rows.map((row) => finite(row[key])).filter((value): value is number => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function yoyForLatestQuarter(
  rows: FinancialStatements["income"] | undefined,
  key: "revenue" | "netIncome",
): number | null {
  if (!rows?.length) return null;
  const ordered = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const current = ordered[ordered.length - 1];
  if (!current || !/^Q[1-4]$/.test(current.period)) return null;
  const prior = [...ordered]
      .reverse()
      .slice(1)
      .find((row) => row.period && row.period === current.period) ?? ordered[ordered.length - 5];
  const currentValue = finite(current[key]);
  const priorValue = prior ? finite(prior[key]) : null;
  if (currentValue === null || priorValue === null || priorValue === 0) return null;
  return ((currentValue - priorValue) / Math.abs(priorValue)) * 100;
}

function estimateEps(analyst: AnalystTrends | null | undefined, period: string): number | null {
  const point = analyst?.find((entry) => entry.period === period);
  return finite(point?.earningsEstimate?.avg);
}

function estimateEpsForYear(analyst: AnalystTrends | null | undefined, year: number): number | null {
  const point = analyst?.find((entry) => {
    const parsedYear = entry.endDate ? new Date(entry.endDate).getFullYear() : NaN;
    return parsedYear === year;
  });
  return finite(point?.earningsEstimate?.avg);
}

function unavailable(label: string) {
  return (
    <span className="inline-flex items-baseline gap-1" title={`${label} unavailable from the current data providers`}>
      <span>—</span>
      <span className="text-[9px] font-sans font-normal text-muted-foreground/60">Unavailable</span>
    </span>
  );
}

function Value({ value, label, loading }: { value: MetricValue; label: string; loading?: boolean }) {
  if (loading) return <span className="text-muted-foreground/60">…</span>;
  if (value === null || value === undefined || value === "") return unavailable(label);
  return <span dir="ltr">{value}</span>;
}

function MetricRow({ label, value, loading }: { label: string; value: MetricValue; loading?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border/40 py-1.5 last:border-0">
      <span className="min-w-0 text-[11px] leading-tight text-muted-foreground">{label}</span>
      <span className="shrink-0 text-right text-[11px] font-mono font-medium tabular-nums text-foreground">
        <Value value={value} label={label} loading={loading} />
      </span>
    </div>
  );
}

function MetricGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 border-border/50 px-0 sm:px-4 first:pl-0 last:pr-0 sm:border-l first:border-l-0">
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/80">{title}</h3>
      <div>{children}</div>
    </section>
  );
}

/** Dense, honest fundamentals summary for the stock hero. */
export default function StockFundamentalsStrip({
  quote,
  metrics,
  annualFinancials,
  quarterlyFinancials,
  analyst,
  marketCap: marketCapProp,
  loading = false,
}: StockFundamentalsStripProps) {
  const hasQuarterly = Boolean(quarterlyFinancials?.cash?.length);
  const marketCap = finite(marketCapProp) ?? finite(quote?.marketCap);
  const statements = hasQuarterly ? quarterlyFinancials : annualFinancials;
  const cashRows = hasQuarterly
    ? statements?.cash
    : statements?.cash?.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-1);
  // Quarterly and annual endpoints can have different coverage. Keep the
  // newest balance snapshot available instead of letting an incomplete
  // quarterly response hide a valid annual cash/debt figure.
  const balance = latest(quarterlyFinancials?.balance) ?? latest(annualFinancials?.balance);
  const incomeRows = quarterlyFinancials?.income?.length ? quarterlyFinancials.income : annualFinancials?.income;

  // Only four quarters are a TTM total. A shorter quarterly response is
  // intentionally marked unavailable rather than presenting a partial sum as TTM.
  const orderedCashRows = cashRows?.slice().sort((a, b) => a.date.localeCompare(b.date));
  const trailingCashRows = hasQuarterly
    ? orderedCashRows?.length === 4 ? orderedCashRows : undefined
    : orderedCashRows;
  const freeCashFlow = sumField(trailingCashRows, "freeCashFlow");
  const stockBasedCompensation = sumField(trailingCashRows, "stockBasedCompensation");
  const shares = finite(quote?.sharesOutstanding) ?? (
    quote?.marketCap && quote.price > 0 ? quote.marketCap / quote.price : null
  );
  const fcfPerShare = freeCashFlow !== null && shares ? freeCashFlow / shares : null;
  const adjustedFcf =
    freeCashFlow !== null && stockBasedCompensation !== null
      ? freeCashFlow - Math.abs(stockBasedCompensation)
      : null;
  const adjustedFcfPerShare = adjustedFcf !== null && shares ? adjustedFcf / shares : null;
  const fcfYield =
    percentValue(metrics?.metrics?.freeCashFlowYieldTTM) ??
    (freeCashFlow !== null && marketCap ? (freeCashFlow / marketCap) * 100 : null);
  const adjustedFcfYield = adjustedFcf !== null && marketCap ? (adjustedFcf / marketCap) * 100 : null;
  const sbcImpact =
    freeCashFlow !== null && freeCashFlow !== 0 && stockBasedCompensation !== null
      ? (-Math.abs(stockBasedCompensation) / Math.abs(freeCashFlow)) * 100
      : null;

  const price = finite(quote?.price);
  const peTtm = finite(quote?.pe) ?? finite(metrics?.ratios?.priceEarningsRatioTTM) ?? finite(metrics?.metrics?.peRatioTTM);
  const peNtm = price !== null && estimateEps(analyst, "+1y") ? price / (estimateEps(analyst, "+1y") as number) : null;
  const eps2026 = estimateEpsForYear(analyst, 2026);
  const pe2026 = price !== null && eps2026 !== null && eps2026 !== 0 ? price / eps2026 : null;

  const latestIncome = latest(incomeRows);
  const profitMargin =
    percentValue(metrics?.ratios?.netProfitMargin) ??
    (latestIncome && latestIncome.revenue ? (latestIncome.netIncome / latestIncome.revenue) * 100 : null);
  const operatingMargin =
    percentValue(metrics?.ratios?.operatingProfitMarginTTM) ??
    (latestIncome?.operatingIncome !== undefined && latestIncome.revenue
      ? ((latestIncome.operatingIncome ?? 0) / latestIncome.revenue) * 100
      : null);
  const cash = finite(balance?.cashAndCashEquivalents);
  const debt = finite(balance?.totalDebt);
  const net = cash !== null && debt !== null ? cash - debt : null;
  const dividendYield = percentValue(quote?.dividendYield) ?? percentValue(metrics?.metrics?.dividendYielTTM);
  const payoutRatio = percentValue(quote?.payoutRatio) ?? percentValue(metrics?.ratios?.dividendPayoutRatioTTM);

  return (
    <div className="w-full border-t border-border/60 pt-6 mt-8 text-left">
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-5">
        <MetricGroup title="Valuation">
          <MetricRow label="Market Cap" value={formatMoney(marketCap)} loading={loading} />
          <MetricRow
            label="P/E (TTM | NTM | 2026)"
            value={
              peTtm !== null || peNtm !== null || pe2026 !== null
                ? `${formatNumber(peTtm) ?? "— Unavailable"} | ${formatNumber(peNtm) ?? "— Unavailable"} | ${formatNumber(pe2026) ?? "— Unavailable"}`
                : null
            }
            loading={loading}
          />
          <MetricRow label="Price to Sales" value={formatNumber(metrics?.metrics?.priceToSalesRatioTTM ?? metrics?.ratios?.priceToSalesRatioTTM)} loading={loading} />
          <MetricRow label="EV to EBITDA" value={formatNumber(metrics?.metrics?.evToEBITDATTM)} loading={loading} />
          <MetricRow label="Price to Book" value={formatNumber(metrics?.metrics?.priceToBookRatioTTM ?? metrics?.ratios?.priceToBookRatioTTM)} loading={loading} />
        </MetricGroup>

        <MetricGroup title="Cash Flow">
          <MetricRow label="Free Cash Flow Yield" value={formatPercent(fcfYield)} loading={loading} />
          <MetricRow
            label="FCF Per Share / Price"
            value={fcfPerShare !== null && price !== null ? `${formatMoney(fcfPerShare)} / ${formatMoney(price)}` : null}
            loading={loading}
          />
          <MetricRow label="SBC Adj. Free Cash Flow Yield" value={formatPercent(adjustedFcfYield)} loading={loading} />
          <MetricRow
            label="Adj. FCF Per Share / Price"
            value={adjustedFcfPerShare !== null && price !== null ? `${formatMoney(adjustedFcfPerShare)} / ${formatMoney(price)}` : null}
            loading={loading}
          />
          <MetricRow label="SBC Impact" value={formatPercent(sbcImpact, true)} loading={loading} />
        </MetricGroup>

        <MetricGroup title="Margins & Growth">
          <MetricRow label="Profit Margin" value={formatPercent(profitMargin)} loading={loading} />
          <MetricRow label="Operating Margin" value={formatPercent(operatingMargin)} loading={loading} />
          <MetricRow label="Quarterly Earnings (YoY)" value={formatPercent(yoyForLatestQuarter(incomeRows, "netIncome"), true)} loading={loading} />
          <MetricRow label="Quarterly Revenue (YoY)" value={formatPercent(yoyForLatestQuarter(incomeRows, "revenue"), true)} loading={loading} />
        </MetricGroup>

        <MetricGroup title="Balance">
          <MetricRow label="Cash" value={formatMoney(cash)} loading={loading} />
          <MetricRow label="Debt" value={formatMoney(debt)} loading={loading} />
          <MetricRow label="Net" value={formatMoney(net)} loading={loading} />
        </MetricGroup>

        <MetricGroup title="Dividend">
          <MetricRow label="Dividend Yield" value={formatPercent(dividendYield)} loading={loading} />
          <MetricRow label="Payout Ratio" value={formatPercent(payoutRatio)} loading={loading} />
          <MetricRow label="Payout Date" value={null} loading={loading} />
        </MetricGroup>
      </div>
    </div>
  );
}
