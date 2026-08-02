import type { SectorHeatmapCell, SectorHeatmapResponse } from "@shared/api";
import { useI18n } from "@/lib/i18n";

interface SectorHeatsheetProps {
  heatmap: SectorHeatmapResponse | null | undefined;
  /** days param echoed back so loading copy can reflect the requested range. */
  days: number;
  isLoading?: boolean;
}

/**
 * Color a daily-move cell. Intensity ramps from 0 at `|pct| = 0` to 1 at
 * `|pct| = 3%` then clamps — three-percent daily moves are rare outside
 * earnings so the saturation feels natural. Null means "no data"; we
 * surface a muted grey so the row visually reads as incomplete.
 *
 * Returns a `background-color` string consumed inline by the cell <div>.
 */
function cellColor(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return "rgba(71, 85, 105, 0.25)"; // slate-600/25
  const intensity = Math.min(1, Math.abs(pct) / 3);
  // alpha range 0.12 → 0.45 keeps typographic contrast over the tint.
  const alpha = 0.12 + intensity * 0.33;
  return pct >= 0
    ? `rgba(16, 185, 129, ${alpha.toFixed(3)})` // emerald-500
    : `rgba(239, 68, 68, ${alpha.toFixed(3)})`; // red-500
}

/** Pick the readable text color given a tinted background: white for saturated fills, slate-300 for null data. */
function cellTextClass(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return "text-slate-500";
  // Above ~25% alpha (>|0.8| normalized) the dark text starts to wash out;
  // white pops better against the saturated tint in those cases.
  const saturated = Math.min(1, Math.abs(pct) / 3) > 0.55;
  return saturated ? "text-white" : pct >= 0 ? "text-emerald-200" : "text-red-200";
}

/**
 * Format a single-day % as a compact sign-prefixed number. Drops the decimal
 * when zero so `0.00%` reads as `0%` in the heatmap where every pixel
 * matters. Used by cells, the row rollup, and any other small-format surface.
 */
function fmtPct(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return "";
  const rounded = pct.toFixed(2);
  return pct >= 0 ? `+${rounded}%` : `${rounded}%`;
}

/**
 * Render a Date header cell — short weekday + day-of-month, locale-aware
 * so Hebrew gets RTL-correct ordering and the right weekday glyph.
 */
function dayHeader(date: string, lang: string, isPartial: boolean): string {
  // `en-US` and `he-IL` both produce "Mon 17" / "ב' 17" style; en is short,
  // he narrow ('א׳, ב׳, ג׳, ד׳, ה׳, ו׳, ש׳') is what Hebrew readers expect.
  const locale = lang === "he" ? "he-IL" : "en-US";
  try {
    const d = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return date;
    const weekday = d.toLocaleDateString(locale, { weekday: "narrow", timeZone: "UTC" });
    const day = d.toLocaleDateString(locale, { day: "numeric", timeZone: "UTC" });
    return `${weekday} ${day}`;
  } catch {
    return date;
  }
}

/**
 * Bloomberg-style sector × 5-day columnar heatmap. Renders nothing when the
 * server returned zero rows AND there's nothing loading — letting callers
 * hide the strip entirely (avoids an empty placeholder stealing vertical
 * space inside the Insights page chrome).
 *
 * Layout:
 *   ┌─────────────┬──────┬──────┬──────┬──────┬──────┬──────┐
 *   │ Sector      │ d-4  │ d-3  │ d-2  │ d-1  │ d0 ⚠│ 5-day Σ│
 *   ├─────────────┼──────┼──────┼──────┼──────┼──────┼──────┤
 *   │ Technology  │+0.34 │+1.20 │-0.05 │-1.83 │+0.97 │+0.60%│
 *   │ Healthcare  │-0.21 │+0.55 │+0.89 │+0.40 │+0.12 │+1.74%│
 *   └─────────────┴──────┴──────┴──────┴──────┴──────┴──────┘
 *
 * Hover each cell for the "n/m priced · avg X.XX%" tooltip in the active
 * language (uses the `insights.heatsheet.cellMeta_*` ICU plural key).
 */
export function SectorHeatsheet({ heatmap, days, isLoading }: SectorHeatsheetProps) {
  const { t, lang } = useI18n();
  const hasRows = !!heatmap && heatmap.rows.length > 0;
  const showSkeleton = isLoading && !hasRows;

  if (!hasRows && !showSkeleton) return null;

  return (
    <div className="bg-slate-800/40 border-b border-slate-700 px-8 py-5">
      {/* Header row: title, footer caption, partial-day badge */}
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
          {t("insights.heatsheet.title")}
        </h2>
        {hasRows && (
          <span className="text-[10px] text-slate-500 uppercase tracking-wide" dir="ltr">
            {t("insights.heatsheet.foot", { rows: heatmap!.rows.length, days })}
          </span>
        )}
        {isLoading && hasRows && (
          <span className="text-[10px] text-amber-300 ml-auto">
            {t("insights.heatsheet.loading", { days })}
          </span>
        )}
      </div>

      {showSkeleton ? (
        // Match the loaded state's row count + grid template to prevent
        // layout-jump when the data lands. ~6 placeholder rows × 7 columns
        // keeps the shimmer block at the same vertical cadence as a
        // typically-populated heatmap, so when sectors arrive the strip
        // doesn't snap to a taller box.
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `minmax(140px, 1.4fr) repeat(${days}, minmax(0, 1fr)) 88px` }}
        >
          {Array.from({ length: 6 * (days + 2) }).map((_, i) => (
            <div
              key={`row-skel-${i}`}
              className="h-7 bg-slate-700/40 rounded animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `1fr repeat(${days}, minmax(0, 1fr)) 88px` }}
        >
          {/* Day header row */}
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-1 self-end">
            {/* leftmost column header — empty for the sector-label column */}
          </div>
          {heatmap!.days.map((date, idx) => {
            // Derive isPartial from the first row's cell for this column index,
            // preserving the server's suppression of partial status for weekend landings.
            const isPartial = heatmap!.rows.length > 0 && heatmap!.rows[0].cells[idx]?.isPartial === true;
            return (
              <div
                key={date}
                className="text-[10px] uppercase tracking-wider text-slate-500 px-1 text-end"
                title={isPartial ? t("insights.heatsheet.partialTitle") : undefined}
                dir="ltr"
              >
                <span>{dayHeader(date, lang, isPartial)}</span>
                {isPartial && (
                  <span className="block text-[9px] text-amber-400/80 normal-case tracking-normal">
                    {t("insights.heatsheet.partialHit")}
                  </span>
                )}
              </div>
            );
          })}
          <div
            className="text-[10px] uppercase tracking-wider text-slate-500 px-1 text-end"
            dir="ltr"
          >
            {t("insights.heatsheet.weekNetLabel")}
          </div>

          {/* Sector rows */}
          {heatmap!.rows.map((row) => {
            const week = fmtPct(row.weekNet);
            return (
              <HeatsheetRow key={row.sector} row={row} week={week} t={t} />
            );
          })}
        </div>
      )}

      {/* Footer disclosure when there are untagged rows that the heatmap
          couldn't attribute to any sector — keeps the denominator honest
          (same transparency as the previous single-column Spotlight). */}
      {hasRows && heatmap!.untagged.length > 0 && (
        <div className="text-[10px] text-slate-500 mt-2 uppercase tracking-wide">
          <span dir="ltr">{heatmap!.untagged.length}</span>{" "}
          {t("insights.heatsheet.untaggedSymbols", {
            count: heatmap!.untagged.length,
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Internal: a single sector row. Split out so the column layout /
 * responsiveness concerns live in one place and React's `<key>` system
 * can re-render row entries efficiently on prop change.
 */
function HeatsheetRow({
  row,
  week,
  t,
}: {
  row: SectorHeatmapResponse["rows"][number];
  week: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <>
      {/* Sector name + universe count tooltip */}
      <div
        className="text-sm font-medium text-foreground px-1 self-center truncate"
        title={`${row.sector} · ${t("insights.heatsheet.symbolCount", {
          count: row.universeCount,
        })}`}
      >
        {row.sector}
      </div>
      {row.cells.map((cell) => (
        <HeatsheetCell key={`${row.sector}-${cell.date}`} cell={cell} sector={row.sector} t={t} />
      ))}
      <div
        className={`text-sm font-bold text-end px-1 self-center ${
          row.weekNet === null
            ? "text-slate-500"
            : row.weekNet >= 0
              ? "text-emerald-300"
              : "text-red-300"
        }`}
        dir="ltr"
        title={row.weekNet === null ? t("insights.heatsheet.weekNetNoData") : week}
      >
        {row.weekNet === null ? t("insights.heatsheet.cellEmpty") : week}
      </div>
    </>
  );
}

/**
 * Internal: a single cell. Background-color via inline `style` rather than
 * dynamic Tailwind classes — Tailwind can't extract classnames from
 * computed strings (its JIT expects literal safelist matches), so
 * computing the rgba in JS keeps the build deterministic.
 */
function HeatsheetCell({
  cell,
  sector,
  t,
}: {
  cell: SectorHeatmapCell;
  sector: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const pctText = fmtPct(cell.movePct);
  const tooltip =
    cell.movePct === null || cell.movePct === undefined || !Number.isFinite(cell.movePct)
      ? t("insights.spotlight.empty")
      : t("insights.heatsheet.cellMeta", {
          priced: cell.withPrice,
          total: cell.total,
          pct: pctText,
        });
  return (
    <div
      className={`text-[11px] font-semibold text-end px-1.5 py-1.5 rounded transition-colors cursor-default ${cellTextClass(cell.movePct)}`}
      style={{ backgroundColor: cellColor(cell.movePct) }}
      title={`${sector} · ${cell.date}\n${tooltip}`}
      dir="ltr"
      aria-label={`${sector} ${cell.date} ${pctText || "no data"}`}
    >
      {cell.movePct === null || !Number.isFinite(cell.movePct)
        ? t("insights.heatsheet.cellEmpty")
        : pctText}
      {cell.isPartial && cell.movePct !== null && (
        <span className="block text-[9px] font-normal opacity-70">~</span>
      )}
    </div>
  );
}
