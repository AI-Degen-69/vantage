import { useTranslation } from "react-i18next";
import { defaultWatchlist } from "@/lib/mockData";
import { Sun, Moon } from "lucide-react";
import { useEarningsCalendar } from "@/hooks/useStockData";
import { useMemo } from "react";

type MarketCapFilter = "all" | "large" | "mid" | "small";

interface EarningsCalendarProps {
  from: string;
  to: string;
  marketCap: MarketCapFilter;
  watchlistOnly: boolean;
}

const EventCard = ({ ev, t }: { ev: any; t: any }) => (
  <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 hover:border-slate-600 transition-colors">
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

function inMarketCapBucket(mc: number | undefined, filter: MarketCapFilter): boolean {
  if (filter === "all") return true;
  if (mc === undefined) return false; // no marketCap data → only shown under "All"
  if (filter === "large") return mc > 200_000_000_000;
  if (filter === "mid") return mc >= 10_000_000_000 && mc <= 200_000_000_000;
  if (filter === "small") return mc < 10_000_000_000;
  return true;
}

export default function EarningsCalendar({ from, to, marketCap, watchlistOnly }: EarningsCalendarProps) {
  const { t } = useTranslation();

  const { data, isLoading } = useEarningsCalendar(from, to);

  const eventsList = useMemo(() => {
    if (data && data.length > 0) {
      const watchlistSymbols = defaultWatchlist.map((w) => w.symbol);
      // FMP returns a LOT of earnings. Prioritize our watchlist, then large caps if possible.
      let filtered = data.filter(
        (e: any) => watchlistSymbols.includes(e.symbol) || (e.revenueEstimated && e.revenueEstimated > 5_000_000_000)
      );

      if (watchlistOnly) {
        filtered = filtered.filter((e: any) => watchlistSymbols.includes(e.symbol));
      }

      filtered = filtered.filter((e: any) => inMarketCapBucket(e.marketCap, marketCap));

      return filtered.slice(0, 25).map((e: any) => {
        const dateObj = new Date(e.date);
        const dayStr = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dateObj.getDay()];
        return {
          ticker: e.symbol,
          date: dayStr,
          epsEst: e.epsEstimated || 0,
          epsActual: e.eps,
          revEst: (e.revenueEstimated || 0) / 1e9,
          revActual: (e.revenue || 0) / 1e9,
          time: e.time === "amc" ? "After Close" : "Before Open",
          marketCap: e.marketCap,
          surprise: e.eps ? (e.eps > e.epsEstimated ? "beat" : "miss") : "none",
        };
      });
    }

    // Mock fallback — apply the same filters so the controls act on mock data too.
    let mockFiltered = mockEarningsEvents.slice(0, 25);
    if (watchlistOnly) {
      const watchlistSymbols = defaultWatchlist.map((w) => w.symbol);
      mockFiltered = mockFiltered.filter((e: any) => watchlistSymbols.includes(e.ticker));
    }
    mockFiltered = mockFiltered.filter((e: any) => inMarketCapBucket(e.marketCap, marketCap));
    return mockFiltered;
  }, [data, marketCap, watchlistOnly]);

  const isMock = !data || data.length === 0;
  const eventCount = eventsList.length;

  const days = [
    { key: "Mon", i18nKey: "earningsCalendar.mon" },
    { key: "Tue", i18nKey: "earningsCalendar.tue" },
    { key: "Wed", i18nKey: "earningsCalendar.wed" },
    { key: "Thu", i18nKey: "earningsCalendar.thu" },
    { key: "Fri", i18nKey: "earningsCalendar.fri" },
  ];

  const empty = eventCount === 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden relative">
      <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
        {!isLoading && (
          <span className="text-xs text-slate-400 bg-slate-800/60 px-2 py-1 rounded">
            {eventCount === 1
              ? t("earningsCalendar.showing", { count: eventCount })
              : t("earningsCalendar.showingPlural", { count: eventCount })}
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
            const events = eventsList.filter((e: any) => e.date === dayObj.key);
            return (
              <div key={dayObj.key} className="min-h-[400px]">
                <div className="bg-slate-900/50 p-4 border-b border-border text-center">
                  <span className="font-semibold text-foreground">{t(dayObj.i18nKey)}</span>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  {events.filter((e: any) => e.time === "Before Open").map((ev: any, i: number) => (
                    <EventCard key={`pre-${i}`} ev={ev} t={t} />
                  ))}

                  {events.some((e: any) => e.time === "Before Open") &&
                    events.some((e: any) => e.time === "After Close") && (
                      <div className="border-t-2 border-dashed border-slate-700/50" />
                    )}

                  {events.filter((e: any) => e.time === "After Close").map((ev: any, i: number) => (
                    <EventCard key={`post-${i}`} ev={ev} t={t} />
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
