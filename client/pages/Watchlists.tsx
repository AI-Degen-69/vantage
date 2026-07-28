import { useTranslation } from "react-i18next";
import { defaultWatchlist, mockNews } from "@/lib/mockData";
import DipFinder from "@/components/DipFinder";
import { Link } from "react-router-dom";
import { useBatchQuotes } from "@/hooks/useStockData";
import { useMemo } from "react";

export default function Watchlists() {
  const { t } = useTranslation();

  const symbols = useMemo(() => defaultWatchlist.map(w => w.symbol), []);
  const { data: batch } = useBatchQuotes(symbols);
  const quotes = batch?.quotes;

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
                <div className="flex justify-between items-center border-b border-border pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center font-bold text-xs">NVDA</div>
                    <div>
                      <p className="font-semibold text-sm">NVIDIA</p>
                      <p className="text-xs text-muted-foreground">May 22, After Close</p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center border-b border-border pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center font-bold text-xs">CRM</div>
                    <div>
                      <p className="font-semibold text-sm">Salesforce</p>
                      <p className="text-xs text-muted-foreground">May 29, After Close</p>
                    </div>
                  </div>
                </div>
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
