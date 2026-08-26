import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { Sliders, TrendingUp, Info, ArrowRight, LineChart as ChartIcon, Sparkles } from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Link } from "react-router-dom";

export interface DCFWidgetProps {
  ticker?: string;
  currentPrice?: number;
  companyName?: string;
  initialFcf?: number;
  initialGrowth?: number;
  initialMultiple?: number;
  initialDiscount?: number;
  sharesOutstanding?: number;
}

/**
 * Renders the modern Instant Discounted Cash Flow Sandbox and 5-Year Growth Trajectory Engine.
 *
 * @param currentPrice - The current price used to calculate forward return and margin of safety.
 * @param ticker - Optional ticker symbol being modeled.
 * @param companyName - Optional friendly company name.
 * @returns The rendered DCF Sandbox component.
 */
export function DCFWidget({
  ticker = "AAPL",
  currentPrice = 231.42,
  companyName,
  initialFcf = 108.8,
  initialGrowth = 10.0,
  initialMultiple = 25.0,
  initialDiscount = 9.0,
  sharesOutstanding = 15.2,
}: DCFWidgetProps) {
  const { t } = useI18n();

  // Active view tab: Interactive Sandbox (Image 1) or 5Y Trajectory Chart
  const [activeTab, setActiveTab] = useState<"sandbox" | "trajectory">("sandbox");
  const [valuationMode, setValuationMode] = useState<"cashFlow" | "earnings">("cashFlow");

  // Inputs
  const [baseFcf, setBaseFcf] = useState<number>(initialFcf);
  const [growthRate, setGrowthRate] = useState<number>(initialGrowth);
  const [multiple, setMultiple] = useState<number>(initialMultiple);
  const [discountRate, setDiscountRate] = useState<number>(initialDiscount);
  const [targetReturn, setTargetReturn] = useState<number>(15.0);

  // --------------------------------------------------------------------------
  // DCF Calculations
  // --------------------------------------------------------------------------
  // 5-year discounted cash flow + terminal value computation:
  // Fair Value = (Sum of discounted FCFs over 5 years + Discounted Terminal Value) / Shares Outstanding
  const { fairValue, year5Fcf, year5Price, forwardReturn, reverseEntryPrice, marginOfSafety } =
    useMemo(() => {
      const g = growthRate / 100;
      const d = discountRate / 100;
      let sumPv = 0;

      for (let yr = 1; yr <= 5; yr++) {
        const fcfYr = baseFcf * Math.pow(1 + g, yr);
        const pv = fcfYr / Math.pow(1 + d, yr);
        sumPv += pv;
      }

      const y5Fcf = baseFcf * Math.pow(1 + g, 5);
      const terminalVal = y5Fcf * multiple;
      const pvTerminal = terminalVal / Math.pow(1 + d, 5);
      const totalEnterprisePv = sumPv + pvTerminal;

      // Intrinsic fair value per share (assuming shares in billions, FCF in billions)
      const shares = sharesOutstanding > 0 ? sharesOutstanding : 15.2;
      const computedFairValue = totalEnterprisePv / (shares / 10); // normalized valuation index per share

      const y5Price = (y5Fcf / (shares / 10)) * multiple;
      const fwd = currentPrice > 0 ? (Math.pow(y5Price / currentPrice, 1 / 5) - 1) * 100 : 0;
      const revEntry = y5Price / Math.pow(1 + targetReturn / 100, 5);
      const mos = currentPrice > 0 ? ((computedFairValue - currentPrice) / currentPrice) * 100 : 0;

      return {
        fairValue: computedFairValue,
        year5Fcf: y5Fcf,
        year5Price: y5Price,
        forwardReturn: fwd,
        reverseEntryPrice: revEntry,
        marginOfSafety: mos,
      };
    }, [baseFcf, growthRate, multiple, discountRate, sharesOutstanding, currentPrice, targetReturn]);

  // Status classification
  const valuationStatus = useMemo(() => {
    if (marginOfSafety > 5) return "undervalued";
    if (marginOfSafety < -5) return "overvalued";
    return "fairlyValued";
  }, [marginOfSafety]);

  // 5-Year Trajectory Recharts Data
  const chartData = useMemo(() => {
    const currentYr = new Date().getFullYear();
    const data = [];
    for (let i = 0; i <= 5; i++) {
      const fcf = baseFcf * Math.pow(1 + growthRate / 100, i);
      const impliedPrice = (fcf / (sharesOutstanding / 10)) * multiple;
      data.push({
        year: (currentYr + i).toString(),
        fcf: Number(fcf.toFixed(1)),
        price: Number(impliedPrice.toFixed(2)),
      });
    }
    return data;
  }, [baseFcf, growthRate, multiple, sharesOutstanding]);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl flex flex-col space-y-0">
      {/* Top Header matching Image 1 */}
      <div className="p-6 sm:p-8 border-b border-border/80 bg-secondary/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-primary mb-1">
            <Sliders className="w-4 h-4 text-primary" />
            <span>{t("dcf.eyebrow")}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            {t("dcf.sandboxTitle")}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            {t("dcf.sandboxSubtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Tab selector between Sandbox and Trajectory */}
          <div className="flex items-center bg-muted/60 rounded-lg p-1 border border-border">
            <button
              type="button"
              onClick={() => setActiveTab("sandbox")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
                activeTab === "sandbox"
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{t("dcf.sandboxTab")}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("trajectory")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
                activeTab === "trajectory"
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ChartIcon className="w-3.5 h-3.5" />
              <span>{t("dcf.trajectoryTab")}</span>
            </button>
          </div>

          <Link
            to={`/stock/${ticker}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-primary hover:text-primary/80 transition-colors font-medium"
          >
            <span>{t("dcf.openFullTool")}</span>
          </Link>
        </div>
      </div>

      {/* Main Interactive Valuation Sandbox (Image 1 Design) */}
      {activeTab === "sandbox" ? (
        <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Controls Column (4 Sliders) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Mode selection pills */}
            <div className="flex items-center gap-2 pb-2">
              <span className="text-xs font-mono text-muted-foreground">Mode:</span>
              <div className="inline-flex bg-muted/50 rounded-lg p-0.5 border border-border">
                <button
                  type="button"
                  onClick={() => setValuationMode("cashFlow")}
                  className={`px-3 py-1 text-xs font-mono rounded-md transition-colors ${
                    valuationMode === "cashFlow"
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("dcf.cashFlowMode")}
                </button>
                <button
                  type="button"
                  onClick={() => setValuationMode("earnings")}
                  className={`px-3 py-1 text-xs font-mono rounded-md transition-colors ${
                    valuationMode === "earnings"
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("dcf.earningsMode")}
                </button>
              </div>
            </div>

            {/* Slider 1: Base FCF */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <label htmlFor="dcf-base-fcf-slider" className="text-muted-foreground font-medium">
                  {t("dcf.baseFcf")}
                </label>
                <span className="font-semibold text-foreground bg-secondary/60 px-2.5 py-0.5 rounded border border-border tabular-nums" dir="ltr">
                  ${baseFcf.toFixed(1)}B
                </span>
              </div>
              <div className="relative py-1 flex items-center">
                <input
                  id="dcf-base-fcf-slider"
                  type="range"
                  min="5"
                  max="200"
                  step="0.5"
                  value={baseFcf}
                  onChange={(e) => setBaseFcf(parseFloat(e.target.value) || 0)}
                  aria-label={t("dcf.baseFcf") || "Base FCF"}
                  className="w-full h-2.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary border border-border focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                  style={{
                    background: `linear-gradient(to right, hsl(42 65% 70% / 0.8) 0%, hsl(42 65% 70% / 0.8) ${((baseFcf - 5) / (200 - 5)) * 100}%, hsl(250 20% 18%) ${((baseFcf - 5) / (200 - 5)) * 100}%, hsl(250 20% 18%) 100%)`,
                  }}
                />
              </div>
            </div>

            {/* Slider 2: Growth Rate */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <label htmlFor="dcf-growth-slider" className="text-muted-foreground font-medium">
                  {t("dcf.growthRate5Y")}
                </label>
                <span className="font-semibold text-chart-positive bg-secondary/60 px-2.5 py-0.5 rounded border border-border tabular-nums" dir="ltr">
                  +{growthRate.toFixed(0)}% / yr
                </span>
              </div>
              <div className="relative py-1 flex items-center">
                <input
                  id="dcf-growth-slider"
                  type="range"
                  min="-10"
                  max="40"
                  step="1"
                  value={growthRate}
                  onChange={(e) => setGrowthRate(parseFloat(e.target.value) || 0)}
                  aria-label={t("dcf.growthRate5Y") || "Growth Rate"}
                  className="w-full h-2.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary border border-border focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                  style={{
                    background: `linear-gradient(to right, hsl(42 65% 70% / 0.8) 0%, hsl(42 65% 70% / 0.8) ${((growthRate - -10) / (40 - -10)) * 100}%, hsl(250 20% 18%) ${((growthRate - -10) / (40 - -10)) * 100}%, hsl(250 20% 18%) 100%)`,
                  }}
                />
              </div>
            </div>

            {/* Slider 3: Terminal Multiple */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <label htmlFor="dcf-multiple-slider" className="text-muted-foreground font-medium">
                  {t("dcf.exitMultiple")}
                </label>
                <span className="font-semibold text-foreground bg-secondary/60 px-2.5 py-0.5 rounded border border-border tabular-nums" dir="ltr">
                  {multiple.toFixed(0)}x
                </span>
              </div>
              <div className="relative py-1 flex items-center">
                <input
                  id="dcf-multiple-slider"
                  type="range"
                  min="5"
                  max="50"
                  step="1"
                  value={multiple}
                  onChange={(e) => setMultiple(parseFloat(e.target.value) || 0)}
                  aria-label={t("dcf.exitMultiple") || "Exit Multiple"}
                  className="w-full h-2.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary border border-border focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                  style={{
                    background: `linear-gradient(to right, hsl(42 65% 70% / 0.8) 0%, hsl(42 65% 70% / 0.8) ${((multiple - 5) / (50 - 5)) * 100}%, hsl(250 20% 18%) ${((multiple - 5) / (50 - 5)) * 100}%, hsl(250 20% 18%) 100%)`,
                  }}
                />
              </div>
            </div>

            {/* Slider 4: Discount Rate */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <label htmlFor="dcf-discount-slider" className="text-muted-foreground font-medium">
                  {t("dcf.discountRate")}
                </label>
                <span className="font-semibold text-foreground bg-secondary/60 px-2.5 py-0.5 rounded border border-border tabular-nums" dir="ltr">
                  {discountRate.toFixed(0)}%
                </span>
              </div>
              <div className="relative py-1 flex items-center">
                <input
                  id="dcf-discount-slider"
                  type="range"
                  min="4"
                  max="18"
                  step="0.5"
                  value={discountRate}
                  onChange={(e) => setDiscountRate(parseFloat(e.target.value) || 0)}
                  aria-label={t("dcf.discountRate") || "Discount Rate"}
                  className="w-full h-2.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary border border-border focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                  style={{
                    background: `linear-gradient(to right, hsl(42 65% 70% / 0.8) 0%, hsl(42 65% 70% / 0.8) ${((discountRate - 4) / (18 - 4)) * 100}%, hsl(250 20% 18%) ${((discountRate - 4) / (18 - 4)) * 100}%, hsl(250 20% 18%) 100%)`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Right Hero Valuation Card (Image 1 Design) */}
          <div className="lg:col-span-5 bg-secondary/40 border border-border/80 rounded-2xl p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-inner ring-1 ring-white/5">
            <div>
              {/* Card Header with Status Badge */}
              <div className="flex items-center justify-between gap-2 pb-4 border-b border-border/60">
                <span className="text-xs uppercase font-mono tracking-widest text-muted-foreground font-semibold">
                  {t("dcf.estimatedFairValue")}
                </span>
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-1 rounded-md border ${
                    valuationStatus === "undervalued"
                      ? "bg-chart-positive/15 text-chart-positive border-chart-positive/30"
                      : valuationStatus === "overvalued"
                      ? "bg-chart-negative/15 text-chart-negative border-chart-negative/30"
                      : "bg-amber-400/10 text-amber-300 border-amber-400/30"
                  }`}
                >
                  {valuationStatus === "undervalued"
                    ? t("dcf.undervalued")
                    : valuationStatus === "overvalued"
                    ? t("dcf.overvalued")
                    : t("dcf.fairlyValued")}
                </span>
              </div>

              {/* Huge Fair Value Price Readout */}
              <div className="py-6">
                <div className="text-4xl sm:text-5xl font-extrabold font-mono text-foreground tracking-tight" dir="ltr">
                  ${fairValue.toFixed(2)}
                </div>
              </div>

              {/* Substats: Market Price & Projected Margin of Safety */}
              <div className="space-y-2 text-xs font-mono pt-4 border-t border-border/60">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>{t("dcf.marketPrice")}</span>
                  <span className="font-semibold text-foreground tabular-nums" dir="ltr">
                    ${currentPrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t("dcf.marginOfSafety")}</span>
                  <span
                    className={`font-bold tabular-nums ${
                      marginOfSafety >= 0 ? "text-chart-positive" : "text-chart-negative"
                    }`}
                    dir="ltr"
                  >
                    {marginOfSafety >= 0 ? "+" : ""}
                    {marginOfSafety.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Action CTA Button */}
            <Link
              to={`/stock/${ticker}`}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-primary/20 flex items-center justify-center gap-2 text-sm text-center"
            >
              <span>{t("dcf.modelFullFinancials")}</span>
            </Link>
          </div>
        </div>
      ) : (
        /* Trajectory & Recharts Breakdown Mode */
        <div className="p-6 sm:p-8 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-secondary/30 rounded-xl p-6 border border-border space-y-2">
              <p className="text-xs uppercase font-mono text-muted-foreground tracking-wider">
                {t("dcf.forward")}
              </p>
              <p
                className={`text-3xl font-bold font-mono tabular-nums ${
                  forwardReturn >= 0 ? "text-chart-positive" : "text-chart-negative"
                }`}
                dir="ltr"
              >
                {forwardReturn >= 0 ? "+" : ""}
                {forwardReturn.toFixed(2)}% / yr
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                {t("dcf.basedOnCurrentPrice")}${currentPrice.toFixed(2)}
              </p>
            </div>

            <div className="bg-secondary/30 rounded-xl p-6 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase font-mono text-muted-foreground tracking-wider">
                  {t("dcf.reverse", { target: targetReturn })}
                </p>
                <div className="flex items-center gap-1.5">
                  <label htmlFor="dcf-target-return-input" className="text-xs text-muted-foreground">Target %:</label>
                  <input
                    id="dcf-target-return-input"
                    type="number"
                    value={targetReturn}
                    onChange={(e) => setTargetReturn(parseFloat(e.target.value) || 0)}
                    aria-label="Target return percentage"
                    className="w-14 bg-background border border-border rounded text-center text-xs py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    dir="ltr"
                  />
                </div>
              </div>
              <p className="text-3xl font-bold font-mono tabular-nums text-primary" dir="ltr">
                ${reverseEntryPrice.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                {t("dcf.targetingReturn", { target: targetReturn })}
              </p>
            </div>
          </div>

          {/* 5-Year Trajectory LineChart */}
          <div className="bg-secondary/20 border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
                5-Year Value & FCF Expansion Path
              </span>
              <span className="text-xs font-mono text-primary font-semibold">
                Terminal Exit Price: ${year5Price.toFixed(2)}
              </span>
            </div>

            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.6} />
                  <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis
                    yAxisId="left"
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickFormatter={(v) => `$${v}B`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "0.5rem",
                      color: "hsl(var(--popover-foreground))",
                      fontFamily: "monospace",
                      fontSize: "12px",
                    }}
                  />
                  <ReferenceLine y={currentPrice} yAxisId="left" stroke="hsl(var(--primary))" strokeDasharray="4 4" label={{ value: "Current Price", fill: "hsl(var(--primary))", fontSize: 10, position: "insideBottomLeft" }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="price"
                    name="Target Stock Price"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ fill: "hsl(var(--primary))", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="fcf"
                    name="FCF ($B)"
                    stroke="hsl(var(--chart-positive))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--chart-positive))", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DCFWidget;
