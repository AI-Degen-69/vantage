import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { portfolios } from "@/lib/mockData";
import {
  useBatchQuotes,
  useFxRates,
  useMultiChart,
  useEarningsCalendar,
} from "@/hooks/useStockData";
import {
  annualizedVolatility,
  cagr as cagrOf,
  irrBisection,
  sharpeRatio as sharpeOf,
  sortinoRatio as sortinoOf,
} from "@/lib/finance";
import { ChevronDown, RefreshCw, Calendar } from "lucide-react";
import type { FxCurrency, StockQuote } from "@shared/api";

type Currency = FxCurrency;
type SortKey = "volatility" | "sharpe" | "weight" | "gainLoss";

const CURRENCY_OPTIONS: { value: Currency; symbol: string; labelKey: string }[] = [
  { value: "USD", symbol: "$", labelKey: "common.usd" },
  { value: "ILS", symbol: "\u20AA", labelKey: "common.ils" },
  { value: "EUR", symbol: "\u20AC", labelKey: "common.eur" },
  { value: "GBP", symbol: "\u00A3", labelKey: "common.gbp" },
];

function fmtMoney(value: number | null | undefined, currency: Currency, compact = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "\u2014";
  const fractionDigits = compact ? 0 : 2;
  const opts: Intl.NumberFormatOptions = {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  };
  try {
    return new Intl.NumberFormat(undefined, opts).format(value);
  } catch {
    // Fall back to plain prefix if Intl currency isn't supported in this runtime.
    const sym = CURRENCY_OPTIONS.find((c) => c.value === currency)?.symbol ?? "$";
    return `${sym}${value.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;
  }
}

function fmtPct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "\u2014";
  return `${(value * 100).toFixed(digits)}%`;
}

/** Close→close series for `useMultiChart` results. */
function historicalCloses(chart: { historical?: { close: number }[] } | null | undefined): number[] {
  if (!chart || !chart.historical) return [];
  return chart.historical
    .map((p) => Number(p.close))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export default function Portfolio() {
  const { t } = useTranslation();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState(portfolios[0].id);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [divOverlay, setDivOverlay] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("weight");

  const activePortfolio = portfolios.find((p) => p.id === selectedPortfolioId) || portfolios[0];

  // ---- Live data wiring --------------------------------------------------
  const symbols = useMemo(() => activePortfolio.holdings.map((h) => h.ticker), [activePortfolio]);

  // FX is requested for the union of USD + chosen currency so the multiplier
  // paints every display value correctly.
  const { data: fxData, isLoading: fxLoading } = useFxRates(
    useMemo(() => Array.from(new Set(["USD", currency])), [currency])
  );

  const { data: batch, isLoading: quotesLoading } = useBatchQuotes(symbols);
  const quotes = (batch?.quotes ?? []) as (StockQuote | null)[];

  // For the dividend overlay we'll surface the next earnings / payday event.
  const { from: today, to: plusEightWeeks } = useMemo(() => {
    const f = new Date();
    const t = new Date();
    t.setDate(t.getDate() + 56); // 8 weeks
    return {
      from: f.toISOString().slice(0, 10),
      to: t.toISOString().slice(0, 10),
    };
  }, []);
  const { data: earningsData } = useEarningsCalendar(today, plusEightWeeks);

  // Per-holding 1Y chart for vol/Sharpe; cached 1h server-side so 12 charts
  // cost ~1 round trip per refetch.
  const chartResults = useMultiChart(symbols);

  // ---- FX multiplier ------------------------------------------------------
  // fxRate.rates["USDILS"] = 3.75 (i.e. 1 USD = 3.75 ILS). Multiply USD value
  // by this to get ILS. Round-trip USDUSD = 1 baseline.
  const fxRate = useMemo(() => {
    if (currency === "USD") return 1;
    const pair = `USD${currency}`;
    return fxData?.rates?.[pair] ?? null;
  }, [currency, fxData?.rates]);

  const fxFailed = !fxLoading && fxData && Object.keys(fxData.rates).length <= 1;

  // ---- Portfolio-level analytics (USD; we multiply once at display) ------
  const portfolioMetrics = useMemo(() => {
    const irrRes = irrBisection(activePortfolio.cashflows);
    const sumInvested = activePortfolio.cashflows
      .filter((c) => c.amount < 0)
      .reduce((s, c) => s + c.amount, 0);
    const yearsSpan = 1; // synthesizeCashflows spans exactly 12 months
    const cagrVal = cagrOf(Math.abs(sumInvested), activePortfolio.currentValue + activePortfolio.gainLoss, yearsSpan);
    return {
      irr: irrRes.rate,
      irrReason: irrRes.reason,
      cagr: cagrVal,
    };
  }, [activePortfolio]);

  // ---- Per-holding analytics --------------------------------------------
  const holdingsData = useMemo(() => {
    return activePortfolio.holdings.map((holding, i) => {
      const liveQuote = quotes[i];
      const livePrice = liveQuote?.price ?? null;
      const liveChange = liveQuote?.changesPercentage ?? null;
      const chart = chartResults[i]?.data ?? null;
      const closes = historicalCloses(chart);
      const vol = annualizedVolatility(closes);
      const sharpe = sharpeOf(closes);
      const sortino = sortinoOf(closes);
      const totalRet = closes.length >= 2 ? closes[closes.length - 1] / closes[0] - 1 : null;
      return {
        ...holding,
        ticker: holding.ticker,
        weight: holding.weight,
        gainLoss: holding.gainLoss,
        livePrice,
        liveChange,
        volatility: vol,
        sharpe,
        sortino,
        totalReturn: totalRet,
      };
    });
  }, [activePortfolio, quotes, chartResults]);

  // Sort the holdings table by the chosen risk metric.
  const sortedHoldings = useMemo(() => {
    const arr = [...holdingsData];
    arr.sort((a, b) => {
      switch (sortKey) {
        case "volatility":
          return (b.volatility ?? -Infinity) - (a.volatility ?? -Infinity);
        case "sharpe":
          return (b.sharpe ?? -Infinity) - (a.sharpe ?? -Infinity);
        case "weight":
          return b.weight - a.weight;
        case "gainLoss":
        default:
          return b.gainLoss - a.gainLoss;
      }
    });
    return arr;
  }, [holdingsData, sortKey]);

  // ---- Display helpers ---------------------------------------------------
  /**
   * USD → display currency conversion. Returns null when conversion cannot be
   * done honestly (FX missing); the UI shows em-dash and we surface an FX
   * banner above the KPI strip so the user is never silently shown USD values
   * while the currency dropdown reads ILS / EUR / GBP.
   */
  const usd2display = (usd: number | null | undefined) => {
    if (usd === null || usd === undefined || !Number.isFinite(usd)) return null;
    if (currency === "USD") return usd;
    if (fxRate === null) return null; // FX down → can't honestly convert
    return usd * fxRate;
  };

  // Derived gain/loss from the cashflow series — keeps KPI + IRR consistent.
  const derivedGainLoss = useMemo(
    () => activePortfolio.cashflows.reduce((s, c) => s + c.amount, 0),
    [activePortfolio]
  );
  const gainLossFxAware = usd2display(derivedGainLoss);
  const gainLossPct =
    activePortfolio.currentValue > 0
      ? (derivedGainLoss / activePortfolio.currentValue) * 100
      : 0;

  const currentValueDisplay = usd2display(activePortfolio.currentValue);
  const annualIncomeDisplay = usd2display(activePortfolio.annualIncome);

  const liveCount = quotes.filter(Boolean).length;

  return (
    <div className="space-y-8">
      {/* ---- Top-of-page FX-fallback banner (only when conversion can't be honest) ---- */}
      {currency !== "USD" && (fxLoading || fxRate === null) && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-300 flex items-start gap-2" role="status">
          <span className="font-semibold uppercase tracking-wide text-[10px] mt-0.5">FX</span>
          <div>
            {t("portfolio.fxBannerBody")}
            <span className="text-yellow-400 ml-1">[{t("portfolio.fxStale")}]</span>
          </div>
        </div>
      )}

      {/* ---- Controls (portfolio picker, currency, div overlay, refresh) ---- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <select
              value={selectedPortfolioId}
              onChange={(e) => setSelectedPortfolioId(e.target.value)}
              className="appearance-none bg-slate-800 border border-slate-700 text-lg font-bold py-2 pl-4 pr-10 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer text-foreground"
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="appearance-none bg-slate-800 border border-slate-700 text-sm py-2.5 pl-4 pr-10 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer text-foreground"
            >
              {CURRENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.symbol} {opt.value}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer px-3 py-2 bg-slate-800/40 rounded-md border border-slate-700/50">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="checkbox"
              checked={divOverlay}
              onChange={(e) => setDivOverlay(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 focus:ring-blue-500 cursor-pointer"
            />
            {t("portfolio.divOverlay")}
          </label>
        </div>

        <div className="flex items-center gap-2">
          {fxFailed && (
            <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded text-yellow-400 bg-yellow-500/10">
              {t("portfolio.fxStale")}
            </span>
          )}
          {liveCount > 0 && liveCount < symbols.length && (
            <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded text-amber-300 bg-amber-500/10">
              {t("portfolio.partial")} {liveCount}/{symbols.length}
            </span>
          )}
          {liveCount === 0 && !quotesLoading && (
            <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded text-yellow-400 bg-yellow-500/10">
              [MOCK] {t("portfolio.noPrice")}
            </span>
          )}
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4" />
            {t("portfolio.updatePortfolio")}
          </button>
        </div>
      </div>

      {/* ---- Top KPI strip (currency-converted) ---- */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm text-slate-400 mb-2">{t("portfolio.currentValue")}</p>
          <p className="text-2xl font-bold text-foreground" dir="ltr">
            {fmtMoney(currentValueDisplay, currency, true)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm text-slate-400 mb-2 whitespace-nowrap">{t("portfolio.gainLoss")}</p>
          <p className={`text-2xl font-bold ${(gainLossFxAware ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`} dir="ltr">
            {gainLossFxAware === null ? "\u2014" : fmtMoney(gainLossFxAware, currency, false)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm text-slate-400 mb-2 whitespace-nowrap">{t("portfolio.gainLossPct")}</p>
          <p className={`text-2xl font-bold ${gainLossPct >= 0 ? "text-green-400" : "text-red-400"}`} dir="ltr">
            {gainLossPct >= 0 ? "+" : ""}{gainLossPct.toFixed(2)}%
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm text-slate-400 mb-2">{t("portfolio.annualIncome")}</p>
          <p className="text-2xl font-bold text-blue-400" dir="ltr">
            {fmtMoney(annualIncomeDisplay, currency, false)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm text-slate-400 mb-2 whitespace-nowrap">{t("portfolio.dividendYield")}</p>
          <p className="text-2xl font-bold text-blue-400" dir="ltr">
            {activePortfolio.dividendYield.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* ---- Analytics strip (IRR, CAGR, Vol, Sharpe, Sortino) ---- */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">{t("portfolio.analyticsTitle")}</h3>
          <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded text-amber-300 bg-amber-500/10">
            {t("portfolio.derived")}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-1">{t("portfolio.irr")}</p>
            <p className={`text-xl font-bold ${(portfolioMetrics.irr ?? -1) >= 0 ? "text-green-400" : "text-red-400"}`} dir="ltr">
              {portfolioMetrics.irr === null ? "\u2014" : fmtPct(portfolioMetrics.irr)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">{t("portfolio.synthCashflows")}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">{t("portfolio.cagr")}</p>
            <p className={`text-xl font-bold ${(portfolioMetrics.cagr ?? -1) >= 0 ? "text-green-400" : "text-red-400"}`} dir="ltr">
              {fmtPct(portfolioMetrics.cagr)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">{t("portfolio.oneYearBasis")}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">{t("portfolio.volatility")}</p>
            <p className="text-xl font-bold text-amber-400" dir="ltr">
              {fmtPct(sortedHoldings.reduce((s, h) => s + (h.volatility ?? 0) * (h.weight / 100), 0))}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">{t("portfolio.weightedAvg")}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">{t("portfolio.sharpe")}</p>
            <p className="text-xl font-bold text-blue-400" dir="ltr">
              {(() => {
                const ws = sortedHoldings.reduce((s, h) => s + (h.sharpe ?? 0) * (h.weight / 100), 0);
                return Number.isFinite(ws) ? ws.toFixed(2) : "\u2014";
              })()}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">rf 4.5%</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">{t("portfolio.sortino")}</p>
            <p className="text-xl font-bold text-blue-400" dir="ltr">
              {(() => {
                const ws = sortedHoldings.reduce((s, h) => s + (h.sortino ?? 0) * (h.weight / 100), 0);
                return Number.isFinite(ws) ? ws.toFixed(2) : "\u2014";
              })()}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">{t("portfolio.downsideOnly")}</p>
          </div>
        </div>
      </div>

      {/* ---- Holdings table per-holding volatility + dividend overlay ---- */}
      <div className="bg-card border border-border rounded-xl p-6 relative">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <h3 className="text-xl font-bold">{t("portfolio.holdings")}</h3>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{t("portfolio.sortBy")}:</span>
            <div className="relative">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="appearance-none bg-slate-800 border border-slate-700 text-xs font-medium py-1.5 pl-3 pr-8 rounded-md focus:outline-none focus:border-blue-500 cursor-pointer text-foreground"
              >
                <option value="weight">{t("portfolio.weight")}</option>
                <option value="gainLoss">{t("portfolio.gainLoss")}</option>
                <option value="volatility">{t("portfolio.volatility")}</option>
                <option value="sharpe">{t("portfolio.sharpe")}</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-start">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border">
              <tr>
                <th className="pb-3 font-medium">{t("common.symbol")}</th>
                <th className="pb-3 font-medium text-right">{t("common.price")}</th>
                <th className="pb-3 font-medium text-right">{t("common.change")}</th>
                <th className="pb-3 font-medium text-right">{t("portfolio.weight")}</th>
                <th className="pb-3 font-medium text-right">{t("portfolio.gainLoss")}</th>
                <th className="pb-3 font-medium text-right">{t("portfolio.volatility")}</th>
                <th className="pb-3 font-medium text-right">{t("portfolio.sharpe")}</th>
                {divOverlay && <th className="pb-3 font-medium text-right">{t("portfolio.nextEvent")}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedHoldings.map((h, i) => {
                const nextEarning = (earningsData ?? []).find((e) => e.symbol === h.ticker);
                const todayStr = new Date().toISOString().slice(0, 10);
                const eventDate = nextEarning?.date ?? "";
                const eventSoon =
                  eventDate && eventDate >= todayStr && eventDate <= plusEightWeeks;
                return (
                  <tr key={h.ticker + i} className="hover:bg-slate-800/30 transition-colors border-b border-border last:border-0">
                    <td className="py-4 font-bold text-base">{h.ticker}</td>
                    <td className="py-4 text-right font-medium" dir="ltr">
                      {h.livePrice !== null
                        ? fmtMoney(usd2display(h.livePrice), currency, false)
                        : "\u2014"}
                    </td>
                    <td className={`py-4 text-right font-medium ${(h.liveChange ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`} dir="ltr">
                      {h.liveChange === null || h.liveChange === undefined
                        ? "\u2014"
                        : `${h.liveChange >= 0 ? "+" : ""}${h.liveChange.toFixed(2)}%`}
                    </td>
                    <td className="py-4 text-right font-medium" dir="ltr">{h.weight.toFixed(1)}%</td>
                    <td className={`py-4 text-right font-medium whitespace-nowrap ${h.gainLoss >= 0 ? "text-green-400" : "text-red-400"}`} dir="ltr">
                      {h.gainLoss >= 0 ? "+" : ""}{h.gainLoss.toFixed(2)}%
                    </td>
                    <td className="py-4 text-right font-medium text-amber-400" dir="ltr">
                      {fmtPct(h.volatility)}
                    </td>
                    <td className="py-4 text-right font-medium text-blue-400" dir="ltr">
                      {h.sharpe !== null && Number.isFinite(h.sharpe) ? h.sharpe.toFixed(2) : "\u2014"}
                    </td>
                    {divOverlay && (
                      <td className="py-4 text-right text-xs text-slate-300" dir="ltr">
                        {eventSoon
                          ? `${eventDate} (${nextEarning!.time === "bmo" ? "BMO" : "AMC"})`
                          : "\u2014"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Below-the-fold: plain-language analytics paragraphs ------------- */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 text-sm text-slate-300 space-y-2">
        <p>
          <span className="text-slate-200 font-semibold">{t("portfolio.irrExplainTitle")}:</span>{" "}
          {t("portfolio.irrExplainBody", {
            rate: portfolioMetrics.irr === null ? "—" : fmtPct(portfolioMetrics.irr),
          })}
        </p>
        <p className="text-xs text-slate-500">
          {t("portfolio.reviewReminder")}
        </p>
      </div>
    </div>
  );
}
