import { useTranslation } from "react-i18next";
import { EarningsEvent } from "@/lib/mockData";

export const mockEarningsEvents: EarningsEvent[] = [
  { ticker: "NVDA", date: "Mon", epsEst: 5.59, revEst: 24.6, time: "After Close" },
  { ticker: "SNOW", date: "Tue", epsEst: 0.14, revEst: 749.5, time: "Before Open", surprise: "beat", epsActual: 0.18, revActual: 755.0 },
  { ticker: "MDT", date: "Wed", epsEst: 1.45, epsActual: 1.46, revEst: 8.44, revActual: 8.59, time: "Before Open", surprise: "beat" },
  { ticker: "INTU", date: "Wed", epsEst: 9.38, revEst: 6.64, time: "After Close" },
  { ticker: "TGT", date: "Thu", epsEst: 2.05, revEst: 24.5, time: "Before Open" },
  { ticker: "WDAY", date: "Thu", epsEst: 1.58, revEst: 1.97, time: "After Close" }
];

export default function EarningsCalendar() {
  const { t } = useTranslation();
  const days = [
    { key: "Mon", i18nKey: "earningsCalendar.mon" },
    { key: "Tue", i18nKey: "earningsCalendar.tue" },
    { key: "Wed", i18nKey: "earningsCalendar.wed" },
    { key: "Thu", i18nKey: "earningsCalendar.thu" },
    { key: "Fri", i18nKey: "earningsCalendar.fri" },
  ];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="grid grid-cols-5 divide-x divide-border">
        {days.map((dayObj) => {
          const events = mockEarningsEvents.filter(e => e.date === dayObj.key);
          return (
            <div key={dayObj.key} className="min-h-[400px]">
              <div className="bg-slate-900/50 p-4 border-b border-border text-center">
                <span className="font-semibold text-foreground">{t(dayObj.i18nKey)}</span>
              </div>
              <div className="p-4 space-y-4">
                {events.map((ev, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 hover:border-slate-600 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-foreground text-lg">{ev.ticker}</div>
                      <div className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        ev.time === "Before Open" ? "bg-amber-500/20 text-amber-400" : "bg-purple-500/20 text-purple-400"
                      }`}>
                        {ev.time === "Before Open" ? t("earningsCalendar.beforeOpen") : t("earningsCalendar.afterClose")}
                      </div>
                    </div>
                    
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>{t("earningsCalendar.epsEst")}</span>
                        <span dir="ltr">${ev.epsEst.toFixed(2)}</span>
                      </div>
                      {ev.epsActual && (
                        <div className="flex justify-between font-medium">
                          <span>{t("earningsCalendar.actual")}</span>
                          <span className={ev.surprise === "beat" ? "text-green-400" : "text-red-400"} dir="ltr">${ev.epsActual.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-400 pt-1">
                        <span>{t("earningsCalendar.revEst")}</span>
                        <span dir="ltr">${ev.revEst.toFixed(2)}B</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
