import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  /** Tailwind rounded element. */
  rounded?: string;
  /** Inline styles (for height/width overrides that don't fit a className). */
  style?: CSSProperties;
}

/**
 * Lightweight placeholder block.
 * Uses the `shimmer` keyframe registered in tailwind.config.ts so we don't
 * rely on the arbitrary-value form.
 */
export function Skeleton({ className, rounded = "rounded-md", style }: SkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-slate-800/60",
        rounded,
        "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-slate-700/40 before:to-transparent",
        className
      )}
      style={style}
      aria-hidden="true"
    />
  );
}

/** Skeleton block shaped like one InsightsCard. Used inside Index.tsx grid. */
export function MetricCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col">
      <Skeleton className="h-3 w-24 mb-3" />
      <div className="flex items-end gap-3 mb-4">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-4 w-12" rounded="rounded" />
      </div>
      <Skeleton className="h-16 w-full" rounded="rounded" />
      <Skeleton className="h-3 w-full mt-3" />
    </div>
  );
}

/** Header block skeleton (price + meta row). */
export function HeaderPriceSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 mb-3">
      <Skeleton className="h-12 w-40" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-16" />
      </div>
    </div>
  );
}

/** Generic section card skeleton (used for CompanyProfile's right column). */
export function SectionCardSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="w-full" rounded="rounded" style={{ height }} />
    </div>
  );
}
