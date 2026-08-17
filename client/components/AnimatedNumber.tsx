import type { ReactNode } from "react";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";

interface AnimatedNumberProps {
  /** Numeric target; `null`/`undefined` renders the placeholder. */
  value: number | null | undefined;
  /** Formats the animated value on every frame (e.g. currency, percents). */
  format?: (value: number) => ReactNode;
  /**
   * Render-prop form of `format` — receives the animated value so callers
   * can derive layout from it (e.g. sliding a marker along a range bar).
   * Takes precedence over `format` when both are given.
   */
  children?: (value: number) => ReactNode;
  /** Shown while no finite value has been animated yet. Defaults to "—". */
  placeholder?: ReactNode;
  /** Animation duration in ms. Defaults to 600. */
  duration?: number;
}

/**
 * Counts a number up (or down) whenever `value` changes, using an ease-out
 * cubic curve — a thin, reusable wrapper around `useAnimatedNumber` that
 * renders through a caller-supplied `format`. Drop it into any badge, stat
 * tile, or header without wiring the hook yourself:
 *
 *   <AnimatedNumber value={eps} format={(v) => `$${v.toFixed(2)}`} />
 *
 * When layout must track the animated value (a marker sliding along a bar),
 * pass a function as children instead:
 *
 *   <AnimatedNumber value={price}>{(p) => <div style={{ left: `${pct(p)}%` }} />}</AnimatedNumber>
 *
 * Pair with `tabular-nums` on the surrounding element so digit widths don't
 * jitter mid-count.
 */
export default function AnimatedNumber({
  value,
  format,
  children,
  placeholder = "—",
  duration,
}: AnimatedNumberProps) {
  // Duration is forwarded untouched — the hook owns the 600ms default, so
  // the two never drift apart.
  const display = useAnimatedNumber(value, duration);
  if (display == null) return <>{placeholder}</>;
  if (children) return <>{children(display)}</>;
  return <>{format ? format(display) : display}</>;
}
