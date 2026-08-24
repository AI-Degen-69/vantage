import { useState, useMemo } from "react";
import {
  Search,
  Settings,
  LayoutGrid,
  TrendingUp,
  Rocket,
  Coins,
  RefreshCcw,
  Bot,
  Cloud,
  Car,
  Gamepad2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useI18n, translateSector } from "@/lib/i18n";
import { presentQuoteRow } from "@/lib/universeRows";
import BatchQuoteFallbackHint from "@/components/BatchQuoteFallbackHint";
import {
  useAllInsightsTabs,
  useBatchQuotes,
  useSectorHeatmap,
  useYahooDown,
} from "@/hooks/useStockData";
import { SectorHeatsheet } from "@/components/SectorHeatsheet";
import TickerLogo from "@/components/TickerLogo";
import type { InsightsTabId, StockQuote } from "@shared/api";
import PageHeader from "@/components/PageHeader";
import DataLegend from "@/components/DataLegend";

const TABS: { id: InsightsTabId; i18nKey: string; Icon: React.ElementType }[] =
  [
    { id: "sp500", i18nKey: "insights.tabs.sp500", Icon: LayoutGrid },
    { id: "trending", i18nKey: "insights.tabs.trending", Icon: TrendingUp },
    { id: "growth", i18nKey: "insights.tabs.growth", Icon: Rocket },
    { id: "dividend", i18nKey: "insights.tabs.dividend", Icon: Coins },
    { id: "buyback", i18nKey: "insights.tabs.buyback", Icon: RefreshCcw },
    { id: "ai", i18nKey: "insights.tabs.ai", Icon: Bot },
    { id: "cloud", i18nKey: "insights.tabs.cloud", Icon: Cloud },
    { id: "ev", i18nKey: "insights.tabs.ev", Icon: Car },
    { id: "leisure", i18nKey: "insights.tabs.leisure", Icon: Gamepad2 },
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
  const { t } = useI18n();
  const navigate = useNavigate();
  const [activeFilters, setActiveFilters] = useState<InsightsTabId[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: allTabsData,
    isLoading: tabLoading,
    isFetching: tabFetching,
  } = useAllInsightsTabs();

  // Pre-filter the universe BEFORE fetching quotes so we don't overload the backend
  const filteredUniverse = useMemo(() => {
    if (!allTabsData) return [];

    const symbolTabs = new Map<string, InsightsTabId[]>();
    const allEntries = new Map<string, any>();

    for (const [tabId, entries] of Object.entries(allTabsData)) {
      for (const entry of entries as any[]) {
        const sym = entry.symbol.toUpperCase();
        if (!symbolTabs.has(sym)) {
          symbolTabs.set(sym, []);
          allEntries.set(sym, entry);
        }
        symbolTabs.get(sym)!.push(tabId as InsightsTabId);
      }
    }

    const q = searchQuery.toLowerCase();
    let results = Array.from(allEntries.values()).map((entry) => ({
      ...entry,
      tabs: symbolTabs.get(entry.symbol.toUpperCase()) || [],
    }));

    results = results.filter((row) => {
      const matchesSearch =
        row.symbol.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      if (activeFilters.length > 0) {
        const matchScore = activeFilters.filter((f) =>
          row.tabs.includes(f),
        ).length;
        if (matchScore === 0) return false;
      }
      return true;
    });

    return results;
  }, [allTabsData, searchQuery, activeFilters]);

  // Combine symbols from the active filtered universe
  const symbols = useMemo(
    () => filteredUniverse.map((e) => e.symbol),
    [filteredUniverse],
  );
  const {
    data: quoteData,
    isLoading: quotesLoading,
    isFetching: quotesFetching,
    isError: quotesError,
  } = useBatchQuotes(symbols);

  // merge: universe row + matched live quote (by symbol) → UI card model.
  const merged = useMemo(() => {
    const bySymbol = new Map<string, StockQuote>();
    for (const q of quoteData?.quotes ?? []) {
      if (q && q.symbol) bySymbol.set(q.symbol.toUpperCase(), q);
    }

    let results = filteredUniverse.map((entry) => {
      const sym = entry.symbol.toUpperCase();
      const live = bySymbol.get(sym) ?? null;
      return {
        symbol: entry.symbol,
        name: entry.name,
        sector: entry.sector ?? "",
        price: live?.price,
        change: live?.change,
        changePercent: live?.changesPercentage,
        marketCap: live?.marketCap,
        tabs: entry.tabs,
      };
    });

    // Sort (matchScore desc, then |% move| for Trending, then marketCap desc)
    results.sort((a, b) => {
      if (activeFilters.length > 0) {
        const scoreA = activeFilters.filter((f) => a.tabs.includes(f)).length;
        const scoreB = activeFilters.filter((f) => b.tabs.includes(f)).length;
        if (scoreA !== scoreB) return scoreB - scoreA;
        // Trending ranks by magnitude of move so the list reads as "what's
        // actually moving" — works for both the live movers and the curated
        // fallback, since both get live quotes overlaid above.
        if (activeFilters.includes("trending")) {
          const moveA =
            a.changePercent !== undefined && Number.isFinite(a.changePercent)
              ? Math.abs(a.changePercent)
              : -1;
          const moveB =
            b.changePercent !== undefined && Number.isFinite(b.changePercent)
              ? Math.abs(b.changePercent)
              : -1;
          if (moveA !== moveB) return moveB - moveA;
        }
      }
      // fallback to market cap
      const capA = a.marketCap || 0;
      const capB = b.marketCap || 0;
      return capB - capA;
    });

    return results;
  }, [filteredUniverse, quoteData, activeFilters]);

  // filtered is now just merged, since filtering was done beforehand
  const filtered = merged;

  // The heatmap is intentionally independent from search and tab filters.
  // It represents the US large-cap market structure using the curated S&P 500
  // universe, while the cards below can still be narrowed interactively.
  // Keeping these symbols stable also prevents a search like "NVDA" from
  // turning the market heatmap into a one-stock panel.
  const heatmapUniverse = useMemo(() => {
    return (allTabsData?.sp500 ?? []) as Array<{
      symbol: string;
      sector?: string | null;
    }>;
  }, [allTabsData]);
  const heatmapSymbols = useMemo(
    () => heatmapUniverse.map((entry) => entry.symbol),
    [heatmapUniverse],
  );
  const heatmapSectors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of heatmapUniverse) {
      if (entry.sector) map[entry.symbol.toUpperCase()] = entry.sector;
    }
    return map;
  }, [heatmapUniverse]);
  const {
    data: heatmapData,
    isLoading: heatmapLoading,
    isFetching: heatmapFetching,
  } = useSectorHeatmap(heatmapSymbols, 5, heatmapSectors);

  // Card-level [LIVE] / [MOCK] comes from whether ANY quote landed.
  // When Yahoo is down the batch-quote fallback can't run on the free tier
  // (FMP `batch-quote` is 402-gated), so prices are mock/stale even if a
  // previous payload is cached — demote the badge to MOCK. Tradeoff: if the
  // FMP key ever upgrades to a paid tier (batch-quote works), quotes would
  // be live during a Yahoo outage and this would mislabel them MOCK — gate
  // on `!isAnyLive || yahooDown` if that day comes.
  const yahooDown = useYahooDown();
  const liveCount = merged.filter((r) => Number.isFinite(r.price)).length;
  const totalCount = merged.length;
  const isLive = liveCount === totalCount && totalCount > 0 && !yahooDown;
  const isAnyLive = liveCount > 0 && !yahooDown;
  const quoteStatusLabel = quotesError
    ? "Live quote service unavailable"
    : isLive
      ? "All prices live"
      : isAnyLive
        ? `${liveCount}/${totalCount} prices live`
        : "Waiting for live quotes";

  return (
    <div className="w-full bg-background dark min-h-screen">
      {/* Market header */}
      <div className="bg-card/50 border-b border-border px-8 py-8">
        {/* Title and Search */}
        <div className="w-full max-w-3xl">
          <PageHeader
            eyebrow="Market pulse"
            title={t("insights.title")}
            description="Curated universes with live quotes and a cached sector view."
            status={isAnyLive ? "live" : undefined}
            source={isAnyLive ? "Yahoo Finance" : undefined}
            className="mb-8"
          />
          <div className="relative flex items-center bg-background border border-border rounded-lg overflow-hidden shadow-sm">
            <Search className="w-4 h-4 ms-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder={t("insights.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none border-0 px-4 py-3 text-foreground placeholder-muted-foreground/70"
            />
            <button className="flex items-center justify-center px-3 py-3 text-muted-foreground hover:text-primary transition-colors border-s border-border">
              <Settings className="w-4 h-4 shrink-0" />
            </button>
          </div>

          {/* Filters Bar under search */}
          <div className="flex flex-wrap gap-2 mt-4">
            {TABS.map((tab) => {
              const isActive = activeFilters.includes(tab.id);
              const Icon = tab.Icon;
              return (
                <button
                  key={tab.id}
                  onClick={() =>
                    setActiveFilters((prev) =>
                      prev.includes(tab.id)
                        ? prev.filter((id) => id !== tab.id)
                        : [...prev, tab.id],
                    )
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm scale-105 border-transparent"
                      : "bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t(tab.i18nKey)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Market-wide sector heatmap. This stays mounted even when the provider
          returns no rows, so an outage is explicit instead of becoming a large
          unexplained blank area. */}
      <section className="px-8 pt-6" aria-label="US market sector heatmap">
        <div className="w-full rounded-xl overflow-hidden border border-border/60 bg-card/40 shadow-sm">
          <SectorHeatsheet
            heatmap={heatmapData ?? null}
            days={5}
            isLoading={tabLoading || (heatmapLoading && !heatmapData)}
          />
        </div>
      </section>
      {heatmapFetching && !!heatmapData && (
        <div className="text-center text-xs text-muted-foreground -mt-2 mb-2">
          {t("common.search")}…
        </div>
      )}

      {/* Live Badge */}
      <div className="bg-card/30 border-b border-border overflow-x-auto">
        <div className="flex px-8 py-3 items-center justify-end gap-2">
          <BatchQuoteFallbackHint />
          <DataLegend showDerived={false} />
          <span
            className={`text-xs font-medium uppercase tracking-wide px-2 py-1 rounded ${
              isLive
                ? "text-chart-positive bg-chart-positive/10"
                : isAnyLive
                  ? "text-primary bg-primary/10"
                  : "text-yellow-400 bg-yellow-500/10"
            }`}
            title={
              isLive
                ? "All prices live"
                : isAnyLive
                  ? `${liveCount}/${totalCount} prices live`
                  : quoteStatusLabel
            }
          >
            {isLive
              ? t("insights.tabBadgeLive")
              : isAnyLive
                ? `${liveCount}/${totalCount} LIVE`
                : quotesError
                  ? "LIVE UNAVAILABLE"
                  : "LOADING LIVE QUOTES"}
          </span>
        </div>
      </div>

      {/* Grid */}
      <div
        data-impeccable-variants="15a93bf5"
        data-impeccable-variant-count="2"
        style={{ display: "contents" }}
      >
        {/* impeccable-variants-start 15a93bf5 */}
        {/* Original */}
        <div data-impeccable-variant="original">
          <div className="px-8 py-8">
            {(tabLoading || quotesLoading) && merged.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-card rounded-panel p-4 border border-border h-[150px]"
                    aria-label="loading"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {filtered.map((row) => {
                  const { liveText, pctText, cls } = presentQuoteRow(row);
                  return (
                    <div
                      key={row.symbol}
                      onClick={() => navigate(`/stock/${row.symbol}`)}
                      className="bg-card rounded-panel p-4 border border-border hover:border-primary/40 hover:bg-card/80 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <TickerLogo ticker={row.symbol} size="sm" />
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {row.symbol}
                            </p>
                            {row.sector && (
                              // Hidden if translateSector() returns "" (treated
                              // as missing). Resolves locale-aware: "Technology"
                              // → "Technology" in EN, "טכנולוגיה" in HE.
                              <p className="text-xs text-muted-foreground uppercase tracking-wide truncate max-w-[120px]">
                                {translateSector(t, row.sector)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right rtl:text-left">
                          <p
                            className="text-sm font-bold text-foreground font-mono tabular-nums"
                            dir="ltr"
                          >
                            {liveText}
                          </p>
                          <p
                            className={`text-xs font-semibold font-mono tabular-nums ${cls}`}
                            dir="ltr"
                          >
                            {pctText}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 truncate">
                        {row.name}
                      </p>
                      <div className="flex items-end justify-between mt-auto">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <span>{t("insights.marketCap")}:</span>
                          <span dir="ltr">
                            {formatMarketCap(row.marketCap)}
                          </span>
                        </p>
                        <div className="flex -space-x-1 rtl:space-x-reverse">
                          {(row.tabs as InsightsTabId[]).map((tabId) => {
                            const TabIcon = TABS.find(
                              (t) => t.id === tabId,
                            )?.Icon;
                            if (!TabIcon) return null;
                            return (
                              <div
                                key={tabId}
                                className="w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center shadow-sm"
                                title={t(`insights.tabs.${tabId}`)}
                              >
                                <TabIcon className="w-3 h-3 text-muted-foreground" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filtered.length === 0 && !tabLoading && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {t("insights.noMatch", { query: searchQuery })}
                </p>
              </div>
            )}

            {(tabFetching || quotesFetching) && merged.length > 0 && (
              <div className="text-center text-xs text-muted-foreground mt-4">
                {t("common.search")}…
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Variants: insert below this line */}
      <style data-impeccable-css="15a93bf5">{`
          @scope ([data-impeccable-variant="1"]) {
            :scope .vt-ledger {
              border-block-start: 1px solid hsl(var(--border));
            }
            :scope .vt-row {
              display: grid;
              grid-template-columns: 2.25rem 2rem minmax(0, 1fr) minmax(0, 8rem) auto auto;
              align-items: center;
              gap: 16px;
              padding-block: 15px;
              border-block-end: 1px solid hsl(var(--border));
              cursor: pointer;
              transition: background-color 220ms cubic-bezier(0.16, 1, 0.3, 1);
              padding-inline: 8px;
              margin-inline: -8px;
            }
            :scope[data-p-density="airy"] .vt-row { padding-block: 22px; }
            :scope[data-p-density="tight"] .vt-row { padding-block: 9px; }
            :scope .vt-row:hover { background: hsl(var(--card)); }
            :scope .vt-rank {
              font-family: "JetBrains Mono", ui-monospace, monospace;
              font-variant-numeric: tabular-nums;
              font-size: 0.75rem;
              color: hsl(var(--muted-foreground));
              text-align: end;
              opacity: 0.7;
            }
            :scope:not([data-p-rank]) .vt-rank { display: none; }
            :scope:not([data-p-rank]) .vt-row { grid-template-columns: 0 2rem minmax(0, 1fr) minmax(0, 8rem) auto auto; gap: 12px; }
            :scope .vt-id { min-width: 0; }
            :scope .vt-sym {
              font-size: 0.9375rem;
              font-weight: 600;
              color: hsl(var(--foreground));
              letter-spacing: 0.01em;
            }
            :scope .vt-name {
              font-size: 0.75rem;
              color: hsl(var(--muted-foreground));
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            :scope .vt-sector {
              font-size: 0.6875rem;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              color: hsl(var(--muted-foreground));
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            :scope .vt-cap {
              font-family: "JetBrains Mono", ui-monospace, monospace;
              font-variant-numeric: tabular-nums;
              font-size: 0.8125rem;
              color: hsl(var(--muted-foreground));
              text-align: end;
              min-width: 5.5rem;
            }
            :scope .vt-price {
              font-family: "JetBrains Mono", ui-monospace, monospace;
              font-variant-numeric: tabular-nums;
              font-size: 0.9375rem;
              font-weight: 600;
              color: hsl(var(--foreground));
              text-align: end;
            }
            :scope .vt-chg {
              font-family: "JetBrains Mono", ui-monospace, monospace;
              font-variant-numeric: tabular-nums;
              font-size: 0.75rem;
              font-weight: 600;
              text-align: end;
            }
            :scope .vt-quote { display: flex; flex-direction: column; gap: 2px; min-width: 6.5rem; }
            @media (max-width: 760px) {
              :scope .vt-row { grid-template-columns: 2rem minmax(0, 1fr) auto; }
              :scope .vt-rank, :scope .vt-cap, :scope .vt-sector { display: none; }
            }
          }

          @scope ([data-impeccable-variant="2"]) {
            :scope .vt-grid {
              display: grid;
              grid-template-columns: repeat(var(--vt-cols, 4), minmax(0, 1fr));
              gap: 1px;
              background: hsl(var(--border));
              border: 1px solid hsl(var(--border));
            }
            :scope[data-p-columns="3"] .vt-grid { --vt-cols: 3; }
            :scope[data-p-columns="5"] .vt-grid { --vt-cols: 5; }
            @media (max-width: 1100px) { :scope .vt-grid { --vt-cols: 2 !important; } }
            @media (max-width: 640px) { :scope .vt-grid { --vt-cols: 1 !important; } }
            :scope .vt-cell {
              background: hsl(var(--background));
              padding: 20px 18px 16px;
              cursor: pointer;
              display: flex;
              flex-direction: column;
              gap: 10px;
              transition: background-color 220ms cubic-bezier(0.16, 1, 0.3, 1);
            }
            :scope .vt-cell:hover { background: hsl(var(--card)); }
            :scope .vt-top { display: flex; align-items: center; gap: 8px; min-width: 0; }
            :scope .vt-sym {
              font-size: 0.75rem;
              font-weight: 600;
              letter-spacing: 0.06em;
              text-transform: uppercase;
              color: hsl(var(--muted-foreground));
            }
            :scope .vt-hero {
              font-family: "JetBrains Mono", ui-monospace, monospace;
              font-variant-numeric: tabular-nums;
              font-weight: 600;
              font-size: clamp(1.5rem, 2.4vw, 2rem);
              line-height: 1.05;
              letter-spacing: -0.02em;
            }
            :scope .vt-meter { height: 2px; background: hsl(var(--border)); overflow: hidden; }
            :scope:not([data-p-meter]) .vt-meter { display: none; }
            :scope .vt-meter i { display: block; height: 100%; }
            :scope .vt-price {
              font-family: "JetBrains Mono", ui-monospace, monospace;
              font-variant-numeric: tabular-nums;
              font-size: 0.875rem;
              font-weight: 600;
              color: hsl(var(--foreground));
            }
            :scope .vt-name {
              font-size: 0.75rem;
              color: hsl(var(--muted-foreground));
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            :scope .vt-cap {
              font-family: "JetBrains Mono", ui-monospace, monospace;
              font-variant-numeric: tabular-nums;
              font-size: 0.75rem;
              color: hsl(var(--muted-foreground));
            }
            :scope .vt-foot { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-block-start: auto; }
          }
        `}</style>

      {/* Variant 1 — ruled ledger: the card container is removed entirely; rows read as an instrument register ordered top to bottom */}
      <div
        data-impeccable-variant="1"
        data-p-rank=""
        data-p-density="normal"
        data-impeccable-params='[{"id":"density","kind":"steps","default":"normal","label":"Row density","options":[{"value":"tight","label":"Tight"},{"value":"normal","label":"Normal"},{"value":"airy","label":"Airy"}]},{"id":"rank","kind":"toggle","default":true,"label":"Rank numerals"}]'
      >
        <div className="px-8 py-8">
          {(tabLoading || quotesLoading) && merged.length === 0 ? (
            <div className="vt-ledger">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="vt-row" aria-label="loading">
                  <span className="vt-rank">{i + 1}</span>
                  <div className="w-8 h-8 bg-card" />
                  <div className="h-3 w-40 bg-card" />
                  <div className="h-3 w-24 bg-card" />
                  <div className="h-3 w-20 bg-card justify-self-end" />
                  <div className="h-3 w-16 bg-card justify-self-end" />
                </div>
              ))}
            </div>
          ) : (
            <div className="vt-ledger">
              {filtered.map((row, i) => {
                const { liveText, pctText, cls } = presentQuoteRow(row);
                return (
                  <div
                    key={row.symbol}
                    onClick={() => navigate(`/stock/${row.symbol}`)}
                    className="vt-row"
                  >
                    <span className="vt-rank" dir="ltr">
                      {i + 1}
                    </span>
                    <TickerLogo ticker={row.symbol} size="sm" />
                    <div className="vt-id">
                      <p className="vt-sym">{row.symbol}</p>
                      <p className="vt-name">{row.name}</p>
                    </div>
                    <p className="vt-sector flex items-center gap-1">
                      {row.sector ? translateSector(t, row.sector) : ""}
                      {(row.tabs as InsightsTabId[]).map((tabId) => {
                        const TabIcon = TABS.find((t) => t.id === tabId)?.Icon;
                        return TabIcon ? (
                          <TabIcon
                            key={tabId}
                            className="w-3 h-3 text-muted-foreground"
                            title={t(`insights.tabs.${tabId}`)}
                          />
                        ) : null;
                      })}
                    </p>
                    <div className="vt-quote">
                      <p className="vt-price" dir="ltr">
                        {liveText}
                      </p>
                      <p className={`vt-chg ${cls}`} dir="ltr">
                        {pctText}
                      </p>
                    </div>
                    <p className="vt-cap" dir="ltr">
                      {formatMarketCap(row.marketCap)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {filtered.length === 0 && !tabLoading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {t("insights.noMatch", { query: searchQuery })}
              </p>
            </div>
          )}

          {(tabFetching || quotesFetching) && merged.length > 0 && (
            <div className="text-center text-xs text-muted-foreground mt-4">
              {t("common.search")}…
            </div>
          )}
        </div>
      </div>

      {/* Variant 2 — signal grid: hierarchy inverted so the move, not the ticker, is the headline; card chrome collapses into one shared graticule */}
      <div
        data-impeccable-variant="2"
        style={{ display: "none" }}
        data-p-columns="4"
        data-p-meter=""
        data-impeccable-params='[{"id":"columns","kind":"steps","default":"4","label":"Columns","options":[{"value":"3","label":"3"},{"value":"4","label":"4"},{"value":"5","label":"5"}]},{"id":"meter","kind":"toggle","default":true,"label":"Magnitude bar"}]'
      >
        <div className="px-8 py-8">
          {(tabLoading || quotesLoading) && merged.length === 0 ? (
            <div className="vt-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="vt-cell h-[150px]"
                  aria-label="loading"
                />
              ))}
            </div>
          ) : (
            <div className="vt-grid">
              {filtered.map((row) => {
                const { liveText, pctText, cls } = presentQuoteRow(row);
                const pct =
                  row.changePercent !== undefined &&
                  Number.isFinite(row.changePercent)
                    ? row.changePercent
                    : undefined;
                const barColor =
                  pct === undefined || pct >= 0
                    ? "hsl(var(--chart-positive))"
                    : "hsl(var(--chart-negative))";
                const magnitude =
                  pct === undefined ? 0 : Math.min(100, Math.abs(pct) * 14);
                return (
                  <div
                    key={row.symbol}
                    onClick={() => navigate(`/stock/${row.symbol}`)}
                    className="vt-cell"
                  >
                    <div className="vt-top">
                      <TickerLogo ticker={row.symbol} size="sm" />
                      <span className="vt-sym">{row.symbol}</span>
                    </div>
                    <p className={`vt-hero ${cls}`} dir="ltr">
                      {pctText}
                    </p>
                    <div className="vt-meter">
                      <i
                        style={{ width: `${magnitude}%`, background: barColor }}
                      />
                    </div>
                    <p className="vt-name">{row.name}</p>
                    <div className="vt-foot">
                      <div className="flex -space-x-1 rtl:space-x-reverse me-auto">
                        {(row.tabs as InsightsTabId[]).map((tabId) => {
                          const TabIcon = TABS.find(
                            (t) => t.id === tabId,
                          )?.Icon;
                          return TabIcon ? (
                            <div
                              key={tabId}
                              className="w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center shadow-sm"
                              title={t(`insights.tabs.${tabId}`)}
                            >
                              <TabIcon className="w-2.5 h-2.5 text-muted-foreground" />
                            </div>
                          ) : null;
                        })}
                      </div>
                      <span className="vt-price" dir="ltr">
                        {liveText}
                      </span>
                      <span className="vt-cap" dir="ltr">
                        {formatMarketCap(row.marketCap)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filtered.length === 0 && !tabLoading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {t("insights.noMatch", { query: searchQuery })}
              </p>
            </div>
          )}

          {(tabFetching || quotesFetching) && merged.length > 0 && (
            <div className="text-center text-xs text-muted-foreground mt-4">
              {t("common.search")}…
            </div>
          )}
        </div>
      </div>
      {/* impeccable-variants-end 15a93bf5 */}
    </div>
  );
}
