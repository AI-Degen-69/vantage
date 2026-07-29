import { useTranslation } from "react-i18next";
import { defaultWatchlist } from "@/lib/mockData";
import { ChevronDown } from "lucide-react";
import { useSmaDistances } from "@/hooks/useStockData";
import { useMemo, useState } from "react";

type SmaWindow = "20day" | "50day" | "100day" | "150day" | "200day";

const WINDOW_SIZE: Record<SmaWindow, number> = {
  "20day": 20,
  "50day": 50,
  "100day": 100,
  "150day": 150,
  "200day": 200,
};

/**
 * Renders a watchlist dashboard showing each symbol's distance from the selected simple moving average window.
 *
 * @remarks
 * Displays live, partial, or fallback values and provides a selector for SMA windows from 20 to 200 days.
 */
export default function DipFinder() {
  const { t } = useTranslation();
  const [smaWindow, setSmaWindow] = useState<SmaWindow>("200day");
  const windowSize = WINDOW_SIZE[smaWindow];

  // Always request 200 so toggling the window is server-driven; the server
  // already filters to the trailing N closes. With 200 covers every choice.
  const symbols = useMemo(() => defaultWatchlist.map((w) => w.symbol), []);
  const { data, isLoading } = useSmaDistances(symbols, windowSize);

  // Build a per-symbol map and recompute distances for the active window.
  // We send the full 200 always because the server already stores cache per
  // request; trimming to N on the client keeps it free for window switches.
  const rows = useMemo(() => {
    const live = (data?.rows ?? []).filter((r) => r.symbol);
    const liveBySymbol = new Map(live.map((r) => [r.symbol.toUpperCase(), r]));

    return defaultWatchlist.map((w) => {
      const liveRow = liveBySymbol.get(w.symbol.toUpperCase());
      const liveDistance =
        liveRow?.distancePct !== undefined && liveRow.distancePct !== null
          ? liveRow.distancePct
          : null;
      const isLive = liveDistance !== null && (liveRow?.sampleSize ?? 0) >= Math.min(windowSize, 200);
      const isPartial = liveDistance !== null && !isLive;
      return {
        symbol: w.symbol,
        name: w.name,
        distance: isLive || isPartial ? (liveDistance as number) : w.sma200Distance,
        state: isLive ? "live" : isPartial ? "partial" : "mock",
      };
    });
  }, [data, windowSize]);

  const sortedTickers = useMemo(
    () => [...rows].sort((a, b) => a.distance - b.distance),
    [rows]
  );
  const maxDistance = Math.max(...sortedTickers.map((r) => Math.abs(r.distance)), 1);

  const allLive = rows.length > 0 && rows.every((r) => r.state === "live");
  const anyLive = rows.some((r) => r.state === "live");
  const badgeKind: "live" | "partial" | "mock" = allLive
    ? "live"
    : anyLive
    ? "partial"
    : "mock";

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold">{t("dipFinder.title")}</h3>
          <span
            className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded ${
              badgeKind === "live"
                ? "text-emerald-300 bg-emerald-500/10"
                : badgeKind === "partial"
                ? "text-amber-300 bg-amber-500/10"
                : "text-yellow-400 bg-yellow-500/10"
            }`}
          >
            {badgeKind === "live"
              ? t("dipFinder.liveBadge")
              : badgeKind === "partial"
              ? t("dipFinder.partialBadge")
              : t("dipFinder.mockBadge")}
          </span>
        </div>
        <div className="relative">
          <select
            value={smaWindow}
            onChange={(e) => setSmaWindow(e.target.value as SmaWindow)}
            className="appearance-none bg-slate-800 border border-slate-700 text-sm font-medium py-2 pl-4 pr-10 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer text-foreground"
          >
            <option value="20day">{t("dipFinder.20day")}</option>
            <option value="50day">{t("dipFinder.50day")}</option>
            <option value="100day">{t("dipFinder.100day")}</option>
            <option value="150day">{t("dipFinder.150day")}</option>
            <option value="200day">{t("dipFinder.200day")}</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Axis ticks */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
        <div className="w-20 shrink-0" />
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 flex justify-between relative px-1">
            <span className="text-red-400/50">-{Math.round(maxDistance)}%</span>
            <span className="absolute left-1/2 -translate-x-1/2 text-slate-400">0%</span>
            <span className="text-green-400/50">+{Math.round(maxDistance)}%</span>
          </div>
          <div className="w-20 shrink-0" />
        </div>
      </div>

      <div className="space-y-4">
        {sortedTickers.map((row) => {
          const width = Math.max(5, (Math.abs(row.distance) / maxDistance) * 100);
          const isNegative = row.distance < 0;
          const dot =
            row.state === "live"
              ? "bg-emerald-500"
              : row.state === "partial"
              ? "bg-amber-500"
              : "bg-yellow-500";
          return (
            <div
              key={row.symbol}
              className="flex items-center gap-4 group cursor-pointer"
              title={row.name}
            >
              <div className="flex items-center gap-2 w-20 shrink-0">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`}
                  aria-label={row.state}
                />
                <span className="font-semibold text-sm group-hover:text-blue-400 transition-colors">
                  {row.symbol}
                </span>
              </div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-3 bg-slate-800/50 rounded-full overflow-hidden flex relative">
                  <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-slate-500 z-10" />
                  <div className="w-1/2 h-full flex justify-end">
                    {isNegative && (
                      <div
                        className="h-full bg-red-500 rounded-l-full transition-all duration-500"
                        style={{ width: `${width}%` }}
                      />
                    )}
                  </div>
                  <div className="w-1/2 h-full flex justify-start">
                    {!isNegative && (
                      <div
                        className="h-full bg-green-500 rounded-r-full transition-all duration-500"
                        style={{ width: `${width}%` }}
                      />
                    )}
                  </div>
                </div>
                <div
                  className={`w-20 text-right text-sm font-semibold whitespace-nowrap shrink-0 ${
                    isNegative ? "text-red-400" : "text-green-400"
                  }`}
                  dir="ltr"
                >
                  {isNegative ? "" : "+"}
                  {row.distance.toFixed(1)}%
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="text-center text-xs text-slate-500 py-2">
            {t("dipFinder.loading")}
          </div>
        )}
      </div>
    </div>
  );
}
