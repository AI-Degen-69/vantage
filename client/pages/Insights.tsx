import { useState, useMemo } from "react";
import {
  Search,
  Loader2,
  TrendingUp,
  TrendingDown,
  X,
  ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useInsightsStocks, InsightsStock } from "@/hooks/useStockData";
import { useI18n } from "@/lib/i18n";

function formatLargeNumber(num: number | null | undefined): string {
  if (num == null) return "—";
  if (num === 0) return "0";
  if (Math.abs(num) >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

type MarketCapRange = "all" | "mega" | "large" | "mid" | "small";
type PriceChangeRange = "all" | "gainers" | "losers" | "big_movers" | "flat";

export default function Insights() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const tabs = [
    { id: "sp500", label: t("insights.tab.sp500") },
    { id: "trending", label: t("insights.tab.trending") },
    { id: "growth", label: t("insights.tab.growth") },
    { id: "dividend", label: t("insights.tab.dividend") },
    { id: "buyback", label: t("insights.tab.buyback") },
    { id: "ai", label: t("insights.tab.ai") },
    { id: "cloud", label: t("insights.tab.cloud") },
    { id: "ev", label: t("insights.tab.ev") },
    { id: "leisure", label: t("insights.tab.leisure") },
  ];

  const marketCapOptions: { value: MarketCapRange; label: string; min?: number; max?: number }[] = [
    { value: "all", label: t("insights.filter.all_caps") },
    { value: "mega", label: t("insights.filter.mega"), min: 200e9 },
    { value: "large", label: t("insights.filter.large"), min: 10e9, max: 200e9 },
    { value: "mid", label: t("insights.filter.mid"), min: 2e9, max: 10e9 },
    { value: "small", label: t("insights.filter.small"), max: 2e9 },
  ];

  const priceChangeOptions: { value: PriceChangeRange; label: string; min?: number; max?: number }[] = [
    { value: "all", label: t("insights.filter.all_moves") },
    { value: "gainers", label: t("insights.filter.gainers"), min: 1 },
    { value: "losers", label: t("insights.filter.losers"), max: -1 },
    { value: "big_movers", label: t("insights.filter.big_movers") },
    { value: "flat", label: t("insights.filter.flat"), min: -0.5, max: 0.5 },
  ];

  const [activeTab, setActiveTab] = useState("sp500");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSector, setSelectedSector] = useState<string>("all");
  const [marketCapRange, setMarketCapRange] = useState<MarketCapRange>("all");
  const [priceChangeRange, setPriceChangeRange] = useState<PriceChangeRange>("all");
  const [showSectorDropdown, setShowSectorDropdown] = useState(false);

  const { data, isLoading, isError } = useInsightsStocks(activeTab);

  const stocks: InsightsStock[] = data?.stocks ?? [];

  // Extract unique non-null sectors
  const sectors = useMemo(() => {
    const set = new Set<string>();
    stocks.forEach((s) => {
      if (s.sector) set.add(s.sector);
    });
    return Array.from(set).sort();
  }, [stocks]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count++;
    if (selectedSector !== "all") count++;
    if (marketCapRange !== "all") count++;
    if (priceChangeRange !== "all") count++;
    return count;
  }, [searchQuery, selectedSector, marketCapRange, priceChangeRange]);

  const filteredStocks = useMemo(() => {
    return stocks.filter((stock) => {
      // Text search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !stock.symbol.toLowerCase().includes(q) &&
          !stock.name?.toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      // Sector filter
      if (selectedSector !== "all" && stock.sector !== selectedSector) {
        return false;
      }

      // Market cap range
      if (marketCapRange !== "all") {
        const opt = marketCapOptions.find((o) => o.value === marketCapRange);
        if (opt != null) {
          if (stock.marketCap == null) return false;
          if (opt.min != null && stock.marketCap < opt.min) return false;
          if (opt.max != null && stock.marketCap > opt.max) return false;
        }
      }

      // Price change range
      if (priceChangeRange !== "all") {
        const opt = priceChangeOptions.find((o) => o.value === priceChangeRange);
        if (opt && stock.changePercent != null) {
          if (priceChangeRange === "big_movers") {
            // |changePercent| > 5%
            if (Math.abs(stock.changePercent) < 5) return false;
          } else {
            if (opt.min != null && stock.changePercent < opt.min) return false;
            if (opt.max != null && stock.changePercent > opt.max) return false;
          }
        } else if (stock.changePercent == null) {
          return false;
        }
      }

      return true;
    });
  }, [stocks, searchQuery, selectedSector, marketCapRange, priceChangeRange]);

  // Sector spotlight: compute per-sector counts and average performance
  const sectorSpotlight = useMemo(() => {
    const map = new Map<string, { count: number; totalChange: number; avgChange: number }>();
    for (const s of stocks) {
      if (!s.sector) continue;
      const existing = map.get(s.sector) || { count: 0, totalChange: 0, avgChange: 0 };
      existing.count++;
      if (s.changePercent != null) existing.totalChange += s.changePercent;
      map.set(s.sector, existing);
    }
    const sectors = Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgChange: data.count > 0 ? data.totalChange / data.count : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const maxCount = sectors.length > 0 ? sectors[0].count : 1;
    return { sectors, maxCount };
  }, [stocks]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedSector("all");
    setMarketCapRange("all");
    setPriceChangeRange("all");
  };

  const getStockUrl = (symbol: string) => `/stock/${symbol}`;

  return (
    <div className="w-full bg-background dark min-h-screen">
      {/* Header Section */}
      <div className="bg-slate-800/50 border-b border-slate-700 px-8 py-12">          <h1 className="text-4xl font-bold text-center text-foreground mb-8">
          {t("insights.title")}
        </h1>

        {/* Search Bar */}
        <div className="max-w-xl mx-auto">
          <div className="relative flex items-center bg-slate-700/50 border border-slate-600 rounded-lg overflow-hidden focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
            <Search className="w-4 h-4 ml-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder={t("insights.search_placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none border-0 px-4 py-3 text-foreground placeholder-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="mr-2 p-1 text-slate-400 hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-slate-800/30 border-b border-slate-700 overflow-x-auto">
        <div className="flex px-8 space-x-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stock Grid Area */}
      <div className="px-8 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-4" />
            <p className="text-slate-400">
              {t("insights.loading")}
            </p>
          </div>
        ) : isError ? (
          <div className="text-center py-12">
            <p className="text-red-400 mb-2">{t("insights.error.title")}</p>
            <p className="text-slate-500 text-sm">
              {t("insights.error.desc")}
            </p>
          </div>
        ) : (
          <>
            {/* Filter Bar */}
            {!isLoading && stocks.length > 0 && (
              <div className="mb-6 space-y-4">
                {/* Active Filters Row */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Sector Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowSectorDropdown(!showSectorDropdown)}
                      onBlur={() =>
                        setTimeout(() => setShowSectorDropdown(false), 200)
                      }
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                        selectedSector !== "all"
                          ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                          : "bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      <span>
                        {selectedSector !== "all"
                          ? selectedSector
                          : t("insights.filter.all_sectors")}
                      </span>
                      <ChevronDown className="w-3 h-3" />
                    </button>

                    {showSectorDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-56 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-20 max-h-64 overflow-y-auto">
                        <button
                          onClick={() => {
                            setSelectedSector("all");
                            setShowSectorDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                            selectedSector === "all"
                              ? "bg-blue-500/10 text-blue-400"
                              : "text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {t("insights.filter.all_sectors")}
                        </button>
                        {sectors.map((sector) => (
                          <button
                            key={sector}
                            onClick={() => {
                              setSelectedSector(sector);
                              setShowSectorDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                              selectedSector === sector
                                ? "bg-blue-500/10 text-blue-400"
                                : "text-slate-300 hover:bg-slate-700"
                            }`}
                          >
                            {sector}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Market Cap Range Pills */}
                  <div className="flex gap-1.5 flex-wrap">
                    {marketCapOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() =>
                          setMarketCapRange(
                            marketCapRange === opt.value ? "all" : opt.value
                          )
                        }
                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                          marketCapRange === opt.value
                            ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                            : "bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Price Change Range Pills */}
                  <div className="flex gap-1.5 flex-wrap">
                    {priceChangeOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() =>
                          setPriceChangeRange(
                            priceChangeRange === opt.value ? "all" : opt.value
                          )
                        }
                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                          priceChangeRange === opt.value
                            ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                            : "bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Clear All Filters */}
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearAllFilters}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border border-slate-600 text-slate-400 hover:text-foreground hover:border-slate-500 transition-all"
                    >
                      <X className="w-3 h-3" />
                      {t("insights.filter.clear")} ({activeFilterCount})
                    </button>
                  )}
                </div>

                {/* Count */}
                <div className="text-xs text-slate-500">
                  {filteredStocks.length === stocks.length
                    ? t("insights.filter.stocks_count", { count: stocks.length })
                    : t("insights.filter.stocks_of", { filtered: filteredStocks.length, total: stocks.length })}{" "}
                  • {t("source.yahoo")}
                </div>
              </div>
            )}

            {/* Sector Spotlight */}
            {sectorSpotlight.sectors.length > 0 && (
              <div className="mb-8 bg-card rounded-lg border border-slate-700 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-700 bg-slate-800/30">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground tracking-wide">
                      {t("insights.spotlight.title")}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {t("insights.spotlight.sectors", { count: sectorSpotlight.sectors.length })}
                    </span>
                  </div>
                </div>
                <div className="p-4 sm:p-5 space-y-2.5">
                  {sectorSpotlight.sectors.map((sector) => {
                    const barWidth = (sector.count / sectorSpotlight.maxCount) * 100;
                    const perfColor =
                      sector.avgChange > 0
                        ? "text-chart-green"
                        : sector.avgChange < 0
                        ? "text-red-400"
                        : "text-slate-400";
                    const fillColor =
                      sector.avgChange > 0
                        ? "bg-chart-green"
                        : sector.avgChange < 0
                        ? "bg-red-400"
                        : "bg-slate-500";

                    return (
                      <div key={sector.name} className="group">
                        <div className="flex items-center gap-3 mb-1">
                          {/* Sector Name */}
                          <span className="text-[11px] font-medium text-slate-300 w-36 sm:w-44 truncate flex-shrink-0 group-hover:text-foreground transition-colors">
                            {sector.name}
                          </span>

                          {/* Count Badge */}
                          <span className="text-[10px] font-semibold text-slate-400 w-8 text-right flex-shrink-0">
                            {sector.count}
                          </span>

                          {/* Bar Container */}
                          <div className="flex-1 h-5 rounded-sm overflow-hidden bg-slate-700/50">
                            <div
                              className={`h-full rounded-sm transition-all duration-500 ${fillColor} opacity-60`}
                              style={{ width: `${Math.max(barWidth, 2)}%` }}
                            />
                          </div>

                          {/* Avg Performance */}
                          <span
                            className={`text-[11px] font-semibold w-16 text-right flex-shrink-0 tabular-nums ${perfColor}`}
                          >
                            {sector.avgChange >= 0 ? "+" : ""}
                            {sector.avgChange.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stock Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredStocks.map((stock) => (
                <div
                  key={stock.symbol}
                  onClick={() => navigate(getStockUrl(stock.symbol))}
                  className="bg-card rounded-lg p-4 border border-slate-700 hover:border-slate-500 hover:bg-slate-700/30 transition-all cursor-pointer group"
                >
                  {/* Header with Logo and Price */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={`/api/company-logo?ticker=${stock.symbol}`}
                        alt={stock.symbol}
                        className="w-8 h-8 rounded"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = "none";
                          const fallback = img
                            .nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />
                      <div
                        className="w-8 h-8 bg-slate-700 rounded items-center justify-center text-xs font-bold text-foreground group-hover:bg-blue-600 transition-colors hidden"
                        style={{ display: "none" }}
                      >
                        {stock.symbol.substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {stock.symbol}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">
                        {stock.price != null
                          ? `$${stock.price.toFixed(2)}`
                          : "—"}
                      </p>
                      {stock.changePercent != null && (
                        <p
                          className={`text-xs font-semibold flex items-center justify-end gap-0.5 ${
                            stock.changePercent >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {stock.changePercent >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {stock.changePercent >= 0 ? "+" : ""}
                          {stock.changePercent.toFixed(2)}%
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Company Info */}
                  <p className="text-xs text-slate-400 mb-1.5 truncate">
                    {stock.name}
                  </p>
                  {stock.sector && (
                    <p className="text-[10px] text-slate-500 truncate mb-1">
                      {stock.sector}
                      {stock.industry ? ` / ${stock.industry}` : ""}
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    {t("insights.market_cap")} {formatLargeNumber(stock.marketCap)}
                  </p>
                </div>
              ))}
            </div>

            {filteredStocks.length === 0 && stocks.length > 0 && (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-700/50 mb-4">
                  <Search className="w-5 h-5 text-slate-500" />
                </div>
                <p className="text-slate-400 mb-1">
                  {t("insights.empty.title")}
                </p>
                <p className="text-xs text-slate-500">
                  {t("insights.empty.desc")}
                </p>
                <button
                  onClick={clearAllFilters}
                  className="mt-4 px-4 py-2 text-xs font-medium rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all"
                >
                  {t("insights.empty.clear")}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
