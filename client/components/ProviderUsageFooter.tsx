import { useI18n } from "@/lib/i18n";
import { useProviderUsage } from "@/hooks/useStockData";
import type { ProviderUsageEntry } from "@shared/api";
import { useEffect, useState } from "react";

/**
 * Footer-side display mode for the progress bars / count labels / tone.
 *
 * - `"used"`      fills as the budget is consumed; amber/red fire near the top.
 * - `"remaining"` shows what's left; amber/red fire near the bottom (gas-tank
 *                 model). Derived on the client as `100 − usedPct`.
 *
 * Persisted to `localStorage` under the key `vantage.usage.mode`. Default is
 * `"used"` so existing behaviour is preserved on first paint. The toggle
 * inside the footer flips this without re-fetching server data.
 */
type DisplayMode = "used" | "remaining";
const MODE_STORAGE_KEY = "vantage.usage.mode";
const DEFAULT_MODE: DisplayMode = "used";

/** Read the persisted mode with a safe fallback when storage is unavailable. */
function readStoredMode(): DisplayMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const v = window.localStorage.getItem(MODE_STORAGE_KEY);
    return v === "remaining" ? "remaining" : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

/**
 * Format a seconds-until-reset count as a compact "resets in" label.
 *
 * - `null` / `0` → "unknown reset" (server hasn't ticked yet, or window
 *   is empty so there's nothing to reset).
 * - `< 60s`  → "now" (rounded down so we don't churn the label every second).
 * - `< 1h`   → "Nm" (e.g. "23m").
 * - `< 24h`  → "Nh" (e.g. "4h").
 * - `>= 24h` → ">24h".
 */
function formatResetLabel(seconds: number | null, t: (k: string, v?: Record<string, string | number>) => string): string {
  if (seconds === null || seconds === undefined) return t("usage.unknownReset");
  if (seconds < 60) return t("usage.resetNow");
  if (seconds < 3_600) {
    const m = Math.floor(seconds / 60);
    return t("usage.resetInMinutes", { minutes: m });
  }
  if (seconds < 86_400) {
    const h = Math.floor(seconds / 3_600);
    return t("usage.resetInHours", { hours: h });
  }
  return t("usage.resetOver24h");
}

/**
 * Color tier for a single pill's progress bar / severity.
 *
 * Used-mode thresholds:
 * - `ok`       green   < 60% used (room to spare)
 * - `warn`     amber   60–80% used (close to limit)
 * - `danger`   red     > 80% used OR provider is in a 429 zone today
 * - `muted`    slate   heuristic ceiling for Yahoo (never visualised as a
 *                     hard cap, even at 100%, to avoid misleading the user)
 *
 * Remaining-mode thresholds are inverted so green = plenty left, red = low.
 * The boundary is still 60% / 80% but interpreted against the *displayed*
 * percentage (which flips under the remaining mode).
 */
type PillTone = "ok" | "warn" | "danger" | "muted";

function pillTone(e: ProviderUsageEntry, mode: DisplayMode): PillTone {
  if (e.limitHint === "heuristic") return "muted";
  if (e.isRateLimited) return "danger";
  // Always recognise a true overshoot (usedPct > 100, e.g. cadence jitter
  // before the bucket rolls over) as a danger state regardless of mode.
  if (e.usedPct > 100) return "danger";
  const pct = mode === "remaining" ? 100 - e.usedPct : e.usedPct;
  if (mode === "remaining") {
    if (pct < 20) return "danger";
    if (pct < 40) return "warn";
    return "ok";
  }
  if (pct >= 80) return "danger";
  if (pct >= 60) return "warn";
  return "ok";
}

/** Tailwind classes scoped per tone. Centralising here keeps the JSX readable. */
const TONE: Record<PillTone, { pill: string; bar: string; dot: string; text: string }> = {
  ok: {
    pill: "bg-emerald-950/40 border-emerald-700/40",
    bar: "bg-emerald-500",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
  },
  warn: {
    pill: "bg-amber-950/40 border-amber-700/40",
    bar: "bg-amber-400",
    dot: "bg-amber-400",
    text: "text-amber-300",
  },
  danger: {
    pill: "bg-red-950/40 border-red-700/40",
    bar: "bg-red-500",
    dot: "bg-red-400",
    text: "text-red-300",
  },
  muted: {
    pill: "bg-slate-900/40 border-slate-700/40",
    bar: "bg-slate-500",
    dot: "bg-slate-500",
    text: "text-slate-300",
  },
};

/**
 * Compact per-provider pill. Shows the provider name, current count
 * (`used / limit` or `remaining / limit left`), a horizontal progress bar,
 * the reset horizon, and the active display mode.
 *
 * The bar width is intentionally capped at 0–100 % even when the count
 * exceeds the limit so a sudden runaway call rate doesn't break the
 * layout. In remaining mode the width reflects `100 − usedPct` so an
 * empty budget reads as a fully-empty bar (the gas-tank model).
 *
 * The `remaining` count is derived client-side as `limit − used` and
 * clamped at zero; `used` is clamped at `limit + 0` so a true overrun
 * (rare; cadence wobble right before the bucket rolls over) doesn't
 * render as a negative count.
 */
function ProviderPill({ entry, mode }: { entry: ProviderUsageEntry; mode: DisplayMode }) {
  const { t, lang } = useI18n();
  const tone = pillTone(entry, mode);
  const c = TONE[tone];
  const remaining = Math.max(0, entry.limit - entry.used);
  const usedClamped = Math.min(entry.used, entry.limit);
  // Display percentage: in remaining mode we want an empty bar when the
  // budget is gone, in used mode we want a full bar at the same point.
  const displayPct = mode === "remaining"
    ? Math.min(100, Math.max(0, 100 - entry.usedPct))
    : Math.min(100, Math.max(0, entry.usedPct));
  const width = `${displayPct}%`;
  const reset = formatResetLabel(entry.secondsToReset, t);

  // Localised count text. The `remaining` variant uses the new
  // `usage.remainingOfLimit*` keys with a separate `remaining` template
  // variable so templating reads naturally in both languages.
  const countTpl = entry.windowLabel === "24h"
    ? (mode === "remaining"
        ? t("usage.remainingOfLimitDay", { remaining, limit: entry.limit })
        : t("usage.usedOfLimitDay", { used: usedClamped, limit: entry.limit }))
    : (mode === "remaining"
        ? t("usage.remainingOfLimit", { remaining, limit: entry.limit })
        : t("usage.usedOfLimit", { used: usedClamped, limit: entry.limit }));

  const tooltip = entry.isRateLimited
    ? `${entry.label}: ${t("usage.rateLimited")} — ${reset}`
    : `${entry.label} · ${countTpl}${entry.limitHint === "heuristic" ? ` (${t("usage.heuristic")})` : ""} • ${reset}`;

  return (
    <div
      className={`shrink-0 inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs leading-none ${c.pill}`}
      title={tooltip}
      dir={lang === "he" ? "rtl" : "ltr"}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} aria-hidden />
      <span className={`font-semibold ${c.text}`}>{entry.label}</span>
      <span className="text-muted-foreground tabular-nums" dir="ltr">{countTpl}</span>
      <span className="relative inline-block h-1 w-12 overflow-hidden rounded-full bg-slate-800/80">
        <span
          className={`absolute top-0 left-0 h-full ${c.bar} transition-[width] duration-500 ease-out`}
          style={{ width }}
        />
      </span>
      <span className="text-muted-foreground" dir="ltr">{reset}</span>
      {entry.limitHint === "heuristic" && (
        <span
          className="text-[9px] uppercase tracking-wide text-slate-500"
          aria-label={t("usage.heuristic")}
          title={t("usage.heuristicTooltip")}
        >
          ~i
        </span>
      )}
      {entry.isRateLimited && (
        <span
          className="text-[10px] uppercase font-semibold text-red-300"
          title={t("usage.rateLimited")}
        >
          429
        </span>
      )}
    </div>
  );
}

/**
 * Compact two-button segmented control for switching the footer display
 * mode. Lives in the footer's left rail next to the title. The active
 * segment is tie-dyed with the brand's muted-card tone so the change is
 * visible without pulling focus away from the pills themselves.
 */
function ModeToggle({ mode, onChange }: { mode: DisplayMode; onChange: (m: DisplayMode) => void }) {
  const { t } = useI18n();
  return (
    <div
      role="group"
      aria-label={t("usage.modeToggle.label")}
      className="inline-flex items-center rounded-full border border-border bg-card/40 p-0.5 text-[10px] font-medium"
    >
      {(["used", "remaining"] as const).map((m) => {
        const active = m === mode;
        const labelKey = m === "used" ? "usage.modeToggle.used" : "usage.modeToggle.remaining";
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            aria-pressed={active}
            className={
              "px-2 py-0.5 rounded-full transition-colors duration-200 " +
              (active
                ? "bg-primary/20 text-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Page-bottom bar showing live API-usage progress pills for every tracked
 * provider (FMP / AlphaVantage / Yahoo). Mutes itself when the data
 * hasn't ticked yet so the first paint isn't an empty pill row.
 *
 * A used↔remaining toggle sits next to the title; the chosen mode is
 * persisted in `localStorage` and re-applied on the next render. The
 * `useNow` ticker is intentionally local to the footer because the
 * reset countdown needs to decrement once a second for the user's
 * perceived accuracy, even though the underlying server data only
 * re-polls every 15 s. We rebase the displayed seconds off the server's
 * `checkedAt` + the elapsed wall clock so the count stays honest even
 * after a long browser-tab pause.
 */
export default function ProviderUsageFooter() {
  const { t } = useI18n();
  const { data } = useProviderUsage();
  const [mode, setMode] = useState<DisplayMode>(() => readStoredMode());

  // Persist the mode on change so it survives reloads. Wrapped in try/
  // catch in case storage is disabled (Safari private mode, some
  // enterprise policies); fall back silently — the in-memory state
  // still drives this session.
  useEffect(() => {
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
      /* localStorage disabled — keep in-memory state only */
    }
  }, [mode]);

  // 1 s local ticking state — forces the reset labels to update without
  // re-fetching the server payload every second.
  const [, force] = useState(0);
  useEffect(() => {
    if (!data) return;
    const id = window.setInterval(() => force((n) => n + 1), 1_000);
    return () => window.clearInterval(id);
  }, [data]);

  if (!data || data.entries.length === 0) return null;
  return (
    <footer
      role="contentinfo"
      aria-label={t("usage.footerLabel")}
      className="w-full border-t border-border bg-card/60 backdrop-blur-sm px-4 py-2 flex items-center gap-3 flex-wrap shrink-0"
    >
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium shrink-0">
        {t("usage.title")}
      </span>
      <ModeToggle mode={mode} onChange={setMode} />
      <div className="flex flex-wrap items-center gap-2">
        {data.entries.map((e) => (
          <ProviderPill key={e.provider} entry={e} mode={mode} />
        ))}
      </div>
    </footer>
  );
}
