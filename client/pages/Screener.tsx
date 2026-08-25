import { useState, useRef, useEffect } from "react";
import { useScreenerFilter, useScreenerFacets } from "@/hooks/useStockData";
import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCheck,
  Radio,
  ShoppingBag,
  ShoppingCart,
  Flame,
  Landmark,
  HeartPulse,
  Factory,
  Cpu,
  Boxes,
  Building,
  Zap,
  TrendingUp,
  Layers,
  LineChart,
  Coins,
  Briefcase,
  DollarSign,
  Building2,
} from "lucide-react";

interface FilterChip {
  value: string;
  label: string;
  flagCode?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const countryFlagMap: Record<string, string> = {
  "United States": "us",
  Canada: "ca",
  Japan: "jp",
  Germany: "de",
  "United Kingdom": "gb",
  China: "cn",
  India: "in",
  Israel: "il",
  France: "fr",
  Sweden: "se",
  Australia: "au",
  Italy: "it",
  "South Korea": "kr",
  Thailand: "th",
  Taiwan: "tw",
  "Hong Kong": "hk",
  Switzerland: "ch",
  Netherlands: "nl",
  Brazil: "br",
  Mexico: "mx",
  Singapore: "sg",
};

/* ------------------------------------------------------------------ */
/*  Unrolled Category Group with Select All / Clear & Direct Chips   */
/* ------------------------------------------------------------------ */
function FilterCategoryRow({
  title,
  chips,
  allOptions,
  selected,
  onChange,
  moreLabel = "More Countries",
}: {
  title: string;
  chips: FilterChip[];
  allOptions?: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
  moreLabel?: string;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const visibleValues = new Set(chips.map((c) => c.value));
  const isAllSelected =
    chips.length > 0 && chips.every((c) => selected.includes(c.value));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      // Deselect all in this group
      onChange(selected.filter((v) => !visibleValues.has(v)));
    } else {
      // Select all visible in this group
      const newVals = new Set([...selected, ...chips.map((c) => c.value)]);
      onChange(Array.from(newVals));
    }
  };

  const toggleVal = (val: string) => {
    onChange(
      selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val]
    );
  };

  // Remaining options not shown as direct chips
  const extraOptions = (allOptions || []).filter(
    (opt) => !visibleValues.has(opt)
  );
  const extraSelectedCount = selected.filter(
    (v) => !visibleValues.has(v)
  ).length;

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2.5 py-1.5 border-b border-border/40 last:border-0">
      {/* Category Title & Select All/Clear Button */}
      <div className="flex items-center justify-between sm:w-36 shrink-0 pt-1">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <button
          type="button"
          onClick={toggleSelectAll}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline px-1.5 py-0.5 rounded bg-primary/5 hover:bg-primary/10 transition-colors"
          title={isAllSelected ? "Deselect all" : "Select all"}
        >
          <CheckCheck className="w-3 h-3" />
          {isAllSelected ? "Clear" : "All"}
        </button>
      </div>

      {/* Unrolled Chip Pills */}
      <div
        className="flex flex-wrap items-center gap-1.5 flex-1 relative"
        ref={popoverRef}
      >
        {chips.map((chip) => {
          const isSelected = selected.includes(chip.value);
          const ChipIcon = chip.icon;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => toggleVal(chip.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                isSelected
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm scale-105"
                  : "bg-muted/50 text-muted-foreground border border-border hover:bg-muted hover:text-foreground"
              }`}
            >
              {chip.flagCode && (
                <img
                  src={`https://flagcdn.com/w20/${chip.flagCode}.png`}
                  alt=""
                  className="w-4 h-3 rounded-[2px] object-cover shrink-0"
                  loading="lazy"
                />
              )}
              {ChipIcon && <ChipIcon className="w-3.5 h-3.5 shrink-0 opacity-80" />}
              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
              {chip.label}
            </button>
          );
        })}

        {/* Extra options popover if there are remaining items */}
        {extraOptions.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setPopoverOpen(!popoverOpen)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                extraSelectedCount > 0
                  ? "bg-primary/20 text-primary border-primary/50 font-semibold"
                  : popoverOpen
                    ? "bg-muted text-foreground border-foreground/30"
                    : "bg-muted/40 text-muted-foreground border-dashed border-border hover:bg-muted hover:text-foreground"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-chart-amber" />
              <span>
                {extraSelectedCount > 0
                  ? `+${extraSelectedCount} More`
                  : `${moreLabel}...`}
              </span>
            </button>

            {popoverOpen && (
              <div className="absolute top-full left-0 mt-2 z-50 w-64 max-h-64 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-2xl animate-in fade-in-0 zoom-in-95">
                <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-border text-xs font-semibold text-muted-foreground">
                  <span>More {title}</span>
                  {extraSelectedCount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange(selected.filter((v) => visibleValues.has(v)))
                      }
                      className="text-chart-negative hover:underline text-[11px]"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {extraOptions.map((opt) => {
                  const isSelected = selected.includes(opt);
                  const flagCode = countryFlagMap[opt];
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleVal(opt)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                        isSelected
                          ? "bg-primary/15 text-primary font-semibold"
                          : "text-foreground hover:bg-muted/60"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {flagCode && (
                          <img
                            src={`https://flagcdn.com/w20/${flagCode}.png`}
                            alt=""
                            className="w-4 h-3 rounded-[2px] object-cover shrink-0"
                            loading="lazy"
                          />
                        )}
                        <span className="truncate">{opt}</span>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Screener Component                                            */
/* ------------------------------------------------------------------ */
export default function Screener() {
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const limit = 50;

  // Sorting state
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Default filters: Stocks & ETFs selected, US selected, Primary symbols only
  const [filters, setFilters] = useState({
    sector: [] as string[],
    industry: [] as string[],
    country: ["United States"] as string[],
    asset_type: ["Equity", "ETF"] as string[],
    exclude_dots: true,
  });

  const { data, isLoading } = useScreenerFilter(
    { ...filters, sort_by: sortBy, sort_dir: sortDir },
    limit,
    page * limit
  );
  const { data: facets } = useScreenerFacets();
  const total = data?.total ?? 0;
  const results = data?.results ?? [];
  const maxPages = Math.ceil(total / limit);

  const setFilter = <K extends keyof typeof filters>(
    key: K,
    val: (typeof filters)[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
    setPage(0);
  };

  // Toggle sort on column header click
  const handleSort = (colKey: string) => {
    if (sortBy === colKey) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortBy(undefined);
        setSortDir("asc");
      }
    } else {
      setSortBy(colKey);
      setSortDir("asc");
    }
    setPage(0);
  };

  // Unrolled lists for Asset Types with Icons
  const allAssetTypeChips: FilterChip[] = [
    { value: "Equity", label: "Stocks", icon: TrendingUp },
    { value: "ETF", label: "ETF", icon: Layers },
    { value: "Index", label: "Index", icon: LineChart },
    { value: "Crypto", label: "Crypto", icon: Coins },
    { value: "Fund", label: "Fund", icon: Briefcase },
    { value: "Currency", label: "Currency", icon: DollarSign },
    { value: "MoneyMarket", label: "Money Market", icon: Building2 },
  ];

  // Alphabetically sorted Sector Chips with Icons
  const sortedSectorChips: FilterChip[] = [
    { value: "Communication Services", label: "Communication", icon: Radio },
    { value: "Consumer Discretionary", label: "Consumer Disc.", icon: ShoppingBag },
    { value: "Consumer Staples", label: "Consumer Staples", icon: ShoppingCart },
    { value: "Energy", label: "Energy", icon: Flame },
    { value: "Financials", label: "Finance", icon: Landmark },
    { value: "Health Care", label: "Healthcare", icon: HeartPulse },
    { value: "Industrials", label: "Industrials", icon: Factory },
    { value: "Information Technology", label: "Tech", icon: Cpu },
    { value: "Materials", label: "Materials", icon: Boxes },
    { value: "Real Estate", label: "Real Estate", icon: Building },
    { value: "Utilities", label: "Utilities", icon: Zap },
  ];

  // Popular Countries with Flag Codes
  const popularCountryChips: FilterChip[] = [
    { value: "United States", label: "US", flagCode: "us" },
    { value: "Canada", label: "Canada", flagCode: "ca" },
    { value: "Japan", label: "Japan", flagCode: "jp" },
    { value: "Germany", label: "Germany", flagCode: "de" },
    { value: "United Kingdom", label: "UK", flagCode: "gb" },
    { value: "China", label: "China", flagCode: "cn" },
    { value: "India", label: "India", flagCode: "in" },
    { value: "Israel", label: "Israel", flagCode: "il" },
  ];

  const hasActiveFilters =
    filters.sector.length > 0 ||
    filters.industry.length > 0 ||
    filters.country.length > 0 ||
    filters.asset_type.length > 0 ||
    !filters.exclude_dots ||
    sortBy !== undefined;

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 gap-5 max-w-[1600px] mx-auto w-full">
      {/* Page Title */}
      <div className="flex flex-col gap-1 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">Market Screener</h1>
        <p className="text-muted-foreground text-sm">
          Discover and filter over{" "}
          <span className="font-semibold text-foreground">
            {total > 0 ? total.toLocaleString() : "300,000+"}
          </span>{" "}
          assets across global markets.
        </p>
      </div>

      {/* Unrolled Multi-Row Filter Panel */}
      <div className="flex flex-col gap-2 shrink-0 bg-card p-4 rounded-xl border border-border shadow-sm">
        {/* Row 1: Asset Type */}
        <FilterCategoryRow
          title="Asset Type"
          chips={allAssetTypeChips}
          allOptions={facets?.asset_types}
          selected={filters.asset_type}
          onChange={(vals) => setFilter("asset_type", vals)}
        />

        {/* Row 2: Sector (Alphabetically sorted with Sector Icons) */}
        <FilterCategoryRow
          title="Sector"
          chips={sortedSectorChips}
          allOptions={facets?.sectors}
          selected={filters.sector}
          onChange={(vals) => setFilter("sector", vals)}
        />

        {/* Row 3: Country (With flag icons) */}
        <FilterCategoryRow
          title="Country"
          chips={popularCountryChips}
          allOptions={facets?.countries}
          selected={filters.country}
          onChange={(vals) => setFilter("country", vals)}
          moreLabel="More Countries"
        />

        {/* Controls Row: Primary Listings Toggle Switch & Reset */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border/40 mt-1">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Scope:
            </span>
            {/* Visual Toggle Switch UI for Primary Listings */}
            <div className="flex items-center gap-2.5 bg-muted/40 px-3 py-1.5 rounded-full border border-border">
              <span className="text-xs font-semibold text-foreground select-none">
                Primary Listings Only
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={filters.exclude_dots}
                onClick={() => setFilter("exclude_dots", !filters.exclude_dots)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  filters.exclude_dots ? "bg-primary" : "bg-muted-foreground/30"
                }`}
                title="Toggle ON to exclude secondary exchange duplicates (e.g. AAPL.BA, TSLA.MI)"
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    filters.exclude_dots ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span
                className={`text-[11px] font-bold tracking-wider select-none ${
                  filters.exclude_dots ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {filters.exclude_dots ? "ON" : "OFF"}
              </span>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setFilters({
                  sector: [],
                  industry: [],
                  country: ["United States"],
                  asset_type: ["Equity", "ETF"],
                  exclude_dots: true,
                });
                setSortBy(undefined);
                setSortDir("asc");
                setPage(0);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-chart-negative hover:bg-chart-negative/10 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset All
            </button>
          )}
        </div>
      </div>

      {/* Asset Data Table with Column Sorting */}
      <div className="flex-1 bg-card rounded-xl border border-border flex flex-col min-h-0 overflow-hidden relative shadow-sm">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/60 border-b border-border sticky top-0 z-10 backdrop-blur">
              <tr>
                {[
                  { key: "symbol", label: "Symbol", align: "left" },
                  { key: "name", label: "Company Name", align: "left" },
                  { key: "asset_type", label: "Type", align: "left" },
                  { key: "sector", label: "Sector", align: "left" },
                  { key: "industry", label: "Industry", align: "left" },
                  { key: "country", label: "Country", align: "left" },
                  { key: "market_cap", label: "Market Cap", align: "right" },
                ].map((col) => {
                  const isSorted = sortBy === col.key;
                  return (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`px-6 py-3 font-semibold cursor-pointer select-none hover:text-foreground transition-colors ${
                        col.align === "right" ? "text-right" : ""
                      } ${isSorted ? "text-primary font-bold" : ""}`}
                    >
                      <div
                        className={`inline-flex items-center gap-1.5 ${
                          col.align === "right" ? "flex-row-reverse" : ""
                        }`}
                      >
                        <span>{col.label}</span>
                        {isSorted ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="w-3.5 h-3.5 text-primary stroke-[3]" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-primary stroke-[3]" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                        )}
                      </div>
                    </th>
                  );
                })}
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
                results.map((asset) => {
                  const flagCode = asset.country
                    ? countryFlagMap[asset.country]
                    : undefined;
                  return (
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
                        <div className="flex items-center gap-1.5">
                          {flagCode && (
                            <img
                              src={`https://flagcdn.com/w20/${flagCode}.png`}
                              alt=""
                              className="w-4 h-3 rounded-[2px] object-cover shrink-0"
                              loading="lazy"
                            />
                          )}
                          <span>{asset.country || "—"}</span>
                        </div>
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card shrink-0">
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
