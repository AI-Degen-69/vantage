import { useTranslation } from "react-i18next";
import { defaultWatchlist, mockNews } from "@/lib/mockData";
import DipFinder from "@/components/DipFinder";
import { Link } from "react-router-dom";
import { useBatchQuotes, useEarningsCalendar } from "@/hooks/useStockData";
import { formatTradeDateShort } from "@/lib/finance";
import { useMemo } from "react";

export default function Watchlists() {
  const { t, i18n } = useTranslation();

  const symbols = useMemo(() => defaultWatchlist.map(w => w.symbol), []);

  // Earliest-today → +14 days covers the next two earnings windows for any
  // watchlist symbol without spamming the calendar endpoint.
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const horizon = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  }, []);

  const { data: batch } = useBatchQuotes(symbols);
  const { data: earnings, isLoading: earningsLoading } = useEarningsCalendar(today, horizon);
  const quotes = batch?.quotes;

  const watchlistEarnings = useMemo(() => {
    if (!earnings) return [];
    const symbolSet = new Set(symbols);
    return earnings
      .filter((e) => symbolSet.has(e.symbol))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(0, 5);
  }, [earnings, symbols]);

  const watchlistData = useMemo(() => {
    return defaultWatchlist.map(stock => {
      const q = (quotes || []).find((q) => q?.symbol === stock.symbol);
      return {
        ...stock,
        price: q ? q.price : stock.price,
        changePercent: q ? q.changesPercentage : stock.changePercent
      };
    });
  }, [quotes]);

  return (
    <div className="w-full bg-background dark min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-foreground">{t("sidebar.watchlists")}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Watchlist - Left 2 columns */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-card border border-border rounded-xl overflow-hidden relative">
              {(!quotes || quotes.length === 0) && (
                <div className="absolute top-2 right-2 text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">
                  [MOCK]
                </div>
              )}
              <table className="w-full text-sm text-start">
                <thead className="bg-slate-900/50 text-xs text-muted-foreground uppercase border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-medium">{t("common.symbol")}</th>
                    <th className="px-6 py-4 font-medium">{t("common.name")}</th>
                    <th className="px-6 py-4 font-medium text-right">{t("common.price")}</th>
                    <th className="px-6 py-4 font-medium text-right">{t("common.change")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {watchlistData.map(stock => (
                    <tr key={stock.symbol} className="hover:bg-slate-800/30 transition-colors border-b border-border last:border-0">
                      <td className="px-6 py-4 font-bold">
                        <Link to={`/stock/${stock.symbol}`} className="hover:text-blue-400 transition-colors">
                          {stock.symbol}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{stock.name}</td>
                      <td className="px-6 py-4 text-right font-medium" dir="ltr">
                        ${stock.price.toFixed(2)}
                      </td>
                      <td className={`px-6 py-4 text-right font-medium ${stock.changePercent >= 0 ? "text-green-400" : "text-red-400"}`} dir="ltr">
                        {stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sidebar - Right column */}
          <div className="space-y-8">
            <DipFinder />
            
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4">{t("dipFinder.upcomingEarnings")}</h3>
              <div className="space-y-4">
                {earningsLoading ? (
                  <p className="text-xs text-muted-foreground">…</p>
                ) : watchlistEarnings.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{i18n.language?.startsWith("he") ? "אין אירועים ב-14 ימים הקרובים" : "No upcoming earnings in the next 14 days."}</p>
                ) : (
                  watchlistEarnings.map((e) => {
                    // formatTradeDateShort returns the locale-aware "Mon Day"
                    // label ("Aug 15" in en-US, "15 באוג׳" in he-IL); fall
                    // back to the raw ISO if upstream handed us something
                    // the utility can't render. The bmo→beforeOpen /
                    // amc→afterClose mapping is earnings-specific and stays
                    // inline.
                    const dateLabel = formatTradeDateShort(e.date) ?? e.date;
                    const timeLabel =
                      e.time === "bmo" ? "earningsCalendar.beforeOpen" : "earningsCalendar.afterClose";
                    const name = defaultWatchlist.find((w) => w.symbol === e.symbol)?.name ?? e.symbol;
                    return (
                      <div
                        key={`${e.symbol}-${e.date}`}
                        className="flex justify-between items-center border-b border-border pb-3 last:border-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center font-bold text-xs">
                            {e.symbol}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{name}</p>
                            <p className="text-xs text-muted-foreground" dir="ltr">
                              {dateLabel}, {t(timeLabel)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4">{t("dipFinder.news")}</h3>
              <div className="space-y-4">
                {mockNews.slice(0, 3).map((news, i) => (
                  <a key={i} href={news.url} className="block group border-b border-border last:border-0 pb-4 last:pb-0">
                    <p className="text-sm font-medium group-hover:text-blue-400 transition-colors line-clamp-2 mb-1">
                      {news.headline}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold">{news.publisher}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
