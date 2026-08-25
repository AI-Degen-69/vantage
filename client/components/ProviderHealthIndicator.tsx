import { useProviderHealth } from "@/hooks/useStockData";
import { useI18n } from "@/lib/i18n";
import { perProviderStatus } from "@shared/providerHealth";

/**
 * Canonical reference for what each endpoint costs on which plan. The
 * deployed app has no route serving the markdown, so point at the repo.
 */
const PROVIDER_DOCS_URL =
  "https://github.com/AI-Degen-69/vantage/blob/main/docs/data-providers.md";

/** Display labels for each provider — pulled through i18n keys. */
function providerLabel(t: (key: string, vars?: Record<string, string | number>) => string, provider: string): string {
  if (provider === "yahoo") return t("source.yahoo");
  if (provider === "fmp") return t("source.fmp");
  if (provider === "alphavantage") return t("source.alphavantage");
  return provider;
}

/** Display labels for each probed feature (one health entry per feature). */
function featureLabel(t: (key: string, vars?: Record<string, string | number>) => string, feature: string): string {
  if (feature === "batch-quote") return t("providerHealth.feature.batchQuote");
  if (feature === "quote") return t("providerHealth.feature.quote");
  if (feature === "chart") return t("providerHealth.feature.chart");
  // Unknown future feature — never mislabel it as a known one.
  return feature;
}

/** Severity palette keyed by the worst *actionable* provider status present. */
type Severity = "down" | "degraded" | "notConfigured";

const SEVERITY_STYLES: Record<Severity, { banner: string; dot: string }> = {
  down: {
    banner: "bg-destructive/15 border-destructive/30 text-destructive/80",
    dot: "bg-destructive",
  },
  degraded: {
    banner: "bg-chart-amber/15 border-chart-amber/30 text-chart-amber",
    dot: "bg-chart-amber",
  },
  notConfigured: {
    banner: "bg-card/70 border-border/60 text-foreground",
    dot: "bg-progress",
  },
};

/**
 * Slim global strip (mounted under the TopBar in AppLayout) that surfaces
 * data-provider status instead of letting the app silently degrade:
 *
 * - `down` / `degraded` / `not_configured` → colored banner (actionable:
 *   a temporary outage or a missing key).
 * - `known_restriction` (e.g. FMP batch-quote 402 paid-gated on the free
 *   tier) → subtle cyan "Free-tier limitations" strip with a link to
 *   docs/data-providers.md — expected, not an alarm.
 *
 * Data source: `/api/provider-health`, polled every 60s against a 5-min
 * server cache (the strip is intentionally read-only).
 */
export default function ProviderHealthIndicator() {
  const { t } = useI18n();
  const { data } = useProviderHealth();

  if (!data) return null;

  const entries = data.providers ?? [];
  const providerStatus = perProviderStatus(entries);

  const statuses = new Set(providerStatus.values());
  const severity: Severity | null = statuses.has("down")
    ? "down"
    : statuses.has("degraded")
      ? "degraded"
      : statuses.has("not_configured")
        ? "notConfigured"
        : null;

  const affected = [...providerStatus.entries()]
    .filter(([, s]) => s === "down" || s === "degraded" || s === "not_configured")
    .map(([p]) => providerLabel(t, p))
    .join(", ");

  // Feature-level detail for the tooltip (e.g. "FMP Batch quotes:
  // known_restriction · 412ms — http_402").
  const detailLines = entries
    .map((e) => {
      const probe = `${providerLabel(t, e.provider)} ${featureLabel(t, e.feature)}`;
      const latency = e.latencyMs != null ? ` · ${e.latencyMs}ms` : "";
      const why = e.detail ? ` — ${e.detail}` : "";
      return `${probe}: ${e.status}${latency}${why}`;
    })
    .join("\n");

  // Known plan limits (e.g. FMP batch quotes) — expected, listed separately.
  const restrictions = entries
    .filter((e) => e.status === "known_restriction")
    .map((e) => `${providerLabel(t, e.provider)} ${featureLabel(t, e.feature)}`);

  if (!severity && restrictions.length === 0) return null;

  const styles = severity ? SEVERITY_STYLES[severity] : null;
  const heading =
    severity === "down"
      ? t("providerHealth.outage")
      : severity === "degraded"
        ? t("providerHealth.degraded")
        : t("providerHealth.notConfigured");

  return (
    <>
      {severity && styles && (
        <div
          role="status"
          aria-live="polite"
          title={`${t("providerHealth.title")}\n${detailLines}`}
          className={`w-full border-b px-6 py-1.5 text-xs font-medium flex items-center gap-2 shrink-0 ${styles.banner}`}
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full animate-pulse ${styles.dot}`} aria-hidden />
          <span>{heading}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{t("providerHealth.affected", { providers: affected })}</span>
        </div>
      )}
      {restrictions.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          title={`${t("providerHealth.title")}\n${detailLines}`}
          className="w-full border-b px-6 py-1.5 text-xs font-medium flex items-center gap-2 shrink-0 bg-chart-blue/15 border-chart-blue/30 text-chart-blue"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-chart-blue" aria-hidden />
          <span>{t("providerHealth.knownRestriction")}</span>
          <span className="text-muted-foreground">·</span>
          <span>{restrictions.join(", ")}</span>
          <a
            href={PROVIDER_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ms-1 underline decoration-dotted underline-offset-2 hover:text-chart-blue transition-colors"
          >
            {t("providerHealth.docsLink")} ↗
          </a>
        </div>
      )}
    </>
  );
}
