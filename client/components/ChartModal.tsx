import { useEffect, useMemo, useRef, useState } from "react";
import { X, Download, TrendingUp, TrendingDown, Lock, Table as TableIcon } from "lucide-react";
import TickerLogo from "@/components/TickerLogo";
import { useI18n } from "@/lib/i18n";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  LabelList,
} from "recharts";
import { FinancialMetric } from "@/lib/mockData";
import type { RevenueSegmentRow } from "@shared/api";
import { cn } from "@/lib/utils";
import {
  cagrAtYearsBack,
  detectPeriodGranularity,
  metricStatementKey,
  projectMetricSeries,
} from "@/lib/finance";
import {
  useStockFinancials,
  useStockRevenueSegmentation,
} from "@/hooks/useStockData";
import {
  barGradientId,
  barStroke,
  calculateChartDomain,
  getChartAvailability,
} from "@/lib/chartStyles";

interface ChartModalProps {
  metric: FinancialMetric;
  isOpen: boolean;
  onClose: () => void;
  ticker?: string;
  /**
   * When non-empty, the modal renders a stacked per-year segment bar chart
   * (FMP revenue-product-segmentation rows) instead of the single metric
   * series — every segment stacked per fiscal year, with a legend, segment
   * breakdown tooltip, and a per-segment table/CSV. Supplied by
   * `RevenueSegmentsCard`; absent for every other metric.
   */
  segmentRows?: RevenueSegmentRow[];
  /**
   * Segment the revenue card had focused when the user clicked Expand.
   * The modal snapshots this on the open transition and pre-applies it to
   * the filter chips so the stacked chart mirrors the card's focus
   * (every other segment hidden). `null` / undefined opens with every
   * segment visible. Ignored in the single-series (non-segment) path.
   */
  selectedSegment?: string | null;
  /**
   * Why the segment payload is unavailable for premium reasons —
   * `"rateLimited"` when FMP returned 429/403 (free-tier quota), or
   * `"unavailable"` when no FMP key was configured. When set AND the
   * modal falls back to the single-series revenue chart (segment rows
   * empty), a small banner above the chart clarifies why per-segment
   * breakdown would normally be available and isn't now. Sets the
   * visual parity with the card's locked chip strip so a user who
   * expanded the modal sees the same premium-tier explanation in both
   * places.
   */
  segmentLockedReason?: "rateLimited" | "unavailable" | null;
  /**
   * Callback that opens the placeholder /pricing modal from any
   * Upgrade link rendered beside the locked banner. Required when the
   * page wires `<PricingModal>` at the page root; left undefined in
   * Storybook / standalone previews — the Upgrade link is hidden in
   * that mode so the modal doesn't crash on a missing callback.
   */
  onUpgradeClick?: () => void;
}

type TimeframeType = "1Y" | "3Y" | "5Y";
type Granularity = "annual" | "quarter";

/**
 * Granularity toggle reads as `Quarterly | Yearly` (Q | Y). When Q is
 * active we re-fetch `/api/stock-financials?period=quarter` so each bar
 * is one FMP quarter (e.g. Q1 2025, Q2 2025, ...) and CAGR windows walk
 * back 4 / 12 / 20 rows — flipped cardinality vs. the annual path so
 * the 5Y badge means "20 quarters of growth, annualized".
 *
 * The metric passed in from `Index.tsx` is built from the annual
 * payload, so we recompute the (date, value) series from the matching
 * `useStockFinancials(ticker, { period })` response and ignore the
 * pre-built `metric.data` whenever quarter mode is on; the annual path
 * keeps `metric.data` untouched (no extra fetch, no flicker).
 */

function currentQuarterLabel(): string {
  const now = new Date();
  return `Q${Math.floor(now.getUTCMonth() / 3) + 1} ${now.getUTCFullYear()}`;
}

function previousQuarterLabel(label: string): string {
  const match = /^Q([1-4])\s+(\d{4})$/.exec(label);
  if (!match) return label;
  let quarter = Number(match[1]) - 1;
  let year = Number(match[2]);
  if (quarter < 1) {
    quarter = 4;
    year -= 1;
  }
  return `Q${quarter} ${year}`;
}

function formatMetricValue(value: number, unit: string, maxDecimals: number = 2) {
  let prefix = "";
  let suffix = "";
  if (unit === "B" || unit === "M") {
    prefix = "$";
    suffix = unit;
  } else if (unit === "%" || unit === "$") {
    if (unit === "$") prefix = "$";
    if (unit === "%") suffix = "%";
  } else {
    suffix = unit || "";
  }
  
  const formattedNum = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(value);
  
  return `${prefix}${formattedNum}${suffix}`;
}

/**
 * Distinct hue ladder for the stacked segment bars. Rotates across segments;
 * the same index → color mapping is used by the legend, tooltip, and table so
 * a segment never changes color between surfaces.
 */
const SEGMENT_PALETTE = [
  "hsl(200 60% 60%)", // Nebula Blue
  "hsl(155 55% 50%)", // Aurora Green
  "hsl(32 85% 58%)", // Ember Orange
  "hsl(265 45% 62%)", // Deep Space Violet
  "hsl(190 65% 58%)", // Glacier Cyan
  "hsl(340 55% 62%)", // Rose Pink
  "hsl(42 65% 70%)", // Starlight Gold
  "hsl(6 70% 58%)", // Ember Red
];

export default function ChartModal({
  metric,
  isOpen,
  onClose,
  ticker = "AAPL",
  segmentRows = [],
  selectedSegment = null,
  segmentLockedReason = null,
  onUpgradeClick,
}: ChartModalProps) {
  const { t } = useI18n();
  const [timeframe, setTimeframe] = useState<TimeframeType>("1Y");
  const [granularity, setGranularity] = useState<Granularity>("annual");
  const [showTable, setShowTable] = useState(false);
  // Segments the user has toggled off via the modal's filter chips. Stored
  // as names so the chart, legend, tooltip, table, and CSV all share one
  // source of truth; cleared when the modal closes.
  const [hiddenSegments, setHiddenSegments] = useState<string[]>([]);

  // The revenue card supplies annual segment rows; when non-empty the modal
  // is in segment mode regardless of the granularity toggle (quarterly rows
  // arrive from a separate fetch below). Gates both quarterly fetches so the
  // single-series path and the segment path never request data they don't
  // render.
  const hasSegmentData = segmentRows.some((r) => r.products.length > 0);

  // Quarterly fetch only kicks in when needed; the hook is still safe to
  // call unconditionally because it disables on `!ticker`, but skipping
  // the request on the default annual render keeps the FMP budget lower
  // (the free tier is already at 5-statement-rows max). In segment mode the
  // statement fetch is skipped entirely — segment quarters come from
  // `revenue-product-segmentation` instead.
  const {
    data: quarterlyStatements,
    dataUpdatedAt: quarterlyUpdatedAt,
    isLoading: quarterlyLoading,
    isError: quarterlyError,
  } = useStockFinancials(ticker, {
    period: "quarter",
    enabled: isOpen && granularity === "quarter" && !hasSegmentData,
  });
  const quarterlySource = quarterlyStatements?.sources?.income ?? quarterlyStatements?.sources?.balance ?? quarterlyStatements?.sources?.cash ?? null;

  // Quarterly segment rows (FMP `revenue-product-segmentation?period=quarter`),
  // fetched only when the modal is open, segment mode is active, and the
  // user switched the granularity toggle to quarterly. Each row is one 10-Q
  // filing's product breakdown.
  const {
    data: quarterlySegmentation,
    isLoading: quarterlySegLoading,
  } = useStockRevenueSegmentation(ticker, {
    period: "quarter",
    enabled: isOpen && granularity === "quarter" && hasSegmentData,
  });
  const quarterlySegmentRows = quarterlySegmentation?.rows ?? [];
  const segmentQuarterlyUnavailable =
    hasSegmentData &&
    granularity === "quarter" &&
    !quarterlySegLoading &&
    quarterlySegmentation != null &&
    quarterlySegmentRows.length === 0 &&
    !quarterlySegmentation.rateLimited;

  // Series used by the chart. Annual = pre-built points from Index.tsx.
  // Quarterly = freshly projected from the Q-fetch. Recomputed only when
  // the period switches or the quarterly payload lands — keeps the
  // "switching tabs doesn't refetch the same 20 bars" guarantee.
  const filteredData = useMemo(() => {
    let sliced: any[] = [];
    let expectedCount = 0;

    if (granularity === "quarter") {
      const series = metricStatementKey(metric.name)
        ? projectMetricSeries(
            metric.name,
            quarterlyStatements ?? { income: [], balance: [], cash: [] },
          )
        : [];
      // 1Y = 4Q and 3Y = 12Q. Five-year windows are intentionally not
      // offered until the provider returns enough endpoints.
      expectedCount = timeframe === "1Y" ? 4 : 12;
      sliced = series.slice(-expectedCount);
    } else {
      // Annual path: scale the 1/3-year window off the precomputed
      // `metric.data`. Five-year windows are not offered without six
      // annual endpoints.
      expectedCount = timeframe === "1Y" ? 1 : 3;
      sliced = metric.data.slice(-expectedCount);
    }

    if (sliced.length < expectedCount && (granularity === "quarter" || sliced.length > 0)) {
      const missingCount = expectedCount - sliced.length;
      const lockedPeriods = [];
      let lastDateStr = sliced[0]?.date ?? currentQuarterLabel();

      for (let i = 0; i < missingCount; i++) {
        let prevDate = `Locked - ${missingCount - i}`;
        if (granularity === "quarter") {
          prevDate = previousQuarterLabel(lastDateStr);
          lastDateStr = prevDate;
        } else {
          const m = lastDateStr.match(/FY\s+(\d{4})/);
          if (m) {
            const y = parseInt(m[1], 10) - 1;
            prevDate = `FY ${y}`;
            lastDateStr = prevDate;
          }
        }
        lockedPeriods.unshift({ date: prevDate, value: null, isLocked: true });
      }
      return [...lockedPeriods, ...sliced];
    }
    return sliced;
  }, [granularity, timeframe, metric, quarterlyStatements, quarterlyUpdatedAt]);

  // Drive live CAGR/YoY numbers off the projected series so they flip
  // when the user toggles Q ↔ Y. `detectPeriodGranularity` peeks at the
  // most-recent row's `period` label so a Q* string picks the quarterly
  // stride automatically.
  const liveGrowth = useMemo(() => {
    const statements =
      granularity === "quarter"
        ? (quarterlyStatements ?? { income: [], balance: [], cash: [] })
        : null;
    const seriesInfo = statements
      ? { granularity: detectPeriodGranularity(statements.income), statements }
      : null;
    if (!seriesInfo) {
      // Annual path — read the precomputed CAGR off the metric object
      // (Index.tsx computed it from the same ascending annual series).
      return {
        yoy: metric.yoy,
        cagr3Y: metric.cagr3Y,
        methodology: "annual",
      } as const;
    }
    // Quarter path — recompute from the quarterly rows. `cagrAtYearsBack`
    // accepts either the ascending `income` slice or the period-auto
    // granularity; both routes converge here. The `unknown`-double-cast
    // isolates a single seam that bridges `IncomeStatementRow[]
    // (which lacks an index signature) into the permissive shapes the
    // helpers need — keeps the rest of the file narrow and the cast
    // auditable in exactly one place.
    const meta = metricStatementKey(metric.name);
    if (!meta) {
      return {
        yoy: null,
        cagr3Y: null,
        methodology: "quarter",
      } as const;
    }
    const rows = [...(statements[meta.statement] as unknown as ReadonlyArray<Record<string, unknown>>)]
      .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
    const period = detectPeriodGranularity(rows);
    return {
      yoy: computeYoYFromRows(rows, meta.key),
      cagr3Y: cagrAtYearsBack(rows, meta.key, 3, period),
      methodology: period,
    } as const;
  }, [granularity, quarterlyStatements, metric, quarterlyUpdatedAt]);

  // Generate table data from the filtered chart data to keep them in sync, 
  // but reversed (newest first) and with a YoY column computed from the full series.
  const tableData = useMemo(() => {
    let fullSeries: any[] = [];
    if (granularity === "quarter") {
      fullSeries = metricStatementKey(metric.name)
        ? projectMetricSeries(
            metric.name,
            quarterlyStatements ?? { income: [], balance: [], cash: [] },
          )
        : [];
    } else {
      fullSeries = metric.data;
    }

    return [...filteredData].reverse().map((row) => {
      const idx = fullSeries.findIndex((r) => r.date === row.date);
      let yoy: number | null = null;
      const lookback = granularity === "quarter" ? 4 : 1;
      
      if (idx >= lookback && !row.isLocked) {
        const currentVal = fullSeries[idx]?.value;
        const priorVal = fullSeries[idx - lookback]?.value;
        if (typeof currentVal === "number" && typeof priorVal === "number" && priorVal !== 0) {
          yoy = ((currentVal - priorVal) / Math.abs(priorVal)) * 100;
        }
      }

      return { ...row, yoy };
    });
  }, [filteredData, granularity, metric, quarterlyStatements]);

  // ── Segment stacked-bar mode (FMP revenue-product-segmentation) ─────────
  // When the revenue card supplies segment rows, the modal swaps its single-
  // series chart for a per-period stacked bar chart. All derived data lives
  // in one memo so the chart, legend, tooltip, table, and CSV share a single
  // source of truth. Segment display order is the card's convention: the
  // most recent period's products first, then earlier periods' products.
  //
  // Granularity picks the row source: annual rows come from the card prop
  // (no extra fetch), quarterly rows from the modal's own `period=quarter`
  // fetch. While quarterly rows are still loading — or when a symbol has no
  // quarterly segment data — the source falls back to the annual rows so the
  // chart never goes blank mid-toggle.
  const segmentSource =
    granularity === "quarter" && quarterlySegmentRows.length > 0
      ? quarterlySegmentRows
      : segmentRows;

  /** Fiscal-period label for a segment row's x-axis / table / CSV slot. */
  const segmentPeriodLabel = (
    row: RevenueSegmentRow,
    granularity: Granularity,
  ): string => {
    if (granularity === "quarter") {
      const m = /^(\d{4})-(\d{2})/.exec(row.date);
      if (m) {
        return `Q${Math.floor((Number(m[2]) - 1) / 3) + 1} ${m[1]}`;
      }
      const q = /^Q([1-4])/i.exec(row.period);
      if (q) return `Q${q[1]} ${row.fiscalYear}`.trim();
    }
    return row.fiscalYear || row.date.slice(0, 4) || row.period;
  };

  const segmentModel = useMemo(() => {
    const rowsWithProducts = segmentSource.filter((r) => r.products.length > 0);
    const asc = [...rowsWithProducts].sort((a, b) =>
      granularity === "quarter"
        ? a.date < b.date
          ? -1
          : 1
        : a.fiscalYear < b.fiscalYear
          ? -1
          : 1,
    );
    const names: string[] = [];
    const seen = new Set<string>();
    for (const row of [...asc].reverse()) {
      for (const p of row.products) {
        if (!seen.has(p.name)) {
          seen.add(p.name);
          names.push(p.name);
        }
      }
    }
    const rows = asc.map((row) => {
      const point: Record<string, number | string | null> = {
        date: segmentPeriodLabel(row, granularity),
      };
      let total = 0;
      for (const name of names) {
        const product = row.products.find((p) => p.name === name);
        const value = product ? product.revenue / 1e9 : null;
        point[name] = value;
        if (value !== null) total += value;
      }
      point.total = total;
      return point;
    });
    return { names, rows };
  }, [segmentSource, granularity]);

  const isSegmentMode = segmentModel.rows.length > 0 && segmentModel.names.length > 0;
  const segmentColor = (name: string) =>
    SEGMENT_PALETTE[
      Math.max(0, segmentModel.names.indexOf(name)) % SEGMENT_PALETTE.length
    ];

  // Filtered view: segments not in `hiddenSegments`. Every surface (bars,
  // legend, tooltip, table, CSV) renders only the visible subset, so the
  // modal's chip row produces one coherent "compare these segments" view.
  const visibleNames = segmentModel.names.filter(
    (n) => !hiddenSegments.includes(n),
  );
  const toggleSegment = (name: string) =>
    setHiddenSegments((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  // Sum of the visible segments for a given point — the "Total" the tooltip
  // and axis domain read, so hiding a layer rescales the remaining stack.
  const visibleTotal = (d: Record<string, number | string | null>) =>
    visibleNames.reduce((acc, name) => {
      const v = d[name];
      return typeof v === "number" && Number.isFinite(v) ? acc + v : acc;
    }, 0);

  // Timeframe slices the stacked bars the same way the single-series path
  // slices `metric.data` (1Y = latest period, 3Y = latest three). Annual
  // counts years, quarterly counts quarters (4 / 12). FMP caps the payloads
  // at 5 annual / 8 quarterly rows, so no locked-period padding is needed
  // here — a 3Y quarterly window simply shows every fetched quarter.
  const segmentWindow = useMemo(
    () =>
      segmentModel.rows.slice(
        -(granularity === "quarter"
          ? timeframe === "1Y"
            ? 4
            : 12
          : timeframe === "1Y"
            ? 1
            : 3),
      ),
    [segmentModel.rows, timeframe, granularity],
  );

  // YoY / 3Y CAGR off the summed period totals, so the growth badges stay
  // meaningful while the bars show the mix. Annual compares consecutive
  // years; quarterly compares the same quarter one / three years back, so
  // seasonality never masquerades as growth. Null when the window is too
  // short → "-" like the other paths.
  const segmentGrowth = useMemo(() => {
    const totals = segmentModel.rows
      .map((r) => r.total)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const last = totals[totals.length - 1];
    const lookback = granularity === "quarter" ? 4 : 1;
    const prev = totals[totals.length - 1 - lookback];
    const yoy =
      last != null && prev != null && prev !== 0
        ? ((last - prev) / Math.abs(prev)) * 100
        : null;
    const yearsBack = granularity === "quarter" ? 12 : 3;
    const windowBack = totals[totals.length - 1 - yearsBack];
    const cagr3Y =
      last != null &&
      windowBack != null &&
      windowBack !== 0 &&
      totals.length > yearsBack
        ? (Math.pow(Math.abs(last) / Math.abs(windowBack), 1 / 3) - 1) * 100
        : null;
    return { yoy, cagr3Y };
  }, [segmentModel.rows, granularity]);

  // Segment table rows: newest period first, each segment column + a summed
  // Total, plus a YoY on the total — against the prior year in annual mode,
  // against the same quarter last year in quarterly mode.
  const segmentTableRows = useMemo(() => {
    const asc = segmentModel.rows;
    const lookback = granularity === "quarter" ? 4 : 1;
    return [...asc]
      .reverse()
      // Explicit return type: spreading a `Record<string, …>` into a fresh
      // object literal makes TS drop the index signature, so `row.date` /
      // `row.total` would otherwise fail below. Pin the type at the map.
      .map<Record<string, number | string | null> & { yoy: number | null }>(
        (point, i) => {
          const ascIdx = asc.length - 1 - i;
          const cur = point.total;
          const prev =
            ascIdx >= lookback ? asc[ascIdx - lookback].total : null;
          let yoy: number | null = null;
          if (
            typeof cur === "number" &&
            typeof prev === "number" &&
            prev !== 0
          ) {
            yoy = ((cur - prev) / Math.abs(prev)) * 100;
          }
          return { ...point, yoy };
        },
      );
  }, [segmentModel.rows, granularity]);

  // Reset toggle + timeframe + segment filters when the modal closes /
  // reopens so the next open starts at the default annual 1Y with every
  // segment visible. The 5Y control remains available for the chart window,
  // but no 5Y CAGR card is shown without six annual or twenty-one quarterly
  // endpoints.
  // Tracks the previous `isOpen` value so we can detect the closed → open
  // transition and snapshot the card's segment selection exactly once per
  // open (subsequent in-modal chip toggles, granularity switches, and
  // card chip changes while open must NOT clobber the user's filter).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    if (justOpened) {
      setHiddenSegments(
        selectedSegment && segmentModel.names.length > 0
          ? segmentModel.names.filter((n) => n !== selectedSegment)
          : [],
      );
    } else if (!isOpen) {
      setGranularity("annual");
      setTimeframe("1Y");
      setHiddenSegments([]);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, selectedSegment, segmentModel.names]);

  if (!isOpen) return null;

  const handleDownload = () => {
    // Segment mode exports one column per segment plus the summed total;
    // values are in B units (matching the chart axis) so the CSV reads
    // the same as the bars.
    const csv = isSegmentMode
      ? [
          [
            granularity === "quarter" ? "Period" : "Year",
            ...visibleNames,
            "Total",
          ].join(","),
          ...segmentWindow.map((d) =>
            [
              d.date,
              ...visibleNames.map((name) => d[name] ?? ""),
              visibleTotal(d) || "",
            ].join(","),
          ),
        ].join("\n")
      : [
          "Date,Value",
          ...filteredData.map((d) => `${d.date},${d.value}`),
        ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isSegmentMode
      ? "revenue_by_segment_annual.csv"
      : `${metric.name}${granularity === "quarter" ? "_quarterly" : "_annual"}.csv`;
    a.click();
  };

  const colorMap: { [key: string]: string } = {
    "chart-green": "hsl(155 55% 50%)", // Aurora Green
    "chart-orange": "hsl(32 85% 58%)",
    "chart-blue": "hsl(200 60% 60%)", // Nebula Blue
    "chart-cyan": "hsl(190 65% 58%)",
    "chart-purple": "hsl(265 45% 62%)", // Deep Space Violet
    "chart-pink": "hsl(340 55% 62%)",
  };

  const chartColor = colorMap[metric.color] || "hsl(200 60% 60%)";
  const gridColor = "hsl(250 20% 16%)"; // Graticule
  const axisColor = "hsl(220 10% 60%)"; // Dust
  const chartDomain = calculateChartDomain(filteredData.map((entry) => entry.value));
  const requestedPeriodCount = granularity === "quarter" ? (timeframe === "1Y" ? 4 : 12) : 0;
  const quarterlyAvailability = getChartAvailability(
    filteredData.map((entry) => entry.value),
    requestedPeriodCount,
  );
  const showQuarterlyMask =
    granularity === "quarter" &&
    (quarterlyError || quarterlyAvailability.hasUnavailable);
  const quarterlyMaskWidth =
    quarterlyAvailability.availableCount === 0
      ? "100%"
      : `${Math.round(quarterlyAvailability.fractionUnavailable * 100)}%`;

  const quarterlyMask = granularity === "quarter" && (quarterlyLoading || showQuarterlyMask) ? (
    <div
      className="pointer-events-none absolute inset-y-0 left-0 z-10 flex flex-col items-center justify-center gap-2 overflow-hidden border-r border-border/70 bg-background/70 px-4 text-center backdrop-blur-md"
      style={{ width: quarterlyLoading ? "100%" : quarterlyMaskWidth }}
      role="status"
      aria-live="polite"
      aria-label={
        quarterlyLoading
          ? "Loading quarterly data"
          : quarterlyAvailability.availableCount === 0
            ? "Quarterly data unavailable"
            : "Some quarterly history is unavailable"
      }
    >
      <div className="rounded-full border border-border/70 bg-card/80 p-2.5 shadow-lg">
        {quarterlyLoading ? (
          <span className="block h-5 w-5 animate-pulse rounded-full bg-muted-foreground/50" aria-hidden="true" />
        ) : (
          <Lock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {quarterlyLoading
          ? "Loading"
          : quarterlyAvailability.availableCount === 0
            ? "Unavailable"
            : "Pro history"}
      </span>
      <span className="max-w-[13rem] text-xs leading-relaxed text-muted-foreground/80">
        {quarterlyLoading
          ? "Fetching quarterly statements..."
          : quarterlyAvailability.availableCount === 0
            ? "No quarterly statements were returned for this symbol."
            : "Earlier quarterly periods are not available."}
      </span>
    </div>
  ) : null;

  const renderChart = () => {
    const commonProps = {
      data: filteredData,
      margin: { top: 20, right: 30, left: 20, bottom: 20 },
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        const data = payload[0].payload;
        if (data.isLocked) {
          return (
            <div className="bg-card border border-border p-3 rounded-panel text-xs text-foreground shadow-lg text-center rtl:text-right">
              <p className="text-muted-foreground mb-2 font-mono" dir="ltr">{label}</p>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <span className="text-lg">🔒</span>
                <span>Pro</span>
              </div>
            </div>
          );
        }
        // In case value is null but it wasn't marked locked
        if (data.value === null) return null;

        return (
          <div className="bg-card border border-border p-3 rounded-panel text-xs text-foreground shadow-lg text-left rtl:text-right">
            <p className="text-muted-foreground mb-2 font-mono" dir="ltr">
              {label}
            </p>
            <p
              className="font-bold text-lg flex gap-1 font-mono tabular-nums"
              style={{ color: chartColor }}
            >
              <span className="font-sans font-normal">{t(metric.name)}:</span>
              <span dir="ltr">
                {formatMetricValue(data.value, metric.unit, 2)}
              </span>
            </p>
          </div>
        );
      }
      return null;
    };

    // Every chart renders on the same instrument grid: a fine Graticule
    // CartesianGrid, Dust-colored axes, and a soft glow on the metric's
    // own line/bars (DESIGN.md: The Earned Glow Rule). The glow is scoped
    // to this chart via a per-metric filter id so multiple modals never
    // collide.
    const glowId = `light-curve-glow-${metric.name}`;
    const GlowFilter = () => (
      <defs>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    );

    // Segment stacked mode — the modal's raison d'être for the revenue card.
    // One bar per fiscal period (year, or quarter when the granularity
    // toggle is on) with every visible segment stacked (legend + per-
    // segment tooltip), so opening the modal from the segment card shows
    // the full product mix regardless of which chip is selected on the
    // card. The modal's own filter chips can hide segments from the stack;
    // the axis rescales to the visible total.
    if (isSegmentMode) {
      const maxTotal = Math.max(
        1,
        ...segmentWindow.map((d) => visibleTotal(d)),
      );
      const SegmentTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || payload.length === 0) return null;
        const point = payload[0].payload;
        const total = visibleTotal(point);
        return (
          <div className="bg-card border border-border p-3 rounded-panel text-xs text-foreground shadow-lg text-left rtl:text-right min-w-[11rem]">
            <p className="text-muted-foreground mb-2 font-mono" dir="ltr">
              {label}
            </p>
            {visibleNames.map((name) => {
              const value = point[name];
              if (typeof value !== "number" || !Number.isFinite(value)) {
                return null;
              }
              return (
                <div
                  key={name}
                  className="flex items-center justify-between gap-4 py-0.5"
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: segmentColor(name) }}
                    />
                    {name}
                  </span>
                  <span className="font-mono tabular-nums" dir="ltr">
                    {formatMetricValue(value, "B", 2)}
                  </span>
                </div>
              );
            })}
            {total > 0 && (
              <div className="flex items-center justify-between gap-4 mt-2 pt-2 border-t border-border">
                <span className="font-medium">{t("chart.total")}</span>
                <span
                  className="font-mono tabular-nums font-bold"
                  dir="ltr"
                >
                  {formatMetricValue(total, "B", 2)}
                </span>
              </div>
            )}
          </div>
        );
      };

      // Every segment hidden — show a nudge instead of an empty plot.
      if (visibleNames.length === 0) {
        return (
          <div className="h-[400px] w-full flex items-center justify-center text-sm text-muted-foreground">
            {t("chart.segmentNoSelection")}
          </div>
        );
      }

      // In-bar percentage labels: each visible segment gets a small white
      // `NN%` centered inside its layer of the stack. We skip labels that
      // would be unreadable — sub-4% shares, segments shorter than 14px, and
      // bars narrower than 28px (the 3Y quarterly case packs 12 columns into
      // the chart). The share is computed off `visibleTotal`, so when the
      // modal's filter chips hide a layer the remaining labels always sum to
      // 100% against the new total.
      //
      // NOTE — recharts passes `<Bar>` LabelLists the *cumulative* stack
      // value at that layer, not the layer's own slice; the share is
      // therefore read off `point[segmentName]` rather than the raw `value`
      // prop. The segment name is captured per-bar via the closure factory
      // below, so each `<Bar>`'s LabelList content correctly identifies
      // which slice it is labelling.
      const renderSegmentLabel = (segmentName: string) => {
        const SegmentShareLabel = (props: {
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          value?: number;
          index?: number;
        }) => {
          const { x, y, width, height, index } = props;
          if (
            typeof index !== "number" ||
            typeof width !== "number" ||
            typeof height !== "number" ||
            typeof x !== "number" ||
            typeof y !== "number"
          ) {
            return null;
          }
          const point = segmentWindow[index] as
            | Record<string, number | string | null>
            | undefined;
          if (!point) return null;
          const total = visibleTotal(point);
          if (total <= 0) return null;
          const slice = point[segmentName];
          if (typeof slice !== "number" || !Number.isFinite(slice)) {
            return null;
          }
          const share = (slice / total) * 100;
          if (share < 4 || height < 14 || width < 28) return null;
          const fontSize = width < 50 ? 9 : 11;
          return (
            <text
              x={x + width / 2}
              y={y + height / 2}
              fill="white"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={fontSize}
              fontWeight={600}
              style={{
                pointerEvents: "none",
                paintOrder: "stroke",
                stroke: "rgba(20, 18, 32, 0.55)",
                strokeWidth: 2,
                strokeLinejoin: "round",
              }}
            >
              {`${Math.round(share)}%`}
            </text>
          );
        };
        return <SegmentShareLabel />;
      };

      return (
        <div className="relative h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={segmentWindow}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="date"
                stroke={axisColor}
                tick={{ fontSize: 12 }}
                tickMargin={8}
              />
              <YAxis
                stroke={axisColor}
                tick={{ fontSize: 12 }}
                tickMargin={8}
                domain={[0, maxTotal * 1.15]}
                tickCount={5}
                tickFormatter={(val) => formatMetricValue(val, "B", 0)}
              />
              <Tooltip
                content={<SegmentTooltip />}
                cursor={{ fill: "hsl(250 20% 16% / 0.35)" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {visibleNames.map((name) => (
                <Bar
                  key={name}
                  dataKey={name}
                  stackId="seg"
                  fill={segmentColor(name)}
                  stroke="hsl(250 20% 14%)"
                  strokeWidth={1}
                  // No entrance animation: stacked bars render at their final
                  // geometry immediately (rAF-throttled views can otherwise
                  // freeze the grow-in at ~0%). The single-series charts keep
                  // their animation since they render fine everywhere.
                  isAnimationActive={false}
                  maxBarSize={72}
                >
                  <LabelList content={renderSegmentLabel(name)} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    switch (metric.type) {
      case "bar":
        return (
          <div className="relative h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
            <BarChart {...commonProps}>
              <defs>
                {/* Positive bars fade from a quiet baseline to their
                    strongest green at the top. Negative bars do the inverse:
                    they begin quietly at zero and finish bright red at the
                    bottom. Cells select the correct direction per datum. */}
                <linearGradient
                  id={`colorValue-positive-${metric.name}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="hsl(155 70% 58%)" stopOpacity={1} />
                  <stop offset="100%" stopColor="hsl(155 55% 38%)" stopOpacity={0.3} />
                </linearGradient>
                <linearGradient
                  id={`colorValue-negative-${metric.name}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="hsl(6 55% 38%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(6 80% 62%)" stopOpacity={1} />
                </linearGradient>
                <linearGradient
                  id={`colorValue-neutral-${metric.name}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="hsl(220 10% 60%)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="hsl(220 10% 60%)" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="date"
                stroke={axisColor}
                tick={{ fontSize: 12 }}
                tickMargin={8}
              />
              <YAxis
                stroke={axisColor}
                tick={{ fontSize: 12 }}
                tickMargin={8}
                domain={chartDomain}
                allowDataOverflow={false}
                tickCount={5}
                tickFormatter={(val) => formatMetricValue(val, metric.unit, 0)}
              />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Bar
                stackId="a"
                dataKey="value"
                strokeWidth={1}
                radius={[2, 2, 2, 2]}
                isAnimationActive={true}
                animationDuration={1000}
              >
                {filteredData.map((entry, index) => (
                  <Cell
                    key={`bar-cell-${index}`}
                    fill={`url(#${barGradientId(metric.name, entry.value)})`}
                    stroke={barStroke(entry.value)}
                  />
                ))}
              </Bar>
              <ReferenceLine
                y={0}
                yAxisId="0"
                stroke="hsl(220 18% 82%)"
                strokeOpacity={0.9}
                strokeWidth={2}
              />
            </BarChart>
            </ResponsiveContainer>
            {quarterlyMask}
          </div>
        );
      case "area":
        return (
          <div className="relative h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
            <AreaChart {...commonProps}>
              <defs>
                <linearGradient
                  id={`colorValue-area-${metric.name}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0.0} />
                </linearGradient>
                <GlowFilter />
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="date"
                stroke={axisColor}
                tick={{ fontSize: 12 }}
                tickMargin={8}
              />
              <YAxis
                stroke={axisColor}
                tick={{ fontSize: 12 }}
                tickMargin={8}
                domain={chartDomain}
                allowDataOverflow={false}
                tickCount={5}
                tickFormatter={(val) => formatMetricValue(val, metric.unit, 0)}
              />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                strokeWidth={1.5}
                filter={`url(#${glowId})`}
                fill={`url(#colorValue-area-${metric.name})`}
                fillOpacity={1}
                isAnimationActive={true}
                animationDuration={1000}
              />
              <ReferenceLine
                y={0}
                yAxisId="0"
                stroke="hsl(220 18% 82%)"
                strokeOpacity={0.9}
                strokeWidth={2}
              />
            </AreaChart>
            </ResponsiveContainer>
            {quarterlyMask}
          </div>
        );
      case "line":
      default:
        return (
          <div className="relative h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
            <LineChart {...commonProps}>
              <defs>
                <GlowFilter />
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="date"
                stroke={axisColor}
                tick={{ fontSize: 12 }}
                tickMargin={8}
              />
              <YAxis
                stroke={axisColor}
                tick={{ fontSize: 12 }}
                tickMargin={8}
                domain={chartDomain}
                allowDataOverflow={false}
                tickCount={5}
                tickFormatter={(val) => formatMetricValue(val, metric.unit, 0)}
              />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                dot={false}
                strokeWidth={1.5}
                filter={`url(#${glowId})`}
                isAnimationActive={true}
                animationDuration={1000}
              />
              <ReferenceLine
                y={0}
                yAxisId="0"
                stroke="hsl(220 18% 82%)"
                strokeOpacity={0.9}
                strokeWidth={2}
              />
            </LineChart>
            </ResponsiveContainer>
            {quarterlyMask}
          </div>
        );
    }
  };

  const showGrowthMetrics = timeframe !== "1Y";

  return (
    <div 
      className="fixed inset-0 bg-background/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-card rounded-panel border border-primary/20 shadow-glow w-[95vw] max-w-6xl h-[90vh] max-h-[850px] flex flex-row overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main Left Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar relative">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10 shrink-0">
            <div className="flex items-center gap-3">
              <TickerLogo ticker={ticker} size="md" />
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <span className="font-mono text-muted-foreground uppercase">{ticker}</span>
                <span className="text-muted-foreground/50">-</span>
                <span>
                  {isSegmentMode
                    ? t("metrics.revenueBySegment")
                    : t(metric.name)}
                </span>
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-[6px] transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Timeframe + Granularity selector and Download */}
          <div className="flex items-center justify-between p-6 border-b border-border bg-background/40 gap-2 flex-wrap shrink-0">
            <div
              className="flex gap-2"
              role="tablist"
              aria-label={t("chart.granularity")}
            >
              <div
                className="flex border border-border rounded-lg overflow-hidden"
                role="tablist"
                aria-label={t("chart.timeframe")}
              >
                {["1Y", "3Y"].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf as TimeframeType)}
                    className={cn(
                      "px-4 py-2 font-medium font-mono transition-all",
                      timeframe === tf
                        ? "bg-primary text-primary-foreground"
                        : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              {/* Yearly / Quarterly toggle — available for the single-series
                  charts and for the segment view alike. In segment mode the
                  quarterly rows come from `revenue-product-segmentation?
                  period=quarter` (each bar is one 10-Q filing's product
                  breakdown). */}
              <div className="flex border border-border rounded-lg overflow-hidden ms-2">
                <button
                  onClick={() => setGranularity("annual")}
                  className={cn(
                    "px-3 py-2 text-sm font-medium transition-all",
                    granularity === "annual"
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                  title={t("chart.annualHint")}
                >
                  {t("chart.yearly")}
                </button>
                <button
                  onClick={() => setGranularity("quarter")}
                  className={cn(
                    "px-3 py-2 text-sm font-medium transition-all",
                    granularity === "quarter"
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                  title={t("chart.quarterlyHint")}
                >
                  {t("chart.quarterly")}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTable(!showTable)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors text-sm font-medium",
                  showTable 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-transparent border-border hover:border-primary/40 hover:text-primary text-foreground"
                )}
              >
                <TableIcon className="w-4 h-4" />
                <span>Table View</span>
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-transparent border border-border hover:border-primary/40 hover:text-primary rounded-lg transition-colors text-foreground text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                <span>{t("chart.download")}</span>
              </button>
            </div>
          </div>

          {/* Chart */}
          <div className="p-6 shrink-0">
            {granularity === "quarter" && quarterlySource === null && quarterlyStatements && (
              <div className="mb-3 rounded-lg border border-chart-amber/30 bg-chart-amber/5 px-3 py-2 text-xs text-chart-amber">
                Quarterly statements are unavailable from both providers for this symbol.
              </div>
            )}
            {segmentQuarterlyUnavailable && (
              <div className="mb-3 rounded-lg border border-chart-amber/30 bg-chart-amber/5 px-3 py-2 text-xs text-chart-amber">
                {t("chart.segmentQuarterlyUnavailable")}
              </div>
            )}
            {/* Locked-premium fallback — surfaced when the revenue card
                falls back to the total-revenue chart because the segment
                payload is rate-limited / unavailable. Mirrors the card's
                `:lock` chip strip so the modal and the card agree about
                the premium-tier state. Hidden in segment mode (data is
                fine; the chips below suffice). */}
            {segmentLockedReason && !isSegmentMode && (
              <>
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="text-left rtl:text-right flex-1">
                    <p className="font-semibold text-foreground/80 mb-0.5">
                      {t("revenueSegments.modalBannerTitle")}
                    </p>
                    <p>
                      {segmentLockedReason === "rateLimited"
                        ? t("revenueSegments.modalBannerRateLimited")
                        : t("revenueSegments.modalBannerUnavailable")}
                    </p>
                  </div>
                  {/* Inline CTA — opens the placeholder /pricing modal
                      hosted at the page root. Hidden when no callback
                      was supplied (standalone preview / Storybook). */}
                  {onUpgradeClick && (
                    <button
                      type="button"
                      onClick={onUpgradeClick}
                      data-testid="revenue-segments-upgrade-cta"
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      {t("revenueSegments.upgradeCta")}
                      <span aria-hidden="true">→</span>
                    </button>
                  )}
                </div>
                <div
                  className="flex flex-wrap items-center gap-1.5 mb-4"
                  aria-label={t("revenueSegments.locked")}
                >
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-chart-blue/15 text-chart-blue border-chart-blue/30"
                  >
                    {t("revenueSegments.all")}
                  </button>
                  <span className="inline-flex items-center gap-1.5">
                    {/* Locked chip — same shape as the card so the
                        modal's strip mirrors the card chrome. */}
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-muted/40 text-muted-foreground border-border/40 cursor-not-allowed select-none"
                      title={
                        segmentLockedReason === "rateLimited"
                          ? t("revenueSegments.rateLimitedTooltip")
                          : t("revenueSegments.unavailableTooltip")
                      }
                    >
                      <Lock className="h-3 w-3" />
                      {t("revenueSegments.locked")}
                    </span>
                    {/* Premium pill — Starlight Gold so the gate is
                        discoverable without hovering the tooltip, just
                        like the card. Mirrors the card exactly so users
                        who saw `Premium` next to `Segments 🔒` on the
                        card see the same here when they expand. */}
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border border-primary/40 bg-primary/15 text-primary"
                      aria-label={t("revenueSegments.premiumBadge")}
                      title={
                        segmentLockedReason === "rateLimited"
                          ? t("revenueSegments.rateLimitedTooltip")
                          : t("revenueSegments.unavailableTooltip")
                      }
                      data-testid="revenue-segments-premium-badge"
                    >
                      {t("revenueSegments.premiumBadge")}
                    </span>
                  </span>
                </div>
              </>
            )}
            {/* Segment filter chips — hide / reveal individual layers in
                the stacked chart (and the tooltip, table, and CSV below).
                Independent of the card's chips: opening the modal always
                starts with every segment visible. */}
            {isSegmentMode && (
              <div
                className="flex flex-wrap items-center gap-1.5 mb-4"
                aria-label={t("metrics.revenueBySegment")}
              >
                <button
                  type="button"
                  onClick={() => setHiddenSegments([])}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors",
                    hiddenSegments.length === 0
                      ? "bg-chart-blue/15 text-chart-blue border-chart-blue/30"
                      : "bg-muted/40 text-muted-foreground border-border/40 hover:text-foreground",
                  )}
                >
                  {t("revenueSegments.all")}
                </button>
                {segmentModel.names.map((name) => {
                  const hidden = hiddenSegments.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleSegment(name)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors",
                        hidden
                          ? "bg-muted/40 text-muted-foreground/50 border-border/40 line-through decoration-muted-foreground/40"
                          : "bg-muted/40 text-foreground border-border/40 hover:text-foreground",
                      )}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: segmentColor(name) }}
                      />
                      {name}
                    </button>
                  );
                })}
              </div>
            )}
            {renderChart()}
          </div>

          {/* Growth Metrics */}
          {showGrowthMetrics && (
            <div className="border-t border-border bg-background/40 shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
                {[
                  {
                    label: t("chart.cagr3Y"),
                    value: isSegmentMode
                      ? segmentGrowth.cagr3Y
                      : liveGrowth.cagr3Y,
                    description:
                      granularity === "quarter"
                        ? t("chart.descCagr3YQuarter")
                        : t("chart.descCagr3Y"),
                  },
                  {
                    label: t("chart.yoy1Y"),
                    value: isSegmentMode ? segmentGrowth.yoy : liveGrowth.yoy,
                    description:
                      granularity === "quarter"
                        ? t("chart.descYoYQuarter")
                        : t("chart.descYoY"),
                  },
                ].map((item, idx) => {
                  const hasValue =
                    item.value !== null && item.value !== undefined;
                  const valueColor = !hasValue
                    ? "text-muted-foreground"
                    : Number(item.value) >= 0
                      ? "text-chart-positive"
                      : "text-chart-negative";
                  return (
                    <div key={idx} className="text-center group cursor-help">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                        {item.label}
                      </p>
                      <p
                        className={`text-2xl font-semibold font-mono tabular-nums ${valueColor}`}
                        dir="ltr"
                      >
                        {hasValue ? `${Number(item.value).toFixed(2)}%` : "-"}
                      </p>
                      <div className="mt-2 invisible group-hover:visible text-xs text-muted-foreground bg-card p-2 rounded-[6px] absolute z-10 w-max border border-border">
                        {item.description}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Side Data Table Panel */}
        {showTable && (
          <div className="w-80 md:w-96 border-l border-border bg-background/50 flex flex-col z-10 shrink-0">
            <div className="p-4 border-b border-border flex justify-between items-center sticky top-0 bg-background/80 backdrop-blur-md z-10 shrink-0">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <TableIcon className="w-4 h-4" />
                Table View
              </div>
              <button onClick={() => setShowTable(false)} className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {isSegmentMode ? (
                <div className="rounded-xl border border-border/50 overflow-x-auto bg-card/40 backdrop-blur-md shadow-sm">
                  <table className="w-full text-sm text-left rtl:text-right border-collapse">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-md z-10 border-b border-border/50">
                      <tr>
                        <th className="py-3 px-4 text-muted-foreground font-medium whitespace-nowrap">
                          {t("chart.period") || "Period"}
                        </th>
                        {visibleNames.map((name) => (
                          <th
                            key={name}
                            className="py-3 px-4 text-muted-foreground font-medium text-right whitespace-nowrap"
                          >
                            {name}
                          </th>
                        ))}
                        <th className="py-3 px-4 text-muted-foreground font-medium text-right whitespace-nowrap">
                          {t("chart.total")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {segmentTableRows.map((row) => (
                        <tr
                          key={String(row.date)}
                          className="hover:bg-white/5 transition-colors"
                        >
                          <td
                            className="py-3 px-4 font-mono text-foreground/80 whitespace-nowrap"
                            dir="ltr"
                          >
                            {String(row.date)}
                          </td>
                          {visibleNames.map((name) => {
                            const value = row[name];
                            const hasValue =
                              typeof value === "number" &&
                              Number.isFinite(value);
                            return (
                              <td
                                key={name}
                                className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap"
                                dir="ltr"
                              >
                                {hasValue
                                  ? formatMetricValue(
                                      value as number,
                                      "B",
                                      2,
                                    )
                                  : "-"}
                              </td>
                            );
                          })}
                          <td
                            className="py-3 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap"
                            dir="ltr"
                          >
                            {formatMetricValue(
                              visibleTotal(row) || 0,
                              "B",
                              2,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
              <div className="rounded-xl border border-border/50 overflow-hidden bg-card/40 backdrop-blur-md shadow-sm">
                <table className="w-full text-sm text-left rtl:text-right border-collapse">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-md z-10 border-b border-border/50">
                    <tr>
                      <th className="py-3 px-4 text-muted-foreground font-medium w-1/3">{t("chart.period") || "Period"}</th>
                      <th className="py-3 px-4 text-muted-foreground font-medium text-right w-1/3">{t("chart.value") || "Value"}</th>
                      <th className="py-3 px-4 text-muted-foreground font-medium text-right w-1/3">{t("chart.yoy") || "YoY Growth"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {tableData.map((row, i) => {
                      if (row.isLocked) {
                        return (
                          <tr key={`locked-${i}`} className="hover:bg-white/5 transition-colors group">
                            <td className="py-3 px-4 font-mono text-muted-foreground/60" dir="ltr">{row.date}</td>
                            <td className="py-3 px-4 text-right" colSpan={2}>
                              <div className="flex items-center justify-end gap-2 text-muted-foreground/50">
                                <Lock className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium tracking-wide uppercase">Pro</span>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      const hasValue = typeof row.value === "number";
                      const hasYoY = typeof row.yoy === "number";
                      const isPositive = hasYoY && row.yoy! > 0;
                      const isNegative = hasYoY && row.yoy! < 0;

                      return (
                        <tr key={row.date} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-mono text-foreground/80" dir="ltr">{row.date}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-foreground" dir="ltr">
                            {hasValue ? formatMetricValue(row.value, metric.unit, 2) : "-"}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums" dir="ltr">
                            {hasYoY ? (
                              <div className={`flex items-center justify-end gap-1.5 ${isPositive ? 'text-chart-positive' : isNegative ? 'text-chart-negative' : 'text-muted-foreground'}`}>
                                {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : isNegative ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                                <span>{Math.abs(row.yoy!).toFixed(2)}%</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Quarter-over-prior-quarter YoY helper. We expose it locally (not in
 * finance.ts) because it's only consumed here; adding it to finance.ts
 * would tempt future readers to use it for annual series and miss the
 * "same-quarter-prior-year" vs "consecutive-period" distinction.
 *
 * Strategy: walk the ascending series back 4 rows so the trailing-edge
 * comparison aligns the bar to the same calendar quarter (Q2 2025 vs
 * Q2 2024) — that mirrors how research desks talk about quarterly
 *
 * Q-o-Q growth, not "Q1→Q2 sequential". Returns `null` if the series is
 * too short or either endpoint is non-positive/non-finite so the modal
 * badge renders "-" instead of an integer "-" / undefined mismatch.
 */
function computeYoYFromRows(
  rows: ReadonlyArray<Record<string, unknown>>,
  key: string,
): number | null {
  if (!Array.isArray(rows) || rows.length < 5) return null;
  const last = Number(rows[rows.length - 1][key]);
  const priorYearSameQuarter = Number(rows[rows.length - 5][key]);
  if (!Number.isFinite(last) || !Number.isFinite(priorYearSameQuarter))
    return null;
  if (Math.abs(priorYearSameQuarter) === 0) return null;
  return ((last - priorYearSameQuarter) / Math.abs(priorYearSameQuarter)) * 100;
}

/**
 * Type-safe adapter around `cagrAtYearsBack` that accepts the typed
 * `IncomeStatementRow[]` from `useStockFinancials` directly. The
 * underlying helper needs to look up arbitrary `key` values off each
 * row, but the shared API's row interfaces intentionally omit an index
 * signature so TS refuses to widen them through `unknown`. The
 * `unknown`-double-cast here is the seam; it lives in exactly one place
 * so a future contributor who wants a stronger contract can tighten it
 * without hunting through caller code.
 */
function quarterCagr(
  rows: ReadonlyArray<Record<string, unknown>> | undefined,
  key: string,
  years: number,
): number | null {
  return cagrAtYearsBack(
    rows as unknown as ReadonlyArray<Record<string, unknown>>,
    key,
    years,
    "quarter",
  );
}
