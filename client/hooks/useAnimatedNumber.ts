import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Ease-out cubic curve: starts fast and decelerates toward the end.
 * Progress is clamped to [0, 1]; returns a value in [0, 1].
 */
export function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, progress)), 3);
}

/**
 * Value of a count-up animation at `elapsed` ms into a `duration` ms
 * animation from `from` to `to`. Pure — drives `useAnimatedNumber` and is
 * unit-tested directly (the project's vitest is node-only, so effects can't
 * run in specs, but this math is the interesting part anyway).
 */
export function animatedValue(
  from: number,
  to: number,
  elapsed: number,
  duration: number,
): number {
  if (duration <= 0 || elapsed >= duration) return to;
  return from + (to - from) * easeOutCubic(elapsed / duration);
}

/**
 * Whether the count-up should run at all. `false` when the user prefers
 * reduced motion (jump straight to the target) or when there is nothing to
 * animate (`from === to`) — in both cases the displayed value lands on the
 * target in a single render.
 */
export function shouldAnimate(
  from: number,
  to: number,
  reduceMotion: boolean,
): boolean {
  return !reduceMotion && from !== to;
}

/**
 * Counts a number up (or down) when `target` changes to a finite value,
 * animating from the previous displayed value over `duration` ms with an
 * ease-out cubic curve. Returns `null` while no finite target has been
 * animated yet, so callers can render a "—" placeholder.
 *
 * Behavior notes:
 * - `target === null/undefined/NaN` resets the animation source to 0 and
 *   returns `null` — a later finite value then counts up from zero instead
 *   of gliding from a stale previous ticker's number.
 * - When the OS prefers reduced motion (`usePrefersReducedMotion`), the
 *   count-up is skipped entirely and the value jumps straight to `target`.
 * - Uses `requestAnimationFrame` timestamps (same time base as
 *   `performance.now()`), and cleans up its frame on unmount/change.
 */
export function useAnimatedNumber(
  target: number | null | undefined,
  duration: number | undefined = 600,
): number | null {
  const [display, setDisplay] = useState<number | null>(null);
  const currentRef = useRef<number>(0);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (target == null || !Number.isFinite(target)) {
      currentRef.current = 0;
      setDisplay(null);
      return;
    }

    const from = currentRef.current;
    if (!shouldAnimate(from, target, reduceMotion)) {
      // Reduced-motion preference (or a no-op count) — land on the target
      // in one render instead of running animation frames.
      currentRef.current = target;
      setDisplay(target);
      return;
    }

    let cancelled = false;
    let frame: number | undefined;
    const start = performance.now();

    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = now - start;
      const value = animatedValue(from, target, elapsed, duration);
      currentRef.current = value;
      setDisplay(value);
      if (elapsed < duration) {
        frame = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
        currentRef.current = target;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [target, duration, reduceMotion]);

  return display;
}
