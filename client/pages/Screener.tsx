import { useState, useRef, useEffect } from "react";
import { useScreenerFilter, useScreenerFacets } from "@/hooks/useStockData";
import { Link } from "react-router-dom";
import { useI18n, translateAssetType, translateCountry, translateMarketCap, translateSector } from "@/lib/i18n";
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
  const { t } = useI18n();
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
          title={isAllSelected ? t("screener.clear") : t("screener.selectAll")}
        >
          <CheckCheck className="w-3 h-3" />
          {isAllSelected ? t("screener.clear") : t("screener.selectAll")}
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
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {extraSelectedCount > 0
                  ? `+${extraSelectedCount}`
                  : `${moreLabel}...`}
              </span>
            </button>

            {popoverOpen && (
              <div className="absolute top-full left-0 mt-2 z-50 w-64 max-h-64 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-2xl animate-in fade-in-0 zoom-in-95">
                <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-border text-xs font-semibold text-muted-foreground">
                  <span>{title}</span>
                  {extraSelectedCount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange(selected.filter((v) => visibleValues.has(v)))
                      }
                      className="text-chart-negative hover:underline text-[11px]"
                    >
                      {t("screener.clear")}
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
    { value: "Equity", label: t("screener.assetType.stocks"), icon: TrendingUp },
    { value: "ETF", label: t("screener.assetType.etf"), icon: Layers },
    { value: "Index", label: t("screener.assetType.index"), icon: LineChart },
    { value: "Crypto", label: t("screener.assetType.crypto"), icon: Coins },
    { value: "Fund", label: t("screener.assetType.fund"), icon: Briefcase },
    { value: "Currency", label: t("screener.assetType.currency"), icon: DollarSign },
    { value: "MoneyMarket", label: t("screener.assetType.moneyMarket"), icon: Building2 },
  ];

  // Alphabetically sorted Sector Chips with Icons
  const sortedSectorChips: FilterChip[] = [
    { value: "Communication Services", label: t("sector.communicationServices"), icon: Radio },
    { value: "Consumer Discretionary", label: t("sector.consumerDiscretionary"), icon: ShoppingBag },
    { value: "Consumer Staples", label: t("sector.consumerStaples"), icon: ShoppingCart },
    { value: "Energy", label: t("sector.energy"), icon: Flame },
    { value: "Financials", label: t("sector.financials"), icon: Landmark },
    { value: "Health Care", label: t("sector.healthCare"), icon: HeartPulse },
    { value: "Industrials", label: t("sector.industrials"), icon: Factory },
    { value: "Information Technology", label: t("sector.informationTechnology"), icon: Cpu },
    { value: "Materials", label: t("sector.materials"), icon: Boxes },
    { value: "Real Estate", label: t("sector.realEstate"), icon: Building },
    { value: "Utilities", label: t("sector.utilities"), icon: Zap },
  ];

  // Popular Countries with Flag Codes
  const popularCountryChips: FilterChip[] = [
    { value: "United States", label: t("screener.country.us"), flagCode: "us" },
    { value: "Canada", label: t("screener.country.canada"), flagCode: "ca" },
    { value: "Japan", label: t("screener.country.japan"), flagCode: "jp" },
    { value: "Germany", label: t("screener.country.germany"), flagCode: "de" },
    { value: "United Kingdom", label: t("screener.country.uk"), flagCode: "gb" },
    { value: "China", label: t("screener.country.china"), flagCode: "cn" },
    { value: "India", label: t("screener.country.india"), flagCode: "in" },
    { value: "Israel", label: t("screener.country.israel"), flagCode: "il" },
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
        <h1 className="text-3xl font-bold tracking-tight">{t("screener.title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("screener.subtitle", {
            total:
              total > 0 ? total.toLocaleString() : "300,000+",
          })}
        </p>
      </div>

      {/* Unrolled Multi-Row Filter Panel */}
      <div className="flex flex-col gap-2 shrink-0 bg-card p-4 rounded-xl border border-border shadow-sm">
        {/* Row 1: Asset Type */}
        <FilterCategoryRow
          title={t("screener.assetType")}
          chips={allAssetTypeChips}
          allOptions={facets?.asset_types}
          selected={filters.asset_type}
          onChange={(vals) => setFilter("asset_type", vals)}
        />

        {/* Row 2: Sector (Alphabetically sorted with Sector Icons) */}
        <FilterCategoryRow
          title={t("screener.sector")}
          chips={sortedSectorChips}
          allOptions={facets?.sectors}
          selected={filters.sector}
          onChange={(vals) => setFilter("sector", vals)}
        />

        {/* Row 3: Country (With flag icons) */}
        <FilterCategoryRow
          title={t("screener.country")}
          chips={popularCountryChips}
          allOptions={facets?.countries}
          selected={filters.country}
          onChange={(vals) => setFilter("country", vals)}
          moreLabel={t("screener.moreCountries")}
        />

        {/* Controls Row: Primary Listings Toggle Switch & Reset */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border/40 mt-1">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("screener.scope")}
            </span>
            {/* Visual Toggle Switch UI for Primary Listings */}
            <div className="flex items-center gap-2.5 bg-muted/40 px-3 py-1.5 rounded-full border border-border">
              <span className="text-xs font-semibold text-foreground select-none">
                {t("screener.primaryListingsOnly")}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={filters.exclude_dots}
                onClick={() => setFilter("exclude_dots", !filters.exclude_dots)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  filters.exclude_dots ? "bg-primary" : "bg-muted-foreground/30"
                }`}
                title={t("screener.primaryListingsTooltip")}
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
                {filters.exclude_dots ? t("screener.on") : t("screener.off")}
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
              {t("screener.resetFilters")}
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
                  { key: "symbol", label: t("screener.col.symbol"), align: "left" },
                  { key: "name", label: t("screener.col.name"), align: "left" },
                  { key: "asset_type", label: t("screener.assetType"), align: "left" },
                  { key: "sector", label: t("screener.col.sector"), align: "left" },
                  { key: "country", label: t("screener.col.country"), align: "left" },
                  { key: "market_cap", label: t("metrics.marketCap"), align: "right" },
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
                    colSpan={6}
                    className="px-6 py-12 text-center text-muted-foreground"
                  >
                    {t("screener.loading")}
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-muted-foreground"
                  >
                    {t("screener.noResults")}
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
                        {asset.asset_type
                          ? translateAssetType(t, asset.asset_type)
                          : "—"}
                      </td>
                      <td
                        className="px-6 py-3 text-muted-foreground max-w-[150px] truncate"
                        title={asset.sector}
                      >
                        {asset.sector ? translateSector(t, asset.sector) : "—"}
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
                          <span>{asset.country ? translateCountry(t, asset.country) || "—" : "—"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 font-mono text-right tabular-nums">
                        {translateMarketCap(t, asset.market_cap)}
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
            {t("screener.showingResults", {
              start: results.length > 0 ? page * limit + 1 : 0,
              end: Math.min((page + 1) * limit, total),
              total: total.toLocaleString(),
            })}
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
              {t("screener.pageOf", { page: page + 1, totalPages: maxPages || 1 })}
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
