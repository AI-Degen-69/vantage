import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface DCFWidgetProps {
  currentPrice: number;
}

export default function DCFWidget({ currentPrice = 150.0 }: DCFWidgetProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"earnings" | "cashFlow">("earnings");
  
  // Inputs
  const [currentEarnings, setCurrentEarnings] = useState(5.0);
  const [growthRate, setGrowthRate] = useState(10.0);
  const [multiple, setMultiple] = useState(20.0);
  const [targetReturn, setTargetReturn] = useState(15.0);

  // Computations
  const year5Earnings = currentEarnings * Math.pow(1 + growthRate / 100, 5);
  const year5Price = year5Earnings * multiple;
  
  // Forward: Return from today's price = (Year 5 Price / Current Price) ^ (1/5) - 1
  const forwardReturn = (Math.pow(year5Price / currentPrice, 1 / 5) - 1) * 100;
  
  // Reverse: Entry price for X% return = Year 5 Price / (1 + Target Return)^5
  const reverseEntryPrice = year5Price / Math.pow(1 + targetReturn / 100, 5);

  // Projection Chart Data
  const chartData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const data = [];
    for (let i = 0; i <= 5; i++) {
      const e = currentEarnings * Math.pow(1 + growthRate / 100, i);
      const p = e * multiple;
      data.push({
        year: (currentYear + i).toString(),
        earnings: e,
        price: p
      });
    }
    return data;
  }, [currentEarnings, growthRate, multiple]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col md:flex-row">
      {/* Left Panel: Inputs */}
      <div className="w-full md:w-1/3 bg-slate-900/50 p-6 border-b md:border-b-0 md:border-r border-border">
        <h2 className="text-xl font-bold mb-6">{t("dcf.title")}</h2>
        
        <div className="flex bg-slate-800 rounded-lg p-1 mb-8">
          <button 
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "earnings" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
            onClick={() => setMode("earnings")}
          >
            {t("dcf.earningsMode")}
          </button>
          <button 
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "cashFlow" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
            onClick={() => setMode("cashFlow")}
          >
            {t("dcf.cashFlowMode")}
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm text-slate-400 mb-2">{t("dcf.currentEarnings")}</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500">$</span>
              <input 
                type="number" 
                value={currentEarnings} 
                onChange={(e) => setCurrentEarnings(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-7 pr-4 text-foreground focus:outline-none focus:border-blue-500"
                dir="ltr"
              />
            </div>
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm text-slate-400">{t("dcf.growthRate")} (%)</label>
              <Info className="w-4 h-4 text-slate-500" />
            </div>
            <input 
              type="number" 
              value={growthRate} 
              onChange={(e) => setGrowthRate(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-4 text-foreground focus:outline-none focus:border-blue-500"
              dir="ltr"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm text-slate-400">{t("dcf.multiple")}</label>
              <Info className="w-4 h-4 text-slate-500" />
            </div>
            <input 
              type="number" 
              value={multiple} 
              onChange={(e) => setMultiple(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-4 text-foreground focus:outline-none focus:border-blue-500"
              dir="ltr"
            />
          </div>
        </div>
      </div>

      {/* Right Panel: Outputs and Chart */}
      <div className="w-full md:w-2/3 p-6 flex flex-col">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-sm text-slate-400 mb-2">{t("dcf.forward")}</p>
            <p className={`text-3xl font-bold whitespace-nowrap ${forwardReturn >= 0 ? "text-green-400" : "text-red-400"}`} dir="ltr">
              {forwardReturn >= 0 ? "+" : ""}{forwardReturn.toFixed(2)}%
            </p>
            <p className="text-xs text-slate-500 mt-2">{t("dcf.basedOnCurrentPrice")}{currentPrice}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-400">{t("dcf.reverse")}</p>
              <input 
                type="number" 
                value={targetReturn} 
                onChange={(e) => setTargetReturn(Number(e.target.value))}
                className="w-16 bg-slate-900 border border-slate-700 rounded text-center text-xs py-1 text-white focus:outline-none focus:border-blue-500"
                dir="ltr"
              />
            </div>
            <p className="text-3xl font-bold text-blue-400" dir="ltr">
              ${reverseEntryPrice.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-2">{t("dcf.targetingReturn", { target: targetReturn })}</p>
          </div>
        </div>

        <div className="flex-1 min-h-[250px] bg-slate-900/30 rounded-xl border border-slate-800 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: "8px" }}
                itemStyle={{ color: "#e2e8f0" }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, t("dcf.projectedPrice")]}
              />
              <Line yAxisId="left" type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: "#3b82f6", strokeWidth: 2, stroke: "#0f172a" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
