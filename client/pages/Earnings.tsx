import { useTranslation } from "react-i18next";
import EarningsCalendar from "@/components/EarningsCalendar";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";

export default function Earnings() {
  const { t } = useTranslation();

  return (
    <div className="w-full bg-background dark min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">{t("sidebar.earnings")}</h1>
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
            {t("earningsCalendar.updateEarnings")}
          </button>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-border">
          {/* Week Navigation */}
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-slate-800 rounded-md transition-colors text-slate-400">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button className="px-4 py-1.5 bg-slate-800 text-sm font-medium rounded-md hover:text-white transition-colors">
              {t("earningsCalendar.today")}
            </button>
            <button className="p-2 hover:bg-slate-800 rounded-md transition-colors text-slate-400">
              <ChevronRight className="w-5 h-5" />
            </button>
            <span className="ml-4 text-sm font-medium">May 20 - May 24, 2024</span>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-md text-sm border border-slate-700">
              <Filter className="w-4 h-4 text-slate-400" />
              <span>{t("earningsCalendar.marketCap")}</span>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" className="rounded border-slate-700 bg-slate-800 focus:ring-blue-500" />
              {t("earningsCalendar.filterByWatchlist")}
            </label>
          </div>
        </div>

        <EarningsCalendar />
      </div>
    </div>
  );
}
