import { useState, useMemo } from "react";
import { Search, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useI18n, translateSector } from "@/lib/i18n";
import BatchQuoteFallbackHint from "@/components/BatchQuoteFallbackHint";
import {
  useInsightsTab,
  useBatchQuotes,
  useSectorHeatmap,
  useYahooDown,
} from "@/hooks/useStockData";
import { SectorHeatsheet } from "@/components/SectorHeatsheet";
import TickerLogo from "@/components/TickerLogo";
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
  const { t } = useI18n();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<InsightsTabId>("sp500");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: tabData,
    isLoading: tabLoading,
    isFetching: tabFetching,
  } = useInsightsTab(activeTab);

  // Pull live quotes for whatever universe the server returned.
  const symbols = useMemo(
    () => tabData?.entries.map((e) => e.symbol) ?? [],
    [tabData],
  );
  const {
    data: quoteData,
    isLoading: quotesLoading,
    isFetching: quotesFetching,
  } = useBatchQuotes(symbols);

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
      (row) =>
        row.symbol.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q),
    );
  }, [merged, searchQuery]);

  // Sector × 5-day heatmap. Lives entirely on the server side
  // (`/api/sector-heatmap`): the route fans out `getChart` per symbol and
  // aggregates by sector tag in one pass, node-caching the full response
  // for 15 minutes. Curated sectors from the universe travel WITH the
  // request so the server groups by the editorial tags even when provider
  // profiles are unavailable; provider sectors fill only the gaps. Client
  // staleTime matches the server TTL with a 5-minute loop so the user sees
  // fresh intraday without hammering the cache.
  const heatmapSymbols = useMemo(() => merged.map((r) => r.symbol), [merged]);
  const heatmapSectors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of merged) {
      if (row.sector) map[row.symbol.toUpperCase()] = row.sector;
    }
    return map;
  }, [merged]);
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
  const liveCount = merged.filter((r) => r.price !== undefined).length;
  const totalCount = merged.length;
  const isLive = liveCount === totalCount && totalCount > 0 && !yahooDown;
  const isAnyLive = liveCount > 0 && !yahooDown;

  return (
    <div className="w-full bg-background dark min-h-screen">
      {/* Header */}
      <div className="bg-card/50 border-b border-border px-8 py-12">
        <h1 className="text-4xl font-bold text-center text-foreground mb-8">
          {t("insights.title")}
        </h1>
        <div className="max-w-2xl mx-auto">
          <div className="relative flex items-center bg-background border border-border rounded-lg overflow-hidden">
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
        </div>
      </div>

      {/* Sector Heatsheet — 5-day columnar heatmap of average daily %
          moves per sector. Server aggregates per-ticker historical
          closes (cached 15 min) and renders a Bloomberg-style grid:
          rows = sectors (best weekNet at the top), columns = past
          5 trading days, cells tinted by |mean move|. Hidden when the
          server returns zero tagged sectors. */}
      <SectorHeatsheet
        heatmap={heatmapData ?? null}
        days={5}
        isLoading={heatmapLoading && !heatmapData}
      />
      {heatmapFetching && !!heatmapData && (
        <div className="text-center text-xs text-muted-foreground -mt-2 mb-2">
          {t("common.search")}…
        </div>
      )}

      {/* Tabs */}
      <div className="bg-card/30 border-b border-border overflow-x-auto">
        <div className="flex px-8 space-x-1 items-center">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(tab.i18nKey)}
            </button>
          ))}
          <div className="ms-auto flex items-center gap-2 py-2">
            <BatchQuoteFallbackHint />
            <span
              className={`text-[10px] font-medium uppercase tracking-wide px-2 py-1 rounded ${
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
                  const live =
                    row.price !== undefined && Number.isFinite(row.price);
                  const pct = row.changePercent;
                  const cls =
                    pct === undefined
                      ? "text-muted-foreground"
                      : pct >= 0
                        ? "text-chart-positive"
                        : "text-chart-negative";
                  const sign = pct === undefined || pct < 0 ? "" : "+";
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
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate max-w-[120px]">
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
                            {live ? `$${row.price!.toFixed(2)}` : "—"}
                          </p>
                          <p
                            className={`text-xs font-semibold font-mono tabular-nums ${cls}`}
                            dir="ltr"
                          >
                            {pct === undefined
                              ? "—"
                              : `${sign}${pct.toFixed(2)}%`}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 truncate">
                        {row.name}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
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
                const live =
                  row.price !== undefined && Number.isFinite(row.price);
                const pct = row.changePercent;
                const cls =
                  pct === undefined
                    ? "text-muted-foreground"
                    : pct >= 0
                      ? "text-chart-positive"
                      : "text-chart-negative";
                const sign = pct === undefined || pct < 0 ? "" : "+";
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
                    <p className="vt-sector">
                      {row.sector ? translateSector(t, row.sector) : ""}
                    </p>
                    <div className="vt-quote">
                      <p className="vt-price" dir="ltr">
                        {live ? `$${row.price!.toFixed(2)}` : "—"}
                      </p>
                      <p className={`vt-chg ${cls}`} dir="ltr">
                        {pct === undefined ? "—" : `${sign}${pct.toFixed(2)}%`}
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
                const live =
                  row.price !== undefined && Number.isFinite(row.price);
                const pct = row.changePercent;
                const cls =
                  pct === undefined
                    ? "text-muted-foreground"
                    : pct >= 0
                      ? "text-chart-positive"
                      : "text-chart-negative";
                const barColor =
                  pct === undefined || pct >= 0
                    ? "hsl(var(--chart-positive))"
                    : "hsl(var(--chart-negative))";
                const sign = pct === undefined || pct < 0 ? "" : "+";
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
                      {pct === undefined ? "—" : `${sign}${pct.toFixed(2)}%`}
                    </p>
                    <div className="vt-meter">
                      <i
                        style={{ width: `${magnitude}%`, background: barColor }}
                      />
                    </div>
                    <p className="vt-name">{row.name}</p>
                    <div className="vt-foot">
                      <span className="vt-price" dir="ltr">
                        {live ? `$${row.price!.toFixed(2)}` : "—"}
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
