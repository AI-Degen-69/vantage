import { useState } from "react";
import { cn } from "@/lib/utils";

export type LogoSize = "sm" | "md" | "lg";
export type LogoVariant = "default" | "subtle";

interface TickerLogoProps {
  ticker: string;
  size?: LogoSize;
  variant?: LogoVariant;
  className?: string;
  ariaLabel?: string;
}

const sizeMap: Record<LogoSize, { box: string; text: string; rounded: string }> = {
  sm: { box: "w-8 h-8", text: "text-xs", rounded: "rounded" },
  md: { box: "w-12 h-12", text: "text-sm", rounded: "rounded-md" },
  lg: { box: "w-16 h-16", text: "text-base", rounded: "rounded-lg" },
};

/**
 * Renders a ticker logo with a graceful initials fallback.
 *
 * Behavior:
 *  1. Renders an initials pill immediately so SSR / first paint is never blank.
 *  2. Loads the logo.dev image (via /api/company-logo proxy) in the background.
 *  3. If the image loads (`onLoad`), the initials pill is replaced.
 *  4. If the image fails (`onError`), the initials pill stays.
 *
 * Replaces the prior pattern of `<img src=… onError={hide}>` which left a blank
 * box on missing logos (see Issue C8).
 */
export default function TickerLogo({
  ticker,
  size = "md",
  variant = "default",
  className,
  ariaLabel,
}: TickerLogoProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const upper = ticker.toUpperCase();
  const initials = upper.slice(0, 2);
  const { box, text, rounded } = sizeMap[size];

  const surface =
    variant === "subtle"
      ? "bg-slate-800 text-slate-300 group-hover:bg-blue-600 group-hover:text-white"
      : "bg-slate-800 text-slate-200 group-hover:bg-blue-600 group-hover:text-white";

  return (
    <div
      className={cn(
        "relative shrink-0 inline-flex items-center justify-center font-bold uppercase transition-colors",
        box,
        text,
        rounded,
        surface,
        className
      )}
      role="img"
      aria-label={ariaLabel ?? `${upper} logo`}
    >
      <span aria-hidden={imageLoaded ? "true" : undefined}>{initials}</span>
      {!imageFailed && (
        <img
          src={`/api/company-logo?ticker=${encodeURIComponent(upper)}`}
          alt=""
          className={cn("absolute inset-0 object-contain p-1", rounded, imageLoaded ? "opacity-100" : "opacity-0")}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageFailed(true)}
          loading="lazy"
          decoding="async"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
