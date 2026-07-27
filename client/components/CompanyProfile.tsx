import { useTranslation } from "react-i18next";
import { 
  mockCompanyProfile, 
  mockAnalystEstimates, 
  mockInsiderTrades, 
  mockNews, 
  mockEmployeeCount 
} from "@/lib/mockData";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function CompanyProfile() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 mt-8">
      <h2 className="text-2xl font-bold text-foreground">{t("insights.companyProfile")}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Details & Description */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              {mockCompanyProfile.description}
            </p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-2">
              <div>
                <p className="text-xs text-muted-foreground">{t("insights.ceo")}</p>
                <p className="text-sm font-medium">{mockCompanyProfile.ceo}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("insights.sector")}</p>
                <p className="text-sm font-medium">{mockCompanyProfile.sector}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("insights.industry")}</p>
                <p className="text-sm font-medium">{mockCompanyProfile.industry}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("insights.employees")}</p>
                <p className="text-sm font-medium" dir="ltr">{mockCompanyProfile.employees.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("insights.beta")}</p>
                <p className="text-sm font-medium" dir="ltr">{mockCompanyProfile.beta}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("insights.piotroskiScore")}</p>
                <p className="text-sm font-medium text-green-400" dir="ltr">{mockCompanyProfile.piotroskiScore} / 9</p>
              </div>
            </div>
          </div>

          {/* Insider Trading Table */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">{t("insights.insiderTrading")}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase border-b border-border">
                  <tr>
                    <th className="pb-3 font-medium">{t("common.name")}</th>
                    <th className="pb-3 font-medium">{t("common.date")}</th>
                    <th className="pb-3 font-medium">{t("common.type")}</th>
                    <th className="pb-3 font-medium">{t("common.price")}</th>
                    <th className="pb-3 font-medium">{t("common.transacted")}</th>
                    <th className="pb-3 font-medium text-right">{t("common.value")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {mockInsiderTrades.map((trade, i) => (
                    <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 font-medium">{trade.name}</td>
                      <td className="py-3 text-muted-foreground">{trade.date}</td>
                      <td className="py-3">{trade.type}</td>
                      <td className="py-3" dir="ltr">${trade.price.toFixed(2)}</td>
                      <td className={`py-3 ${trade.transacted > 0 ? "text-green-400" : "text-red-400"}`} dir="ltr">
                        {trade.transacted > 0 ? "+" : ""}{trade.transacted.toLocaleString()}
                      </td>
                      <td className="py-3 text-right" dir="ltr">
                        ${Math.abs(trade.value).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Charts & News */}
        <div className="space-y-6">
          {/* Analyst Estimates */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">{t("insights.analystEstimates")}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground uppercase pb-2 border-b border-border">
                <div className="col-span-1">Period</div>
                <div className="text-right">Avg</div>
                <div className="text-right">Low</div>
                <div className="text-right">High</div>
              </div>
              <div className="text-sm font-medium mb-2 text-blue-400">EPS</div>
              {mockAnalystEstimates.filter(e => e.metric === "EPS").map((est, i) => (
                <div key={`eps-${i}`} className="grid grid-cols-4 gap-2 text-sm items-center">
                  <div className="text-muted-foreground">{est.period}</div>
                  <div className="text-right" dir="ltr">{est.avg.toFixed(2)}</div>
                  <div className="text-right" dir="ltr">{est.low.toFixed(2)}</div>
                  <div className="text-right" dir="ltr">{est.high.toFixed(2)}</div>
                </div>
              ))}
              <div className="text-sm font-medium mt-4 mb-2 text-green-400">Revenue (B)</div>
              {mockAnalystEstimates.filter(e => e.metric === "Revenue").map((est, i) => (
                <div key={`rev-${i}`} className="grid grid-cols-4 gap-2 text-sm items-center">
                  <div className="text-muted-foreground">{est.period}</div>
                  <div className="text-right" dir="ltr">{est.avg.toFixed(1)}</div>
                  <div className="text-right" dir="ltr">{est.low.toFixed(1)}</div>
                  <div className="text-right" dir="ltr">{est.high.toFixed(1)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Employee Count Chart */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">{t("insights.employeeCount")}</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockEmployeeCount}>
                  <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px" }}
                    itemStyle={{ color: "#e2e8f0" }}
                    formatter={(value: number) => [value.toLocaleString(), t("insights.employees")]}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* News Aggregator */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">{t("insights.news")}</h3>
            <div className="space-y-4">
              {mockNews.map((news, i) => (
                <a key={i} href={news.url} className="block group border-b border-border last:border-0 pb-4 last:pb-0">
                  <p className="text-sm font-medium group-hover:text-blue-400 transition-colors line-clamp-2 mb-1">
                    {news.headline}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold">{news.publisher}</span>
                    <span>&bull;</span>
                    <span>{news.timestamp}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
