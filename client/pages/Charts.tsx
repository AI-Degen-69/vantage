import { useState, useMemo, useCallback } from "react";
import {
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
} from "recharts";
import {
  Search,
  Loader2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useChartHistory } from "@/hooks/useStockData";

// ── SMA Calculation ──────────────────────────────────────────────────────────

function computeSMA(
  data: Array<{ close: number }>,
  period: number
): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += data[j].close;
      }
      result.push(sum / period);
    }
  }
  return result;
}

// ── Timeframe Config ─────────────────────────────────────────────────────────

type Period = "1d" | "5d" | "1mo" | "3mo" | "1y" | "5y";

const PERIODS: { value: Period; label: string }[] = [
  { value: "1d", label: "1D" },
  { value: "5d", label: "5D" },
  { value: "1mo", label: "1M" },
  { value: "3mo", label: "3M" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
];

// ── Color Constants ──────────────────────────────────────────────────────────

const COLORS = {
  grid: "#334155",
  text: "#94a3b8",
  priceLine: "#3b82f6",
  priceGradient: "#3b82f6",
  volumeBar: "#3b82f680",
  sma20: "#f59e0b",
  sma50: "#10b981",
  sma200: "#ef4444",
  tooltipBg: "#1e293b",
  tooltipBorder: "#334155",
};

// ── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div
      style={{
        backgroundColor: COLORS.tooltipBg,
        border: `1px solid ${COLORS.tooltipBorder}`,
        borderRadius: "8px",
        padding: "12px 14px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
      }}
    >
      <p style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px", fontWeight: 500 }}>
        {label}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        {data.close != null && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>Close</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#f8fafc" }}>
              ${data.close.toFixed(2)}
            </span>
          </div>
        )}
        {data.open != null && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>Open</span>
            <span style={{ fontSize: "12px", color: "#f8fafc" }}>
              ${data.open.toFixed(2)}
            </span>
          </div>
        )}
        {data.high != null && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>High</span>
            <span style={{ fontSize: "12px", color: "#f8fafc" }}>
              ${data.high.toFixed(2)}
            </span>
          </div>
        )}
        {data.low != null && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>Low</span>
            <span style={{ fontSize: "12px", color: "#f8fafc" }}>
              ${data.low.toFixed(2)}
            </span>
          </div>
        )}
        {data.volume != null && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>Volume</span>
            <span style={{ fontSize: "12px", color: "#f8fafc" }}>
              {data.volume >= 1e6
                ? `${(data.volume / 1e6).toFixed(1)}M`
                : data.volume >= 1e3
                ? `${(data.volume / 1e3).toFixed(1)}K`
                : data.volume}
            </span>
          </div>
        )}
        {data.sma20 != null && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
            <span style={{ fontSize: "11px", color: "#f59e0b" }}>SMA 20</span>
            <span style={{ fontSize: "11px", color: "#f8fafc" }}>
              ${data.sma20.toFixed(2)}
            </span>
          </div>
        )}
        {data.sma50 != null && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
            <span style={{ fontSize: "11px", color: "#10b981" }}>SMA 50</span>
            <span style={{ fontSize: "11px", color: "#f8fafc" }}>
              ${data.sma50.toFixed(2)}
            </span>
          </div>
        )}
        {data.sma200 != null && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
            <span style={{ fontSize: "11px", color: "#ef4444" }}>SMA 200</span>
            <span style={{ fontSize: "11px", color: "#f8fafc" }}>
              ${data.sma200.toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Volume Tooltip ───────────────────────────────────────────────────────────

function VolumeTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div
      style={{
        backgroundColor: COLORS.tooltipBg,
        border: `1px solid ${COLORS.tooltipBorder}`,
        borderRadius: "8px",
        padding: "8px 12px",
      }}
    >
      <p style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>{label}</p>
      <p style={{ fontSize: "12px", fontWeight: 600, color: "#f8fafc" }}>
        Vol:{" "}
        {data.volume >= 1e6
          ? `${(data.volume / 1e6).toFixed(1)}M`
          : data.volume >= 1e3
          ? `${(data.volume / 1e3).toFixed(1)}K`
          : data.volume}
      </p>
    </div>
  );
}

// ── Format Date for Axis ─────────────────────────────────────────────────────

function formatAxisDate(dateStr: string, period: Period): string {
  if (period === "1d" || period === "5d") {
    // For intraday, just show the time portion
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }
  // For daily/weekly, show date
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function ChartsPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [inputValue, setInputValue] = useState("AAPL");
  const [period, setPeriod] = useState<Period>("1y");

  const { data, isLoading, isError } = useChartHistory(symbol, period);

  // Enrich history with SMA data
  const chartData = useMemo(() => {
    if (!data?.history || data.history.length === 0) return [];

    const closes = data.history.map((d) => d.close);
    const sma20 = computeSMA(closes.map((c) => ({ close: c })), 20);
    const sma50 = computeSMA(closes.map((c) => ({ close: c })), 50);
    const sma200 = computeSMA(closes.map((c) => ({ close: c })), 200);

    return data.history.map((d, i) => ({
      ...d,
      sma20: sma20[i],
      sma50: sma50[i],
      sma200: sma200[i],
    }));
  }, [data]);

  // Domain for price axis
  const priceDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];
    let min = Infinity;
    let max = -Infinity;
    for (const d of chartData) {
      if (d.low != null && d.low < min) min = d.low;
      if (d.high != null && d.high > max) max = d.high;
    }
    // Show SMA lines too — they might extend beyond price range
    for (const d of chartData) {
      if (d.sma20 != null && d.sma20 > max) max = d.sma20;
      if (d.sma50 != null && d.sma50 > max) max = d.sma50;
      if (d.sma200 != null && d.sma200 > max) max = d.sma200;
      if (d.sma20 != null && d.sma20 < min) min = d.sma20;
      if (d.sma50 != null && d.sma50 < min) min = d.sma50;
      if (d.sma200 != null && d.sma200 < min) min = d.sma200;
    }
    const padding = (max - min) * 0.05 || 1;
    return [min - padding, max + padding];
  }, [chartData]);

  // Volume domain
  const volumeDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 1];
    let max = 0;
    for (const d of chartData) {
      if (d.volume != null && d.volume > max) max = d.volume;
    }
    return [0, max * 1.1];
  }, [chartData]);

  const handleSearch = useCallback(() => {
    const trimmed = inputValue.trim().toUpperCase();
    if (trimmed) setSymbol(trimmed);
  }, [inputValue]);

  const currentPrice = data?.quote?.price;
  const priceChange = data?.quote?.changePercent;

  return (
    <div className="w-full h-full bg-background dark flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-800 bg-slate-900/80 flex-shrink-0">
        {/* Symbol Search */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search symbol..."
              className="w-36 bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder-slate-500 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-3 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Go
          </button>
        </div>

        {/* Price Info */}
        {currentPrice != null && (
          <div className="flex items-center gap-3 ml-4 pl-4 border-l border-slate-700">
            <div>
              <span className="text-2xl font-bold text-foreground">
                ${currentPrice.toFixed(2)}
              </span>
              {priceChange != null && (
                <span
                  className={`ml-2 text-sm font-semibold ${
                    priceChange >= 0 ? "text-chart-green" : "text-red-400"
                  }`}
                >
                  {priceChange >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5 inline mr-0.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 inline mr-0.5" />
                  )}
                  {priceChange >= 0 ? "+" : ""}
                  {priceChange.toFixed(2)}%
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              {symbol}
            </span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* SMA Legend */}
        {chartData.length > 0 && (period === "1mo" || period === "3mo" || period === "1y" || period === "5y") && (
          <div className="flex items-center gap-4 mr-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded" style={{ backgroundColor: COLORS.sma20 }} />
              <span className="text-[10px] text-slate-400 font-medium">SMA 20</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded" style={{ backgroundColor: COLORS.sma50 }} />
              <span className="text-[10px] text-slate-400 font-medium">SMA 50</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded" style={{ backgroundColor: COLORS.sma200 }} />
              <span className="text-[10px] text-slate-400 font-medium">SMA 200</span>
            </div>
          </div>
        )}

        {/* Timeframe Toggles */}
        <div className="flex bg-slate-800 rounded-lg border border-slate-700 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                period === p.value
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 p-4 min-h-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-4" />
            <p className="text-sm text-slate-400">Loading chart data...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-red-400 mb-2 text-sm font-medium">Failed to load chart data</p>
            <p className="text-xs text-slate-500">Try a different symbol or timeframe</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <TrendingUp className="w-12 h-12 text-slate-600 mb-4" />
            <p className="text-slate-400 mb-1 text-sm">No price data available</p>
            <p className="text-xs text-slate-500">Enter a valid stock symbol to see historical prices</p>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Price Chart */}
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.priceGradient} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={COLORS.priceGradient} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => formatAxisDate(val, period)}
                    stroke={COLORS.text}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={40}
                  />
                  <YAxis
                    domain={priceDomain}
                    tickFormatter={(val) => `$${val.toFixed(0)}`}
                    stroke={COLORS.text}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    orientation="right"
                    width={60}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke={COLORS.priceLine}
                    strokeWidth={2}
                    fill="url(#priceGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: COLORS.priceLine, stroke: "#0f172a", strokeWidth: 2 }}
                  />
                  {/* SMA overlays — only show for daily+ periods */}
                  {(period === "1mo" || period === "3mo" || period === "1y" || period === "5y") && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="sma20"
                        stroke={COLORS.sma20}
                        strokeWidth={1}
                        dot={false}
                        strokeDasharray="4 2"
                      />
                      <Line
                        type="monotone"
                        dataKey="sma50"
                        stroke={COLORS.sma50}
                        strokeWidth={1}
                        dot={false}
                        strokeDasharray="4 2"
                      />
                      <Line
                        type="monotone"
                        dataKey="sma200"
                        stroke={COLORS.sma200}
                        strokeWidth={1}
                        dot={false}
                        strokeDasharray="4 2"
                      />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Volume Bars */}
            <div className="h-24 flex-shrink-0 mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                  <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => formatAxisDate(val, period)}
                    stroke={COLORS.text}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={40}
                  />
                  <YAxis
                    domain={volumeDomain}
                    tickFormatter={(val) =>
                      val >= 1e6 ? `${(val / 1e6).toFixed(0)}M` : val >= 1e3 ? `${(val / 1e3).toFixed(0)}K` : `${val}`
                    }
                    stroke={COLORS.text}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    orientation="right"
                    width={60}
                  />
                  <Tooltip content={<VolumeTooltip />} />
                  <Bar
                    dataKey="volume"
                    fill={COLORS.volumeBar}
                    radius={[1, 1, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
