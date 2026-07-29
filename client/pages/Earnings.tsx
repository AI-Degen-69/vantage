import { useTranslation } from "react-i18next";
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import EarningsCalendar from "@/components/EarningsCalendar";

type MarketCapFilter = "all" | "large" | "mid" | "small";

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
 * Renders the earnings calendar with week navigation and filtering controls.
 *
 * @returns The earnings calendar page.
 */
export default function EarningsPage() {
  const { t } = useTranslation();
  const initial = useMemo(() => currentWeekRange(), []);
  const [offset, setOffset] = useState(0); // 0 = this week
  const [marketCap, setMarketCap] = useState<MarketCapFilter>("all");
  const [watchlistOnly, setWatchlistOnly] = useState(false);

  const { from, to } = useMemo(
    () => shiftRange(initial.from, initial.to, offset),
    [initial.from, initial.to, offset]
  );

  const isThisWeek = offset === 0;
  const hasPrev = offset > -8; // up to 8 weeks back
  const hasNext = offset < 4; // up to 4 weeks forward

  return (
    <div className="w-full bg-background dark min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">{t("sidebar.earnings")}</h1>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-border gap-4 flex-wrap">
          {/* Week Navigation */}
          <div className="flex items-center gap-2">
            <button
              disabled={!hasPrev}
              onClick={() => setOffset((o) => o - 1)}
              title={t("earningsCalendar.prevWeek")}
              className="p-2 hover:bg-slate-800 rounded-md transition-colors text-slate-400 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setOffset(0)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                isThisWeek
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              {t("earningsCalendar.today")}
            </button>
            <button
              disabled={!hasNext}
              onClick={() => setOffset((o) => o + 1)}
              title={t("earningsCalendar.nextWeek")}
              className="p-2 hover:bg-slate-800 rounded-md transition-colors text-slate-400 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <span className="ml-4 text-sm font-medium" dir="ltr">
              {t("earningsCalendar.weekOf", { range: formatHumanRange(from, to) })}
            </span>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-md text-sm border border-slate-700">
              <span className="text-slate-400">{t("earningsCalendar.marketCap")}</span>
              <select
                value={marketCap}
                onChange={(e) => setMarketCap(e.target.value as MarketCapFilter)}
                className="bg-transparent focus:outline-none text-foreground cursor-pointer"
              >
                <option value="all">{t("earningsCalendar.marketCapAll")}</option>
                <option value="large">{t("earningsCalendar.marketCapLarge")}</option>
                <option value="mid">{t("earningsCalendar.marketCapMid")}</option>
                <option value="small">{t("earningsCalendar.marketCapSmall")}</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={watchlistOnly}
                onChange={(e) => setWatchlistOnly(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 focus:ring-blue-500 cursor-pointer"
              />
              {t("earningsCalendar.filterByWatchlist")}
            </label>
          </div>
        </div>

        <EarningsCalendar
          from={from}
          to={to}
          marketCap={marketCap}
          watchlistOnly={watchlistOnly}
        />
      </div>
    </div>
  );
}
