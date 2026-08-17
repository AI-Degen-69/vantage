export type BarDirection = "positive" | "negative" | "neutral";

/** Return a direction only for real numeric values; missing values stay neutral. */
export function barDirection(value: unknown): BarDirection {
  if (typeof value !== "number" || !Number.isFinite(value)) return "neutral";
  if (value < 0) return "negative";
  if (value > 0) return "positive";
  return "neutral";
}

export function barGradientId(metricId: string, value: unknown): string {
  const direction = barDirection(value);
  return direction === "negative"
    ? `colorValue-negative-${metricId}`
    : direction === "positive"
      ? `colorValue-positive-${metricId}`
      : `colorValue-neutral-${metricId}`;
}

export function barStroke(value: unknown): string {
  switch (barDirection(value)) {
    case "negative":
      return "hsl(6 80% 62%)";
    case "positive":
      return "hsl(155 70% 58%)";
    default:
      return "hsl(220 10% 60%)";
  }
}

/**
 * Summarise how much of a requested chart window has a real numeric value.
 * Null/locked periods are deliberately counted as unavailable rather than
 * being allowed to silently turn into empty chart space.
 */
export function splitSparklineValues<T extends { value: unknown }>(rows: readonly T[]) {
  return rows.map((row) => {
    const value = typeof row.value === "number" && Number.isFinite(row.value) ? row.value : null;
    return {
      ...row,
      positiveValue: value === null ? null : Math.max(value, 0),
      negativeValue: value === null ? null : Math.min(value, 0),
    };
  });
}

export function getChartAvailability(values: unknown[], expectedCount: number) {
  const availableCount = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  ).length;
  const totalCount = Math.max(Math.max(0, expectedCount), values.length);
  const lockedCount = Math.max(totalCount - availableCount, 0);

  return {
    availableCount,
    lockedCount,
    totalCount,
    hasUnavailable: lockedCount > 0,
    fractionUnavailable: totalCount > 0 ? lockedCount / totalCount : 0,
  } as const;
}

/**
 * Compute a readable numeric domain that always includes zero without
 * letting a one-sided series make the zero baseline hug the plot edge.
 *
 * A little breathing room is intentionally reserved on the opposite side of
 * zero: negative-only series get 15% positive headroom, and positive-only
 * series get 15% negative headroom. This keeps zero visible as a boundary,
 * not as the chart's top/bottom border, while preserving the data's scale.
 */
function niceStep(range: number, targetTicks = 5): number {
  const raw = range / Math.max(targetTicks - 1, 1);
  const power = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / power;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * power;
}

function floorToStep(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

function ceilToStep(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

export function calculateChartDomain(values: unknown[]): [number, number] {
  const finiteValues = values
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (finiteValues.length === 0) return [-1, 1];

  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  if (min === 0 && max === 0) return [-1, 1];

  const rawRange = Math.max(max - min, Math.abs(min), Math.abs(max), 1);

  if (max <= 0) {
    // Use the series magnitude for rounding so a -4.6 bar becomes roughly
    // [-5, 1], not [-10, 10]. Zero remains an explicit visual boundary with
    // a small positive band, rather than the top edge of the plot.
    const step = 10 ** Math.floor(Math.log10(Math.max(Math.abs(min), 1)));
    const headroom = Math.max(Math.abs(min) * 0.15, step * 0.5);
    return [floorToStep(min - step * 0.05, step), ceilToStep(headroom, step)];
  }

  if (min >= 0) {
    const step = 10 ** Math.floor(Math.log10(Math.max(max, 1)));
    const headroom = Math.max(max * 0.15, step * 0.5);
    return [floorToStep(-headroom, step), ceilToStep(max + step * 0.05, step)];
  }

  const step = niceStep(rawRange * 1.15);
  const padding = step * 0.15;
  return [floorToStep(min - padding, step), ceilToStep(max + padding, step)];
}
