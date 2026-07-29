import { useI18n } from "@/lib/i18n";
import { defaultWatchlist } from "@/lib/mockData";
import { Sun, Moon } from "lucide-react";
import { useEarningsCalendar } from "@/hooks/useStockData";
import { useEffect, useMemo, useRef } from "react";

type MarketCapFilter = "all" | "large" | "mid" | "small";

interface EarningsCalendarProps {
  from: string;
  to: string;
  marketCap: MarketCapFilter;
  watchlistOnly: boolean;
  focusSymbol?: string;
  focusDate?: string;
}

interface EventCardProps {
  ev: any;
  t: any;
  isFocus: boolean;
}

const EventCard = ({ ev, t, isFocus }: EventCardProps) => (
  <div
    data-focus-event={`${ev.ticker}-${ev.date}`}
    className={`bg-slate-800/50 rounded-lg p-3 border transition-colors ${
      isFocus
        ? "border-blue-500 ring-2 ring-blue-500/40 shadow-lg shadow-blue-500/20"
        : "border-slate-700/50 hover:border-slate-600"
    }`}
  >
    <div className="flex justify-between items-start mb-2">
      <div className="font-bold text-foreground text-lg">{ev.ticker}</div>
      <div
        className={`p-1.5 rounded-md ${
          ev.time === "Before Open" ? "bg-amber-500/20 text-amber-400" : "bg-purple-500/20 text-purple-400"
        }`}
        title={ev.time === "Before Open" ? t("earningsCalendar.beforeOpen") : t("earningsCalendar.afterClose")}
      >
        {ev.time === "Before Open" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </div>
    </div>

    <div className="space-y-1 text-xs">
      <div className="flex justify-between text-slate-400">
        <span>{t("earningsCalendar.epsEst")}</span>
        <span dir="ltr">${ev.epsEst.toFixed(2)}</span>
      </div>
      {ev.epsActual !== undefined && ev.epsActual !== null && (
        <div className="flex justify-between font-medium">
          <span>{t("earningsCalendar.actual")}</span>
          <span
            className={ev.surprise === "beat" ? "text-green-400" : ev.surprise === "miss" ? "text-red-400" : ""}
            dir="ltr"
          >
            ${ev.epsActual.toFixed(2)}
          </span>
        </div>
      )}
      <div className="flex justify-between text-slate-400 pt-1">
        <span>{t("earningsCalendar.revEst")}</span>
        <span dir="ltr">${ev.revEst.toFixed(2)}B</span>
      </div>
    </div>
  </div>
);

export const mockEarningsEvents = [
  { ticker: "NVDA", date: "Mon", epsEst: 5.59, revEst: 24.6, time: "After Close", marketCap: 2_130_000_000_000 },
  {
    ticker: "SNOW",
    date: "Tue",
    epsEst: 0.14,
    revEst: 0.749,
    time: "Before Open",
    surprise: "beat",
    epsActual: 0.18,
    revActual: 0.755,
    marketCap: 60_000_000_000,
  },
  {
    ticker: "MDT",
    date: "Wed",
    epsEst: 1.45,
    epsActual: 1.46,
    revEst: 8.44,
    revActual: 8.59,
    time: "Before Open",
    surprise: "beat",
    marketCap: 110_000_000_000,
  },
  { ticker: "INTU", date: "Wed", epsEst: 9.38, revEst: 6.64, time: "After Close", marketCap: 175_000_000_000 },
  { ticker: "TGT", date: "Thu", epsEst: 2.05, revEst: 24.5, time: "Before Open", marketCap: 65_000_000_000 },
  { ticker: "WDAY", date: "Thu", epsEst: 1.58, revEst: 1.97, time: "After Close", marketCap: 65_000_000_000 },
];

/**
 * Determines whether a market capitalization matches the selected filter.
 *
 * @param mc - The market capitalization to evaluate.
 * @param filter - The market-capacity bucket to apply
 * @returns `true` if the market capitalization matches the filter, `false` otherwise.
 */
function inMarketCapBucket(mc: number | undefined, filter: MarketCapFilter): boolean {
  if (filter === "all") return true;
  if (mc === undefined) return false; // no marketCap data → only shown under "All"
  if (filter === "large") return mc > 200_000_000_000;
  if (filter === "mid") return mc >= 10_000_000_000 && mc <= 200_000_000_000;
  if (filter === "small") return mc < 10_000_000_000;
  return true;
}

/**
 * Returns the weekday index for a YYYY-MM-DD ISO string. Defaults to 0
 * (Sunday) when the input is malformed so the row's `weekday` stays numeric
 * (the days grid silently drops unknown values).
 */
function weekdayOf(isoDate: string): number {
  const d = new Date(isoDate);
  return Number.isFinite(d.getTime()) ? d.getDay() : -1;
}

/**
 * Displays a filtered earnings calendar for a selected date range.
 *
 * @param from - Start date of the earnings data range
 * @param to - End date of the earnings data range
 * @param marketCap - Market-cap bucket used to filter events
 * @param watchlistOnly - Whether to show only watchlist events
 * @param focusSymbol - When set, the matching card renders with a blue ring
 * @param focusDate - The matching card's date (paired with focusSymbol)
 * @returns The rendered earnings calendar
 */
export default function EarningsCalendar({
  from,
  to,
  marketCap,
  watchlistOnly,
  focusSymbol,
  focusDate,
}: EarningsCalendarProps) {
  const { t } = useI18n();

  // Static seed list (curated universe). We deliberately do NOT call
  // `useWatchlists()` here — that hook is single-instance by design and
  // mounting a second instance from this page would let a same-tab
  // mutation on the Watchlists page diverge from what we see (the
  // browser's `storage` event does not fire in the originating tab).
  // The earnings-alert engine (TopBar) already handles the live
  // user-list union through its own `useEarningsAlerts` mount.
  const watchlistSymbols = useMemo(
    () => defaultWatchlist.map((w) => w.symbol),
    []
  );

  const { data, isLoading } = useEarningsCalendar(from, to);

  const eventsList = useMemo<Array<any>>(() => {
    if (data && data.length > 0) {
      // FMP returns a LOT of earnings. Prioritize our watchlist, then large caps if possible.
      let filtered = data.filter(
        (e: any) =>
          watchlistSymbols.includes((e.symbol ?? "").toUpperCase()) ||
          (e.revenueEstimated && e.revenueEstimated > 5_000_000_000)
      );

      if (watchlistOnly) {
        filtered = filtered.filter((e: any) =>
          watchlistSymbols.includes((e.symbol ?? "").toUpperCase())
        );
      }

      filtered = filtered.filter((e: any) => inMarketCapBucket(e.marketCap, marketCap));

      return filtered.slice(0, 25).map((e: any) => ({
        ticker: e.symbol,
        date: e.date,
        weekday: weekdayOf(e.date),
        epsEst: e.epsEstimated || 0,
        epsActual: e.eps,
        revEst: (e.revenueEstimated || 0) / 1e9,
        revActual: (e.revenue || 0) / 1e9,
        time: e.time === "amc" ? "After Close" : "Before Open",
        marketCap: e.marketCap,
        surprise: e.eps ? (e.eps > e.epsEstimated ? "beat" : "miss") : "none",
      }));
    }

    // Mock fallback — apply the same filters so the controls act on mock data too.
    let mockFiltered = mockEarningsEvents.slice(0, 25);
    if (watchlistOnly) {
      mockFiltered = mockFiltered.filter((e: any) =>
        watchlistSymbols.includes((e.ticker ?? "").toUpperCase())
      );
    }
    mockFiltered = mockFiltered.filter((e: any) => inMarketCapBucket(e.marketCap, marketCap));
    // Mock events use late-week weekdays; map English abbreviations back to
    // numeric weekday so the grid filters using the SAME comparison as the
    // real-data branch.
    const mockNameToWd: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return mockFiltered.map((e: any) => ({
      ...e,
      weekday: mockNameToWd[e.date] ?? -1,
    }));
  }, [data, marketCap, watchlistOnly, watchlistSymbols]);

  // Scroll the matching card into view once the calendar has rendered
  // it. We re-run on every `[focusSymbol, focusDate, eventsList]` change
  // so navigation back/forward (changing ?focus param) re-scrolls. Using
  // `didScrollRef` keeps subsequent refetches from harassing the
  // viewport with redundant smooth-scroll calls.
  const didScrollRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusSymbol || !focusDate) {
      didScrollRef.current = null;
      return;
    }
    const stamp = `${focusSymbol}|${focusDate}|${eventsList.length}`;
    if (didScrollRef.current === stamp) return;
    const el = document.querySelector(
      `[data-focus-event="${focusSymbol}-${focusDate}"]`
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      didScrollRef.current = stamp;
    }
  }, [focusSymbol, focusDate, eventsList.length, isLoading]);

  const isMock = !data || data.length === 0;
  const eventCount = eventsList.length;

  // Numeric weekday (1=Mon..5=Fri) so the grid matches by index instead of
  // trying to compare i18n strings across languages.
  const days = [
    { wd: 1, i18nKey: "earningsCalendar.mon" },
    { wd: 2, i18nKey: "earningsCalendar.tue" },
    { wd: 3, i18nKey: "earningsCalendar.wed" },
    { wd: 4, i18nKey: "earningsCalendar.thu" },
    { wd: 5, i18nKey: "earningsCalendar.fri" },
  ];

  const empty = eventCount === 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden relative">
      <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
        {!isLoading && (
          <span className="text-xs text-slate-400 bg-slate-800/60 px-2 py-1 rounded">
            {t("earningsCalendar.showing", { count: eventCount })}
          </span>
        )}
        {isMock && !isLoading && (
          <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">
            [MOCK]
          </span>
        )}
      </div>
      {empty && !isLoading ? (
        <div className="p-12 text-center text-slate-400">
          {t("earningsCalendar.noEventsThisWeek")}
        </div>
      ) : (
        <div className="grid grid-cols-5 divide-x divide-border rtl:divide-x-reverse">
          {days.map((dayObj) => {
            const events = eventsList.filter((e: any) => e.weekday === dayObj.wd);
            return (
              <div key={dayObj.wd} className="min-h-[400px]">
                <div className="bg-slate-900/50 p-4 border-b border-border text-center">
                  <span className="font-semibold text-foreground">{t(dayObj.i18nKey)}</span>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  {events.filter((e: any) => e.time === "Before Open").map((ev: any, i: number) => (
                    <EventCard
                      key={`pre-${ev.ticker}-${i}`}
                      ev={ev}
                      t={t}
                      isFocus={focusSymbol === ev.ticker && focusDate === ev.date}
                    />
                  ))}

                  {events.some((e: any) => e.time === "Before Open") &&
                    events.some((e: any) => e.time === "After Close") && (
                      <div className="border-t-2 border-dashed border-slate-700/50" />
                    )}

                  {events.filter((e: any) => e.time === "After Close").map((ev: any, i: number) => (
                    <EventCard
                      key={`post-${ev.ticker}-${i}`}
                      ev={ev}
                      t={t}
                      isFocus={focusSymbol === ev.ticker && focusDate === ev.date}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
