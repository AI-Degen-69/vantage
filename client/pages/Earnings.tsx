import { useState, useMemo } from "react";
import StockSlideOver from "@/components/StockSlideOver";
import { useI18n } from "@/lib/i18n";
import {
  useEarningsCalendar,
  EarningsEvent,
} from "@/hooks/useStockData";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  TrendingUp,
  TrendingDown,
  Building2,
  Clock,
} from "lucide-react";

function formatLargeNumber(num: number | null | undefined): string {
  if (num == null) return "—";
  if (num === 0) return "$0";
  if (Math.abs(num) >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function getWeekDates(date: Date): Date[] {
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(start.getDate() - day);
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function getHourLabel(hour: string): string {
  switch (hour) {
    case "bmo":
      return "BMO";
    case "amc":
      return "AMC";
    case "dmh":
      return "Midday";
    default:
      return "";
  }
}

function getHourIcon(hour: string) {
  switch (hour) {
    case "bmo":
      return <TrendingUp className="w-3 h-3" />;
    case "amc":
      return <TrendingDown className="w-3 h-3" />;
    default:
      return <Clock className="w-3 h-3" />;
  }
}

export default function Earnings() {
  const { t, dir } = useI18n();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEarnings, setSelectedEarnings] = useState<EarningsEvent[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"week" | "list">("week");
  const [slideOverTicker, setSlideOverTicker] = useState<string | null>(null);

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);
  const fromDate = formatDate(weekDates[0]);
  const toDate = formatDate(weekDates[6]);

  const { data, isLoading, isError } = useEarningsCalendar(fromDate, toDate);
  const earnings = data?.earnings ?? [];

  const earningsByDate = useMemo(() => {
    const map = new Map<string, EarningsEvent[]>();
    for (const e of earnings) {
      const existing = map.get(e.date) || [];
      existing.push(e);
      map.set(e.date, existing);
    }
    return map;
  }, [earnings]);

  const earningsByDateAndHour = useMemo(() => {
    const map = new Map<string, { bmo: EarningsEvent[]; amc: EarningsEvent[]; other: EarningsEvent[] }>();
    for (const [date, events] of earningsByDate) {
      const groups = { bmo: [] as EarningsEvent[], amc: [] as EarningsEvent[], other: [] as EarningsEvent[] };
      for (const e of events) {
        if (e.hour === "bmo") groups.bmo.push(e);
        else if (e.hour === "amc") groups.amc.push(e);
        else groups.other.push(e);
      }
      map.set(date, groups);
    }
    return map;
  }, [earningsByDate]);

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    setCurrentDate(newDate);
    setSelectedDate(null);
    setSelectedEarnings(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
    setSelectedEarnings(null);
  };

  const handleDateClick = (dateStr: string, events: EarningsEvent[]) => {
    setSelectedDate(dateStr);
    setSelectedEarnings(events);
  };

  const handleOpenSlideOver = (symbol: string) => {
    setSlideOverTicker(symbol);
  };

  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const monthStart = MONTH_LABELS[weekStart.getMonth()];
  const monthEnd = MONTH_LABELS[weekEnd.getMonth()];
  const headerRange =
    monthStart === monthEnd
      ? `${monthStart} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekStart.getFullYear()}`
      : `${monthStart} ${weekStart.getDate()} - ${monthEnd} ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;

  const totalEarnings = earnings.length;
  const bmoCount = earnings.filter((e) => e.hour === "bmo").length;
  const amcCount = earnings.filter((e) => e.hour === "amc").length;

  return (
    <div className="w-full bg-background dark min-h-screen">
      {/* Slide-over for stock detail */}
      <StockSlideOver
        ticker={slideOverTicker || ""}
        isOpen={!!slideOverTicker}
        onClose={() => setSlideOverTicker(null)}
      />

      {/* Header */}
      <div className="bg-slate-800/50 border-b border-slate-700 px-4 sm:px-8 py-8">
        <div className="max-w-7xl mx-auto">            <h1 className="text-3xl sm:text-4xl font-bold text-center text-foreground mb-6">
            {t("earnings.title")}
          </h1>

          {/* Week Navigation */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={() => navigateWeek(-1)}
              className="p-2 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-300 hover:text-foreground hover:border-slate-500 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">{headerRange}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {t("earnings.week")} {Math.ceil((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}
              </p>
            </div>
            <button
              onClick={() => navigateWeek(1)}
              className="p-2 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-300 hover:text-foreground hover:border-slate-500 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={goToToday}
              className="ml-2 px-3 py-2 text-xs font-medium rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all"
            >
              {t("earnings.today")}
            </button>
          </div>

          {/* Stats Bar */}
          <div className="flex justify-center gap-6 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{totalEarnings}</p>
              <p className="text-xs text-slate-400">{t("earnings.total_reports")}</p>
            </div>
            <div className="w-px bg-slate-700" />
            <div className="text-center">
              <p className="text-2xl font-bold text-chart-green">{bmoCount}</p>
              <p className="text-xs text-slate-400">{t("earnings.before_open")}</p>
            </div>
            <div className="w-px bg-slate-700" />
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">{amcCount}</p>
              <p className="text-xs text-slate-400">{t("earnings.after_close")}</p>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex justify-center mt-6">
            <div className="inline-flex bg-slate-700/50 border border-slate-600 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("week")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  viewMode === "week"
                    ? "bg-slate-600 text-foreground"
                    : "text-slate-400 hover:text-foreground"
                }`}
              >
                {t("earnings.view_week")}
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  viewMode === "list"
                    ? "bg-slate-600 text-foreground"
                    : "text-slate-400 hover:text-foreground"
                }`}
              >
                {t("earnings.view_list")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-4" />
              <p className="text-slate-400">{t("earnings.loading")}</p>
            </div>
          ) : isError ? (
            <div className="text-center py-12">
              <p className="text-red-400 mb-2">{t("earnings.error.title")}</p>
              <p className="text-slate-500 text-sm">{t("earnings.error.desc")}</p>
            </div>
          ) : earnings.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-700/50 mb-4">
                <Building2 className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-slate-400 mb-1">{t("earnings.empty.title")}</p>
              <p className="text-xs text-slate-500">{t("earnings.empty.desc")}</p>
            </div>
          ) : viewMode === "week" ? (
            <>
              {/* Week Grid */}
              <div className="grid grid-cols-7 gap-2 sm:gap-3">
                {weekDates.map((date) => {
                  const dateStr = formatDate(date);
                  const dayEarnings = earningsByDate.get(dateStr) || [];
                  const dayGroups = earningsByDateAndHour.get(dateStr);
                  const todayFlag = isToday(date);

                  return (
                    <button
                      key={dateStr}
                      onClick={() => handleDateClick(dateStr, dayEarnings)}
                      className={`text-left rounded-lg border transition-all ${
                        selectedDate === dateStr
                          ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30"
                          : todayFlag
                          ? "border-blue-500/50 bg-slate-700/30"
                          : "border-slate-700 bg-card hover:border-slate-500"
                      }`}
                    >
                      <div className={`px-2 py-2 border-b text-center ${selectedDate === dateStr ? "border-blue-500/30" : "border-slate-700"}`}>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{DAY_LABELS[date.getDay()]}</p>
                        <p className={`text-lg font-bold ${todayFlag ? "text-blue-400" : "text-foreground"}`}>{date.getDate()}</p>
                        <p className="text-[9px] text-slate-500">{MONTH_LABELS[date.getMonth()]}</p>
                      </div>
                      {dayEarnings.length > 0 && (
                        <div className="px-2 py-2 space-y-1.5">
                          <span className="text-[10px] font-semibold text-foreground">{dayEarnings.length === 1 ? t("earnings.report", { count: dayEarnings.length }) : t("earnings.reports", { count: dayEarnings.length })}</span>
                          {dayGroups && (
                            <div className="space-y-0.5">
                              {dayGroups.bmo.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="w-2.5 h-2.5 text-chart-green" />
                                  <span className="text-[9px] text-chart-green font-medium">{dayGroups.bmo.length} {t("earnings.bmo")}</span>
                                </div>
                              )}
                              {dayGroups.amc.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <TrendingDown className="w-2.5 h-2.5 text-red-400" />
                                  <span className="text-[9px] text-red-400 font-medium">{dayGroups.amc.length} {t("earnings.amc")}</span>
                                </div>
                              )}
                              {dayGroups.other.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5 text-amber-400" />
                                  <span className="text-[9px] text-amber-400 font-medium">{dayGroups.other.length} {t("earnings.other")}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected Day Details */}
              {selectedEarnings && selectedDate && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-foreground">
                      {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </h2>
                    <span className="text-xs text-slate-400">
                      {selectedEarnings.length === 1 ? t("earnings.report", { count: selectedEarnings.length }) : t("earnings.reports", { count: selectedEarnings.length })}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {selectedEarnings.map((e) => (
                      <div
                        key={e.symbol + e.date}
                        onClick={() => handleOpenSlideOver(e.symbol)}
                        className="bg-card rounded-lg p-4 border border-slate-700 hover:border-slate-500 hover:bg-slate-700/30 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <img
                              src={`/api/company-logo?ticker=${e.symbol}`}
                              alt={e.symbol}
                              className="w-8 h-8 rounded"
                              onError={(el) => {
                                (el.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                            <div>
                              <p className="text-sm font-semibold text-foreground group-hover:text-blue-400 transition-colors">
                                {e.name || e.symbol}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {e.symbol}
                                {e.exchange ? ` · ${e.exchange}` : ""}
                                {e.marketCap != null ? ` · ${formatLargeNumber(e.marketCap)}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {e.hour && (
                              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                                e.hour === "bmo"
                                  ? "text-chart-green bg-chart-green/10 border-chart-green/30"
                                  : e.hour === "amc"
                                  ? "text-red-400 bg-red-400/10 border-red-400/30"
                                  : "text-amber-400 bg-amber-400/10 border-amber-400/30"
                              }`}>
                                {getHourIcon(e.hour)}
                                {getHourLabel(e.hour)}
                              </span>
                            )}
                            <p className="text-[10px] text-slate-500 mt-1">Q{e.quarter} {e.year}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-6 text-xs">
                          {e.epsEstimate != null && (
                            <div>
                              <span className="text-slate-400">{t("earnings.eps_est")} </span>
                              <span className="text-foreground font-medium">${e.epsEstimate.toFixed(2)}</span>
                            </div>
                          )}
                          {e.epsActual != null && (
                            <div>
                              <span className="text-slate-400">{t("earnings.eps_act")} </span>
                              <span className={`font-medium ${e.epsActual >= (e.epsEstimate || 0) ? "text-chart-green" : "text-red-400"}`}>
                                ${e.epsActual.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {e.epsEstimate != null && e.epsActual != null && (
                            <div>
                              <span className="text-slate-400">{t("earnings.surprise")} </span>
                              <span className={`font-medium ${e.epsActual >= e.epsEstimate ? "text-chart-green" : "text-red-400"}`}>
                                {((e.epsActual - e.epsEstimate) / Math.abs(e.epsEstimate) * 100).toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center gap-6 text-xs">
                          {e.revenueEstimate != null && (
                            <div>
                              <span className="text-slate-400">{t("earnings.rev_est")} </span>
                              <span className="text-foreground font-medium">{formatLargeNumber(e.revenueEstimate)}</span>
                            </div>
                          )}
                          {e.revenueActual != null && (
                            <div>
                              <span className="text-slate-400">{t("earnings.rev_act")} </span>
                              <span className={`font-medium ${e.revenueActual >= (e.revenueEstimate || 0) ? "text-chart-green" : "text-red-400"}`}>
                                {formatLargeNumber(e.revenueActual)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* List View */
            <div className="space-y-1">
              {earnings.map((e, idx) => (
                <div
                  key={`${e.symbol}-${e.date}-${idx}`}
                  onClick={() => handleOpenSlideOver(e.symbol)}
                  className="bg-card rounded-lg px-4 py-3 border border-slate-700 hover:border-slate-500 hover:bg-slate-700/30 transition-all cursor-pointer group flex items-center gap-4"
                >
                  <div className="flex-shrink-0 w-10 text-center">
                    <p className="text-[10px] font-medium text-slate-400 uppercase">
                      {new Date(e.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}
                    </p>
                    <p className="text-sm font-bold text-foreground">
                      {new Date(e.date + "T00:00:00").getDate()}
                    </p>
                  </div>
                  <img
                    src={`/api/company-logo?ticker=${e.symbol}`}
                    alt={e.symbol}
                    className="w-7 h-7 rounded flex-shrink-0"
                    onError={(el) => {
                      (el.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground group-hover:text-blue-400 transition-colors truncate">{e.name || e.symbol}</p>
                    <p className="text-[10px] text-slate-500">
                      {e.symbol}{e.exchange ? ` · ${e.exchange}` : ""}{e.marketCap != null ? ` · ${formatLargeNumber(e.marketCap)}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {e.hour && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                        e.hour === "bmo"
                          ? "text-chart-green bg-chart-green/10 border-chart-green/30"
                          : e.hour === "amc"
                          ? "text-red-400 bg-red-400/10 border-red-400/30"
                          : "text-amber-400 bg-amber-400/10 border-amber-400/30"
                      }`}>
                        {getHourIcon(e.hour)}
                        {getHourLabel(e.hour)}
                      </span>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 min-w-[80px]">
                    {e.epsEstimate != null && (
                      <p className="text-xs text-foreground font-medium">{t("earnings.est")} ${e.epsEstimate.toFixed(2)}</p>
                    )}
                    <p className="text-[10px] text-slate-500">Q{e.quarter} {e.year}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
