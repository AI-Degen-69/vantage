import { useState, useRef, useEffect } from "react";
import { useScreenerFilter, useScreenerFacets } from "@/hooks/useStockData";
import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { Filter, ChevronLeft, ChevronRight, ChevronDown, Check, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Multi-select dropdown component                                    */
/* ------------------------------------------------------------------ */
function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggle = (val: string) => {
    onChange(
      selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val]
    );
  };

  const displayText =
    selected.length === 0
      ? label
      : selected.length === 1
        ? selected[0]
        : `${selected.length} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border transition-colors min-w-[140px] justify-between ${
          selected.length > 0
            ? "bg-primary/10 border-primary/40 text-primary"
            : "bg-background border-border text-foreground hover:bg-muted"
        }`}
      >
        <span className="truncate max-w-[160px]">{displayText}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-64 max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-xl animate-in fade-in-0 zoom-in-95">
          {/* Quick clear */}
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-chart-negative hover:bg-muted transition-colors border-b border-border"
            >
              <X className="w-3 h-3" /> Clear selection
            </button>
          )}
          {options.map((opt) => {
            const isSelected = selected.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left ${
                  isSelected
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/40"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <span className="truncate">{opt}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Screener page                                                      */
/* ------------------------------------------------------------------ */
export default function Screener() {
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const limit = 50;

  const [filters, setFilters] = useState({
    sector: [] as string[],
    industry: [] as string[],
    country: ["United States"] as string[],
    asset_type: [] as string[],
    exclude_dots: true,
  });

  const { data, isLoading } = useScreenerFilter(filters, limit, page * limit);
  const { data: facets } = useScreenerFacets();
  const total = data?.total ?? 0;
  const results = data?.results ?? [];
  const maxPages = Math.ceil(total / limit);

  const setFilter = <K extends keyof typeof filters>(key: K, val: (typeof filters)[K]) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
    setPage(0);
  };

  const hasActiveFilters =
    filters.sector.length > 0 ||
    filters.industry.length > 0 ||
    filters.country.length > 0 ||
    filters.asset_type.length > 0 ||
    !filters.exclude_dots;

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 gap-6 max-w-[1600px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-2 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">Market Screener</h1>
        <p className="text-muted-foreground">
          Discover and filter over{" "}
          {total > 0 ? total.toLocaleString() : "300,000+"} assets across global
          markets.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 shrink-0 bg-card p-4 rounded-lg border border-border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filters:</span>
        </div>

        <MultiSelect
          label="Asset Type"
          options={facets?.asset_types ?? []}
          selected={filters.asset_type}
          onChange={(v) => setFilter("asset_type", v)}
        />

        <MultiSelect
          label="Sector"
          options={facets?.sectors ?? []}
          selected={filters.sector}
          onChange={(v) => setFilter("sector", v)}
        />

        <MultiSelect
          label="Country"
          options={facets?.countries ?? []}
          selected={filters.country}
          onChange={(v) => setFilter("country", v)}
        />

        {/* Hide foreign duplicates toggle */}
        <button
          onClick={() => setFilter("exclude_dots", !filters.exclude_dots)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
            filters.exclude_dots
              ? "bg-primary/10 border-primary/40 text-primary"
              : "bg-background border-border text-muted-foreground hover:bg-muted"
          }`}
          title="Hide foreign-exchange duplicate tickers (e.g. AAPL.BA, TSLA.MI)"
        >
          <div
            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
              filters.exclude_dots
                ? "bg-primary border-primary"
                : "border-muted-foreground/40"
            }`}
          >
            {filters.exclude_dots && (
              <Check className="w-3 h-3 text-primary-foreground" />
            )}
          </div>
          Primary only
        </button>

        <div className="flex-1" />

        {hasActiveFilters && (
          <button
            onClick={() => {
              setFilters({
                sector: [],
                industry: [],
                country: [],
                asset_type: [],
                exclude_dots: true,
              });
              setPage(0);
            }}
            className="text-sm text-chart-negative hover:underline"
          >
            Reset All
          </button>
        )}
      </div>

      {/* Active filter pills */}
      {(filters.sector.length > 0 ||
        filters.asset_type.length > 0 ||
        filters.country.length > 0) && (
        <div className="flex flex-wrap gap-2 shrink-0 -mt-3">
          {[
            ...filters.asset_type.map((v) => ({ key: "asset_type" as const, val: v })),
            ...filters.sector.map((v) => ({ key: "sector" as const, val: v })),
            ...filters.country.map((v) => ({ key: "country" as const, val: v })),
          ].map(({ key, val }) => (
            <span
              key={`${key}-${val}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium"
            >
              {val}
              <button
                onClick={() =>
                  setFilter(
                    key,
                    filters[key].filter((v: string) => v !== val)
                  )
                }
                className="hover:text-chart-negative transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 bg-card rounded-lg border border-border flex flex-col min-h-0 overflow-hidden relative">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border sticky top-0 z-10 backdrop-blur">
              <tr>
                <th className="px-6 py-3 font-medium">Symbol</th>
                <th className="px-6 py-3 font-medium">Company Name</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Sector</th>
                <th className="px-6 py-3 font-medium">Industry</th>
                <th className="px-6 py-3 font-medium">Country</th>
                <th className="px-6 py-3 font-medium text-right">Market Cap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border relative">
              {isLoading && results.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-muted-foreground"
                  >
                    Loading assets...
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-muted-foreground"
                  >
                    No assets found matching the criteria.
                  </td>
                </tr>
              ) : (
                results.map((asset) => (
                  <tr
                    key={asset.symbol}
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    <td className="px-6 py-3 whitespace-nowrap">
                      <Link
                        to={`/stock/${asset.symbol}`}
                        className="font-bold text-foreground group-hover:text-primary transition-colors"
                      >
                        {asset.symbol}
                      </Link>
                    </td>
                    <td
                      className="px-6 py-3 font-medium text-foreground max-w-[300px] truncate"
                      title={asset.name}
                    >
                      {asset.name}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                      {asset.asset_type || "—"}
                    </td>
                    <td
                      className="px-6 py-3 text-muted-foreground max-w-[150px] truncate"
                      title={asset.sector}
                    >
                      {asset.sector || "—"}
                    </td>
                    <td
                      className="px-6 py-3 text-muted-foreground max-w-[200px] truncate"
                      title={asset.industry}
                    >
                      {asset.industry || "—"}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                      {asset.country || "—"}
                    </td>
                    <td className="px-6 py-3 font-mono text-right tabular-nums">
                      {asset.market_cap ? (
                        typeof asset.market_cap === "number" ? (
                          asset.market_cap >= 1e9
                            ? `$${(asset.market_cap / 1e9).toFixed(2)}B`
                            : asset.market_cap >= 1e6
                              ? `$${(asset.market_cap / 1e6).toFixed(2)}M`
                              : `$${asset.market_cap.toLocaleString()}`
                        ) : (
                          asset.market_cap
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card">
          <span className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">
              {results.length > 0 ? page * limit + 1 : 0}
            </span>{" "}
            to{" "}
            <span className="font-medium text-foreground">
              {Math.min((page + 1) * limit, total)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-foreground">
              {total.toLocaleString()}
            </span>{" "}
            assets
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
              className="p-1 rounded hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium px-2">
              Page {page + 1} of {maxPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(maxPages - 1, p + 1))}
              disabled={page >= maxPages - 1 || isLoading}
              className="p-1 rounded hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
