import type { SectorHeatmapCell, SectorHeatmapResponse } from "@shared/api";
import { useI18n, translateSector } from "@/lib/i18n";
import { useYahooChartDown } from "@/hooks/useStockData";

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
  if (pct === null || !Number.isFinite(pct)) return "hsl(250 20% 16% / 0.5)"; // Graticule
  const intensity = Math.min(1, Math.abs(pct) / 3);

  // Modern slightly muted colors (Green & Red)
  const alpha = 0.2 + intensity * 0.6;
  return pct >= 0
    ? `hsl(155 55% 50% / ${alpha.toFixed(3)})` // Aurora Green
    : `hsl(6 70% 58% / ${alpha.toFixed(3)})`; // Ember Red
}

/** Pick the readable text color given a tinted background: white for saturated fills, muted for null data. */
function cellTextClass(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return "text-muted-foreground";
  // Above ~25% alpha (>|0.8| normalized) the dark text starts to wash out;
  // white pops better against the saturated tint in those cases.
  const saturated = Math.min(1, Math.abs(pct) / 3) > 0.55;
  return saturated
    ? "text-white"
    : pct >= 0
      ? "text-chart-positive"
      : "text-chart-negative";
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
    const weekday = d.toLocaleDateString(locale, {
      weekday: "narrow",
      timeZone: "UTC",
    });
    const day = d.toLocaleDateString(locale, {
      day: "numeric",
      timeZone: "UTC",
    });
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
export function SectorHeatsheet({
  heatmap,
  days,
  isLoading,
}: SectorHeatsheetProps) {
  const { t, lang } = useI18n();
  // Heatmap cells are computed server-side from per-ticker chart closes —
  // when Yahoo chart history is down, badge [MOCK] so stale aggregates
  // (possibly still cached) can't read as live.
  const yahooChartDown = useYahooChartDown();
  const hasRows = !!heatmap && heatmap.rows.length > 0;
  const showSkeleton = isLoading && !hasRows;

  if (!hasRows && !showSkeleton) return null;

  return (
    <div className="bg-transparent px-6 py-5 h-full flex flex-col justify-center">
      {/* Header row: title, footer caption, partial-day badge */}
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
          {t("insights.heatsheet.title")}
        </h2>
        {hasRows && (
          <span
            className="text-xs text-muted-foreground uppercase tracking-wide"
            dir="ltr"
          >
            {t("insights.heatsheet.foot", { rows: heatmap!.rows.length, days })}
          </span>
        )}
        {yahooChartDown && hasRows && (
          <span
            className="text-xs font-medium uppercase tracking-wide px-2 py-0.5 rounded text-yellow-400 bg-yellow-500/10 ms-auto"
            title={t("providerHealth.chartDownHint")}
          >
            [MOCK]
          </span>
        )}
        {isLoading && hasRows && (
          <span className="text-xs text-primary ms-auto">
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
          style={{
            gridTemplateColumns: `minmax(140px, 1.4fr) repeat(${days}, minmax(0, 1fr)) 88px`,
          }}
        >
          {Array.from({ length: 6 * (days + 2) }).map((_, i) => (
            <div
              key={`row-skel-${i}`}
              className="h-7 bg-muted/60 rounded animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: `1fr repeat(${days}, minmax(0, 1fr)) 88px`,
          }}
        >
          {/* Day header row */}
          <div className="text-xs uppercase tracking-wider text-muted-foreground px-1 self-end">
            {/* leftmost column header — empty for the sector-label column */}
          </div>
          {heatmap!.days.map((date, idx, arr) => {
            // Derive isPartial from the first row's cell for this column index,
            // preserving the server's suppression of partial status for weekend landings.
            const isPartial =
              heatmap!.rows.length > 0 &&
              heatmap!.rows[0].cells[idx]?.isPartial === true;
            const isToday = idx === arr.length - 1;
            return (
              <div
                key={date}
                className={`text-xs uppercase tracking-wider text-muted-foreground font-semibold px-1 text-end ${!isToday ? 'opacity-60' : ''}`}
                title={
                  isPartial ? t("insights.heatsheet.partialTitle") : undefined
                }
                dir="ltr"
              >
                <span>{dayHeader(date, lang, isPartial)}</span>
                {isPartial && (
                  <span className="block text-xs text-primary/80 normal-case tracking-normal">
                    {t("insights.heatsheet.partialHit")}
                  </span>
                )}
              </div>
            );
          })}
          <div
            className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-1 text-end"
            dir="ltr"
          >
            {t("insights.heatsheet.weekNetLabel")}
          </div>

          {/* Sector rows */}
          {heatmap!.rows.map((row) => {
            const week = fmtPct(row.weekNet);
            // Sector label resolves through the active language's dictionary
            // (HE locale gets strings like "טכנולוגי", EN gets "Technology").
            // Falls back to raw English on unrecognized FMP sectors so a
            // brand-new sector never goes blank in the heatmap.
            const sectorLabel = translateSector(t, row.sector);
            return (
              <HeatsheetRow
                key={row.sector}
                row={row}
                week={week}
                t={t}
                sectorLabel={sectorLabel}
              />
            );
          })}
        </div>
      )}

      {/* Footer disclosure when there are untagged rows that the heatmap
          couldn't attribute to any sector — keeps the denominator honest
          (same transparency as the previous single-column Spotlight). */}
      {hasRows && heatmap!.untagged.length > 0 && (
        <div className="text-xs text-muted-foreground mt-2 uppercase tracking-wide">
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
 *
 * `sectorLabel` is the localized display string resolved at the call site
 * (HE locale gets translated Hebrew, EN gets canonical English). The raw
 * `row.sector` is kept for the underlying cache key / React `<key>` so
 * toggling language doesn't remount cells.
 */
function HeatsheetRow({
  row,
  week,
  t,
  sectorLabel,
}: {
  row: SectorHeatmapResponse["rows"][number];
  week: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  sectorLabel: string;
}) {
  return (
    <>
      {/* Sector name + universe count tooltip */}
      <div
        className="text-[14px] font-bold text-foreground px-3 self-center truncate drop-shadow-sm"
        title={`${sectorLabel} · ${t("insights.heatsheet.symbolCount", {
          count: row.universeCount,
        })}`}
      >
        {sectorLabel}
      </div>
      {row.cells.map((cell, idx, arr) => (
        <HeatsheetCell
          key={`${row.sector}-${cell.date}`}
          cell={cell}
          sectorLabel={sectorLabel}
          t={t}
          isToday={idx === arr.length - 1}
        />
      ))}
      <div
        className={`text-sm font-bold font-mono tabular-nums text-center px-2 py-1.5 self-center rounded-md bg-muted/20 border border-border/50 ${
          row.weekNet === null
            ? "text-muted-foreground"
            : row.weekNet >= 0
              ? "text-chart-positive"
              : "text-chart-negative"
        }`}
        dir="ltr"
        title={
          row.weekNet === null ? t("insights.heatsheet.weekNetNoData") : week
        }
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
 *
 * `sectorLabel` arrives already-resolved from the parent map so language
 * toggling doesn't cause a full cell remount (the visible number doesn't
 * change, only the surrounding tooltip text does).
 */
function HeatsheetCell({
  cell,
  sectorLabel,
  t,
  isToday,
}: {
  cell: SectorHeatmapCell;
  sectorLabel: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  isToday: boolean;
}) {
  const pctText = fmtPct(cell.movePct);
  const tooltip =
    cell.movePct === null ||
    cell.movePct === undefined ||
    !Number.isFinite(cell.movePct)
      ? t("insights.spotlight.empty")
      : t("insights.heatsheet.cellMeta", {
          priced: cell.withPrice,
          total: cell.total,
          pct: pctText,
        });
  return (
    <div
      className={`text-xs font-mono font-bold flex items-center justify-center text-center px-2 py-2 rounded-md transition-all cursor-default drop-shadow-sm ${cellTextClass(cell.movePct)} ${!isToday ? 'opacity-60 hover:opacity-100' : 'hover:brightness-125'}`}
      style={{ backgroundColor: cellColor(cell.movePct) }}
      title={`${sectorLabel} · ${cell.date}\n${tooltip}`}
      dir="ltr"
      aria-label={`${sectorLabel} ${cell.date} ${pctText || "no data"}`}
    >
      {cell.movePct === null || !Number.isFinite(cell.movePct)
        ? t("insights.heatsheet.cellEmpty")
        : pctText}
      {cell.isPartial && cell.movePct !== null && (
        <span className="block text-xs font-normal opacity-70">~</span>
      )}
    </div>
  );
}
