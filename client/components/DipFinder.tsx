import { useState } from "react";
import { useTranslation } from "react-i18next";
import { defaultWatchlist } from "@/lib/mockData";
import { ChevronDown } from "lucide-react";

export default function DipFinder() {
  const { t } = useTranslation();
  const [smaWindow, setSmaWindow] = useState("200day");
  
  // Sort watchlist by smaDistance ascending to find the biggest "dips"
  const sortedTickers = [...defaultWatchlist].sort((a, b) => a.sma200Distance - b.sma200Distance);

  // Normalize distances to compute bar width (max distance = 100%)
  const maxDistance = Math.max(...sortedTickers.map(t => Math.abs(t.sma200Distance)));

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold">{t("dipFinder.title")}</h3>
        <div className="relative">
          <select 
            value={smaWindow}
            onChange={(e) => setSmaWindow(e.target.value)}
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

      <div className="space-y-4">
        {sortedTickers.map(ticker => {
          const width = Math.max(5, (Math.abs(ticker.sma200Distance) / maxDistance) * 100);
          const isNegative = ticker.sma200Distance < 0;
          return (
            <div key={ticker.symbol} className="flex items-center gap-4 group cursor-pointer">
              <div className="w-16 font-semibold text-sm group-hover:text-blue-400 transition-colors shrink-0">
                {ticker.symbol}
              </div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-3 bg-slate-800/50 rounded-full overflow-hidden flex">
                  {/* Left side (negative) */}
                  <div className="w-1/2 h-full flex justify-end">
                    {isNegative && (
                      <div 
                        className="h-full bg-red-500 rounded-l-full transition-all duration-500"
                        style={{ width: `${width}%` }}
                      />
                    )}
                  </div>
                  {/* Right side (positive) */}
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
                  className={`w-16 text-right text-sm font-semibold shrink-0 ${isNegative ? "text-red-400" : "text-green-400"}`}
                  dir="ltr"
                >
                  {isNegative ? "" : "+"}{ticker.sma200Distance.toFixed(1)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
