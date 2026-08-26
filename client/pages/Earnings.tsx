import { useI18n } from "@/lib/i18n";
import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import EarningsCalendar, { type MarketCapFilter } from "@/components/EarningsCalendar";
import PageHeader from "@/components/PageHeader";
import DataLegend from "@/components/DataLegend";
import DataStatusBadge from "@/components/DataStatusBadge";

/**
 * Formats a date as an ISO calendar date.
 *
 * @param date - The date to format
 * @returns The date in `YYYY-MM-DD` format
 */
function formatISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Determines the Monday-to-Friday date range for the current week.
 *
 * @returns An object containing the Monday date in `from` and Friday date in `to`, formatted as `YYYY-MM-DD`.
 */
function currentWeekRange(): { from: string; to: string } {
  const today = new Date();
  const day = today.getDay(); // 0=Sun..6=Sat
  const diff = today.getDate() - day + (day === 0 ? -6 : 1); // back to Monday
  const monday = new Date(today);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return { from: formatISO(monday), to: formatISO(friday) };
}

/**
 * Shifts a date range by a specified number of weeks.
 *
 * @param from - The range start date in ISO date format
 * @param to - The range end date in ISO date format
 * @param weeks - The number of weeks to shift; positive values move forward and negative values move backward
 * @returns The shifted date range in ISO date format
 */
function shiftRange(from: string, to: string, weeks: number): { from: string; to: string } {
  const f = new Date(from);
  const t = new Date(to);
  f.setDate(f.getDate() + weeks * 7);
  t.setDate(t.getDate() + weeks * 7);
  return { from: formatISO(f), to: formatISO(t) };
}

/**
 * Formats a date range using abbreviated month names and numeric days.
 *
 * @param from - The range's start date
 * @param to - The range's end date
 * @returns The formatted date range
 */
function formatHumanRange(from: string, to: string): string {
  const f = new Date(from);
  const t = new Date(to);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(f)} – ${fmt(t)}`;
}

/**
 * Renders the earnings calendar with week navigation, market cap filtering,
 * watchlist toggles, and live telemetry data source attribution.
 *
 * Honors `?focus=AAPL&date=2025-09-15` URL parameters from the alert engine.
 *
 * @returns The earnings calendar page.
 */
export function EarningsPage() {
  const { t } = useI18n();
  const initial = useMemo(() => currentWeekRange(), []);
  const [offset, setOffset] = useState(0); // 0 = this week
  const [marketCap, setMarketCap] = useState<MarketCapFilter>("all");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [searchParams] = useSearchParams();
  const focusSymbol = searchParams.get("focus");
  const focusDate = searchParams.get("date");

  // When the user follows an alert "Open" link, shift to the week
  // containing `focusDate` so the calendar reveals the matching card.
  useEffect(() => {
    if (!focusDate) return;
    const target = new Date(focusDate);
    const base = new Date(initial.from);
    if (!Number.isFinite(target.getTime()) || !Number.isFinite(base.getTime())) {
      return;
    }
    const diffMs = target.getTime() - base.getTime();
    const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    setOffset(diffWeeks);
    setWatchlistOnly(true);
  }, [focusDate, initial.from]);

  const { from, to } = useMemo(
    () => shiftRange(initial.from, initial.to, offset),
    [initial.from, initial.to, offset]
  );

  // `forceWatchlistOnly` is auto-set while ?focus is in play regardless of
  // the user's checkbox so the focused row is guaranteed to be visible.
  const effectiveWatchlistOnly = watchlistOnly || !!focusSymbol;

  const isThisWeek = offset === 0;
  const hasPrev = offset > -8; // up to 8 weeks back
  const hasNext = offset < 4; // up to 4 weeks forward

  return (
    <div className="w-full bg-background dark min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <PageHeader
          eyebrow={t("nav.earnings")}
          title={t("earnings.title")}
          description={t("earnings.subtitle")}
          status="live"
          source="FMP & Yahoo Consensus"
          actions={
            <>
              <DataStatusBadge status="live" source="FMP Telemetry" />
              <DataLegend />
            </>
          }
        />

        {/* Global Controls Strip */}
        <div className="flex items-center justify-between bg-card/80 p-4 rounded-xl border border-border gap-4 flex-wrap shadow-sm">
          {/* Week Navigation */}
          <div className="flex items-center gap-2">
            <button
              disabled={!hasPrev}
              onClick={() => setOffset((o) => o - 1)}
              title={t("earningsCalendar.prevWeek")}
              aria-label={t("earningsCalendar.prevWeek")}
              className="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setOffset(0)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                isThisWeek
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {t("earningsCalendar.today")}
            </button>
            <button
              disabled={!hasNext}
              onClick={() => setOffset((o) => o + 1)}
              title={t("earningsCalendar.nextWeek")}
              aria-label={t("earningsCalendar.nextWeek")}
              className="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <span className="ml-4 text-sm font-medium text-foreground font-mono" dir="ltr">
              {t("earningsCalendar.weekOf", { range: formatHumanRange(from, to) })}
            </span>
          </div>

          {/* Filters: Market Cap + Watchlists */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg text-sm border border-border">
              <label htmlFor="earnings-market-cap-select" className="text-muted-foreground text-xs font-mono">
                {t("earningsCalendar.marketCap")}:
              </label>
              <select
                id="earnings-market-cap-select"
                aria-label={t("earningsCalendar.marketCap") || "Market Cap"}
                value={marketCap}
                onChange={(e) => setMarketCap(e.target.value as MarketCapFilter)}
                className="bg-transparent focus:outline-none text-foreground text-xs font-mono font-medium cursor-pointer"
              >
                <option value="all" className="bg-popover text-popover-foreground">{t("earningsCalendar.marketCapAll")}</option>
                <option value="large" className="bg-popover text-popover-foreground">{t("earningsCalendar.marketCapLarge")}</option>
                <option value="mid" className="bg-popover text-popover-foreground">{t("earningsCalendar.marketCapMid")}</option>
                <option value="small" className="bg-popover text-popover-foreground">{t("earningsCalendar.marketCapSmall")}</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors px-3 py-1.5 rounded-lg bg-secondary/30 border border-border">
              <input
                type="checkbox"
                checked={effectiveWatchlistOnly}
                onChange={(e) => setWatchlistOnly(e.target.checked)}
                className="rounded border-border bg-secondary text-primary focus:ring-primary cursor-pointer"
              />
              <span className="text-xs font-mono">{t("earningsCalendar.filterByWatchlist")}</span>
            </label>
          </div>
        </div>

        {/* Calendar / Grid Display */}
        <EarningsCalendar
          from={from}
          to={to}
          marketCap={marketCap}
          watchlistOnly={effectiveWatchlistOnly}
          focusSymbol={focusSymbol ?? undefined}
          focusDate={focusDate ?? undefined}
        />
      </div>
    </div>
  );
}

export default EarningsPage;
