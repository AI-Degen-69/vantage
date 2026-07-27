import { useTranslation } from "react-i18next";
import { Portfolio as PortfolioType } from "@/lib/mockData";
import { ChevronDown, RefreshCw } from "lucide-react";

export const mockPortfolio: PortfolioType = {
  name: "My First Portfolio",
  currentValue: 1250450.00,
  gainLoss: 154230.50,
  annualIncome: 45200.00,
  dividendYield: 3.6,
  holdings: [
    { ticker: "AAPL", weight: 25.4, gainLoss: 45.2 },
    { ticker: "MSFT", weight: 20.1, gainLoss: 32.8 },
    { ticker: "NVDA", weight: 15.5, gainLoss: 125.4 },
    { ticker: "SPY", weight: 39.0, gainLoss: 12.5 },
  ]
};

export default function Portfolio() {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <select className="appearance-none bg-slate-800 border border-slate-700 text-lg font-bold py-2 pl-4 pr-10 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer text-foreground">
              <option>{mockPortfolio.name}</option>
              <option>Tech Heavy</option>
              <option>Dividend Kings</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select className="appearance-none bg-slate-800 border border-slate-700 text-sm py-2.5 pl-4 pr-10 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer text-foreground">
              <option>USD ($)</option>
              <option>ILS (₪)</option>
              <option>EUR (€)</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4" />
          {t("portfolio.updatePortfolio")}
        </button>
      </div>

      {/* 5-row KPI Strip (5 columns on desktop) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm text-slate-400 mb-2">{t("portfolio.currentValue")}</p>
          <p className="text-2xl font-bold text-foreground" dir="ltr">${mockPortfolio.currentValue.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm text-slate-400 mb-2">{t("portfolio.gainLoss")} ($)</p>
          <p className="text-2xl font-bold text-green-400" dir="ltr">+${mockPortfolio.gainLoss.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm text-slate-400 mb-2">{t("portfolio.gainLoss")} (%)</p>
          <p className="text-2xl font-bold text-green-400" dir="ltr">+{(mockPortfolio.gainLoss / mockPortfolio.currentValue * 100).toFixed(2)}%</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm text-slate-400 mb-2">{t("portfolio.annualIncome")}</p>
          <p className="text-2xl font-bold text-blue-400" dir="ltr">${mockPortfolio.annualIncome.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm text-slate-400 mb-2">{t("portfolio.dividendYield")}</p>
          <p className="text-2xl font-bold text-blue-400" dir="ltr">{mockPortfolio.dividendYield.toFixed(2)}%</p>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-xl font-bold mb-6">{t("portfolio.holdings")}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border">
              <tr>
                <th className="pb-3 font-medium">{t("portfolio.stock")}</th>
                <th className="pb-3 font-medium text-right">{t("portfolio.weight")}</th>
                <th className="pb-3 font-medium text-right">{t("portfolio.gainLoss")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockPortfolio.holdings.map((holding, i) => (
                <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-4 font-bold text-base">{holding.ticker}</td>
                  <td className="py-4 text-right font-medium" dir="ltr">{holding.weight.toFixed(1)}%</td>
                  <td className={`py-4 text-right font-medium ${holding.gainLoss >= 0 ? "text-green-400" : "text-red-400"}`} dir="ltr">
                    {holding.gainLoss >= 0 ? "+" : ""}{holding.gainLoss.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
