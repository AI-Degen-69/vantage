import { useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import DCFWidget from "@/components/DCFWidget";
import { SectionCardSkeleton, HeaderPriceSkeleton } from "@/components/Skeleton";
import TickerLogo from "@/components/TickerLogo";
import { useStockQuote, useStockProfile } from "@/hooks/useStockData";
import { TrendingUp, TrendingDown, BarChart3, Calendar, Building2 } from "lucide-react";

/**
 * Displays a discounted cash flow valuation chart for the selected stock ticker.
 *
 * @returns The charts page with a loading placeholder or valuation widget.
 */
export default function Charts() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const ticker = (searchParams.get("ticker") || "AAPL").toUpperCase();

  // DCF math depends on the live quote — never feed a hardcoded number.
  const { data: quoteData, isLoading: quoteLoading } = useStockQuote(ticker);
  // Profile gives us a friendly company name for the page header.
  const { data: profileData, isLoading: profileLoading } = useStockProfile(ticker);
  const currentPrice = quoteData?.price;

  const dayLow = quoteData?.dayLow ?? null;
  const dayHigh = quoteData?.dayHigh ?? null;
  const yearLow = quoteData?.yearLow ?? null;
  const yearHigh = quoteData?.yearHigh ?? null;
  // `shareDrift` is the price's fractional position along (dayLow … dayHigh)
  // and drives the dot's left%. The caption beneath uses `midpointGap` —
  // the absolute-dollar offset between current and midpoint — so the
  // readback matches the visible `$${dayLow} – $${dayHigh}` axis labels.
  // The previously-used version rendered "+X%" of midpoint, which read as
  // position-in-range to a hurried eye; the absolute-dollar copy is
  // unambiguous. See code-review polish pass for context.
  const dayMidpoint =
    dayLow !== null && dayHigh !== null && dayHigh > dayLow ? (dayLow + dayHigh) / 2 : null;
  const midpointGap =
    currentPrice !== undefined && dayMidpoint !== null ? currentPrice - dayMidpoint : null;
  const shareDrift =
    dayLow !== null && dayHigh !== null && dayHigh > dayLow && currentPrice !== undefined
      ? (currentPrice - dayLow) / (dayHigh - dayLow)
      : null;
  const midpointCaption =
    midpointGap === null
      ? null
      : midpointGap >= 0
        ? t("charts.aboveMidpoint", { amount: midpointGap.toFixed(2) })
        : t("charts.belowMidpoint", { amount: Math.abs(midpointGap).toFixed(2) });

  return (
    <div className="w-full bg-background dark min-h-screen p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header strip — ticker + company + price + day/year range */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <TickerLogo ticker={ticker} size="md" />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-foreground truncate">
                {profileLoading ? "…" : profileData?.companyName ?? ticker}
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
                <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-foreground font-bold" dir="ltr">
                  {ticker}
                </span>
                {profileData?.exchange && (
                  <>
                    <span>&bull;</span>
                    <span dir="ltr">{profileData.exchange}</span>
                  </>
                )}
                {profileData?.sector && (
                  <>
                    <span>&bull;</span>
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {profileData.sector}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-foreground self-start">{t("nav.charts")}</h2>
        </div>

        {/* Price + range card */}
        <div className="bg-card border border-border rounded-xl p-6">
          {quoteLoading ? (
            <HeaderPriceSkeleton />
          ) : !currentPrice ? (
            <div className="text-center text-slate-400 text-xl">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              {t("index.unavailableApi")}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Price + change */}
              <div className="flex flex-col items-start justify-center">
                <span className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  {t("common.price")}
                </span>
                <span className="text-4xl font-bold text-foreground" dir="ltr">
                  ${currentPrice.toFixed(2)}
                </span>
                <span
                  className={`mt-1 px-2 py-0.5 rounded text-sm font-semibold ${
                    (quoteData?.change ?? 0) >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  }`}
                  dir="ltr"
                >
                  {(quoteData?.change ?? 0) >= 0 ? "+" : ""}
                  {(quoteData?.change ?? 0).toFixed(2)} (
                  {(quoteData?.changesPercentage ?? 0) >= 0 ? "+" : ""}
                  {(quoteData?.changesPercentage ?? 0).toFixed(2)}%)
                </span>
              </div>

              {/* Day range */}
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  {t("charts.dayRange")}
                </span>
                {dayLow !== null && dayHigh !== null ? (
                  <>
                    <DualRange
                      low={dayLow}
                      high={dayHigh}
                      current={currentPrice}
                      label={`$${dayLow.toFixed(2)} – $${dayHigh.toFixed(2)}`}
                    />
                    {midpointCaption && (
                      <p className="text-[10px] text-muted-foreground mt-2" dir="ltr">
                        {midpointCaption}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-500">—</p>
                )}
              </div>

              {/* 52-week range */}
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  {t("charts.weekRange")}
                </span>
                {yearLow !== null && yearHigh !== null ? (
                  <>
                    <DualRange
                      low={yearLow}
                      high={yearHigh}
                      current={currentPrice}
                      label={`$${yearLow.toFixed(2)} – $${yearHigh.toFixed(2)}`}
                    />
                  </>
                ) : (
                  <p className="text-sm text-slate-500">—</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* DCF widget */}
        {quoteLoading || currentPrice == null ? (
          <SectionCardSkeleton height={360} />
        ) : (
          <DCFWidget currentPrice={currentPrice} />
        )}

        {/* Footer hint card */}
        {!quoteLoading && currentPrice && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 flex items-center gap-3">
            <Calendar className="w-4 h-4 shrink-0" />
            <span>
              {t("charts.dcfGuidance")}
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-slate-500">
              <TrendingUp className="w-3 h-3" />
              <TrendingDown className="w-3 h-3" />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Horizontal dual-marker range visualization (low / current / high).
 * Renders a thin track between {low, high}, a dot for `current`, and a
 * caption beneath. Used twice on Charts page (day range + 52w range).
 */
function DualRange({
  low,
  high,
  current,
  label,
}: {
  low: number;
  high: number;
  current: number;
  label: string;
}) {
  const pct =
    high > low ? Math.min(100, Math.max(0, ((current - low) / (high - low)) * 100)) : 50;
  return (
    <div>
      <div className="relative h-2 rounded-full bg-slate-800 overflow-visible">
        <div
          className="absolute -top-1.5 h-5 w-5 rounded-full bg-blue-500 ring-2 ring-blue-500/30 shadow-md transition-all"
          style={{ left: `calc(${pct}% - 0.625rem)` }}
        />
      </div>
      <div className="flex justify-between items-center mt-3 text-xs">
        <span className="text-red-400 font-medium" dir="ltr">
          ${low.toFixed(2)}
        </span>
        <span className="text-slate-300" dir="ltr">
          {label}
        </span>
        <span className="text-green-400 font-medium" dir="ltr">
          ${high.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
