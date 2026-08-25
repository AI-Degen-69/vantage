import { useI18n } from "@/lib/i18n";
import { useFmpBatchQuoteRestricted, useYahooDown } from "@/hooks/useStockData";

/**
 * Small "Yahoo fallback" chip for quote tables (Watchlists / Portfolio /
 * Insights). While FMP `batch-quote` reports `known_restriction` — the
 * endpoint is paid-gated on the current plan (HTTP 402 on the free tier) —
 * batch quotes are fetched per-symbol through Yahoo; this chip explains why
 * at the table itself instead of only the global banner.
 *
 * Hidden while Yahoo itself is down: the per-symbol fallback can't serve
 * prices then, so claiming it would be misleading (the [MOCK] badge + top
 * banner cover that case instead).
 *
 * Shares the `providerHealth` query key with `ProviderHealthIndicator` /
 * `useYahooDown`, so React Query dedupes the fetch — zero extra requests.
 */
export default function BatchQuoteFallbackHint({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const restricted = useFmpBatchQuoteRestricted();
  const yahooDown = useYahooDown();
  if (!restricted || yahooDown) return null;
  return (
    <span
      title={t("providerHealth.batchFallbackTooltip")}
      className={`inline-flex items-center text-xs font-medium uppercase tracking-wide px-2 py-1 rounded text-chart-blue bg-chart-blue/10 border border-chart-blue/20 whitespace-nowrap ${className}`}
    >
      {t("providerHealth.batchFallback")}
    </span>
  );
}
