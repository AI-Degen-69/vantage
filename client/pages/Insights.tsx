import { useState, useMemo } from "react";
import { Search, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInsightsTab, useBatchQuotes } from "@/hooks/useStockData";
import type { InsightsTabId, StockQuote } from "@shared/api";

const TABS: { id: InsightsTabId; i18nKey: string }[] = [
  { id: "sp500", i18nKey: "insights.tabs.sp500" },
  { id: "trending", i18nKey: "insights.tabs.trending" },
  { id: "growth", i18nKey: "insights.tabs.growth" },
  { id: "dividend", i18nKey: "insights.tabs.dividend" },
  { id: "buyback", i18nKey: "insights.tabs.buyback" },
  { id: "ai", i18nKey: "insights.tabs.ai" },
  { id: "cloud", i18nKey: "insights.tabs.cloud" },
  { id: "ev", i18nKey: "insights.tabs.ev" },
  { id: "leisure", i18nKey: "insights.tabs.leisure" },
];

/**
 * Formats a market capitalization value using a compact human-readable unit.
 *
 * @param mc - The market capitalization value to format
 * @returns A formatted market capitalization string, or an em dash when the value is missing or not finite
 */
function formatMarketCap(mc: number | undefined): string {
  if (mc === undefined || mc === null || !Number.isFinite(mc)) return "—";
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(1)}M`;
  return `$${mc.toLocaleString()}`;
}

/**
 * Displays searchable market insights with tabbed stock universes and live quote data.
 *
 * @returns The rendered insights page.
 */
export default function Insights() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<InsightsTabId>("sp500");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: tabData, isLoading: tabLoading, isFetching: tabFetching } = useInsightsTab(activeTab);

  // Pull live quotes for whatever universe the server returned.
  const symbols = useMemo(() => tabData?.entries.map((e) => e.symbol) ?? [], [tabData]);
  const { data: quoteData, isLoading: quotesLoading, isFetching: quotesFetching } = useBatchQuotes(symbols);

  // merge: universe row + matched live quote (by symbol) → UI card model.
  const merged = useMemo(() => {
    const bySymbol = new Map<string, StockQuote>();
    for (const q of quoteData?.quotes ?? []) {
      if (q && q.symbol) bySymbol.set(q.symbol.toUpperCase(), q);
    }
    return (tabData?.entries ?? []).map((entry) => {
      const live = bySymbol.get(entry.symbol.toUpperCase()) ?? null;
      return {
        symbol: entry.symbol,
        name: entry.name,
        sector: entry.sector ?? "",
        price: live?.price,
        change: live?.change,
        changePercent: live?.changesPercentage,
        marketCap: live?.marketCap,
      };
    });
  }, [tabData, quoteData]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return merged.filter(
      (row) => row.symbol.toLowerCase().includes(q) || row.name.toLowerCase().includes(q)
    );
  }, [merged, searchQuery]);

  // Card-level [LIVE] / [MOCK] comes from whether ANY quote landed.
  const liveCount = merged.filter((r) => r.price !== undefined).length;
  const totalCount = merged.length;
  const isLive = liveCount === totalCount && totalCount > 0;
  const isAnyLive = liveCount > 0;

  return (
    <div className="w-full bg-background dark min-h-screen">
      {/* Header */}
      <div className="bg-slate-800/50 border-b border-slate-700 px-8 py-12">
        <h1 className="text-4xl font-bold text-center text-foreground mb-8">{t("insights.title")}</h1>
        <div className="max-w-2xl mx-auto">
          <div className="relative flex items-center bg-slate-700/50 border border-slate-600 rounded-lg overflow-hidden">
            <Search className="w-4 h-4 ms-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder={t("insights.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none border-0 px-4 py-3 text-foreground placeholder-slate-400"
            />
            <button className="flex items-center justify-center px-3 py-3 text-slate-400 hover:text-blue-400 transition-colors border-s border-slate-600">
              <Settings className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-slate-800/30 border-b border-slate-700 overflow-x-auto">
        <div className="flex px-8 space-x-1 items-center">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-foreground"
              }`}
            >
              {t(tab.i18nKey)}
            </button>
          ))}
          <div className="ms-auto flex items-center gap-2 py-2">
            <span
              className={`text-[10px] font-medium uppercase tracking-wide px-2 py-1 rounded ${
                isLive
                  ? "text-emerald-300 bg-emerald-500/10"
                  : isAnyLive
                  ? "text-amber-300 bg-amber-500/10"
                  : "text-yellow-400 bg-yellow-500/10"
              }`}
              title={
                isLive
                  ? "All prices live"
                  : isAnyLive
                  ? `${liveCount}/${totalCount} prices live`
                  : "Showing curated names only — no live prices yet"
              }
            >
              {isLive
                ? t("insights.tabBadgeLive")
                : isAnyLive
                ? `${liveCount}/${totalCount} LIVE`
                : t("insights.tabBadgeMock")}
            </span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="px-8 py-8">
        {(tabLoading || quotesLoading) && merged.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-lg p-4 border border-slate-700 h-[150px]"
                aria-label="loading"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filtered.map((row) => {
              const live = row.price !== undefined && Number.isFinite(row.price);
              const pct = row.changePercent;
              const cls = pct === undefined ? "text-slate-500" : pct >= 0 ? "text-green-400" : "text-red-400";
              const sign = pct === undefined || pct < 0 ? "" : "+";
              return (
                <div
                  key={row.symbol}
                  onClick={() => navigate(`/stock/${row.symbol}`)}
                  className="bg-card rounded-lg p-4 border border-slate-700 hover:border-slate-600 hover:bg-slate-700/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-slate-700 rounded flex items-center justify-center text-xs font-bold text-foreground group-hover:bg-blue-600 transition-colors">
                        {row.symbol.substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{row.symbol}</p>
                        {row.sector && (
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide truncate max-w-[120px]">
                            {row.sector}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right rtl:text-left">
                      <p className="text-sm font-bold text-foreground" dir="ltr">
                        {live ? `$${row.price!.toFixed(2)}` : "—"}
                      </p>
                      <p className={`text-xs font-semibold ${cls}`} dir="ltr">
                        {pct === undefined ? "—" : `${sign}${pct.toFixed(2)}%`}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-2 truncate">{row.name}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <span>{t("insights.marketCap")}:</span>
                    <span dir="ltr">{formatMarketCap(row.marketCap)}</span>
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {filtered.length === 0 && !tabLoading && (
          <div className="text-center py-12">
            <p className="text-slate-400">{t("insights.noMatch", { query: searchQuery })}</p>
          </div>
        )}

        {(tabFetching || quotesFetching) && merged.length > 0 && (
          <div className="text-center text-xs text-slate-500 mt-4">
            {t("common.search")}…
          </div>
        )}
      </div>
    </div>
  );
}
