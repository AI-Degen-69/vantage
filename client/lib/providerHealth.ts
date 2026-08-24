import type {
  ProviderHealthEntry,
  ProviderHealthFeature,
  ProviderName,
  ProviderStatus,
} from "../../shared/api";

/**
 * Shared predicate for the provider-health hooks — the single home for
 * "is there a probe entry with exactly this provider × feature ×
 * status?" Previously copy-pasted as a `some()` scan inside each hook;
 * the feature-scoping rule (a Yahoo chart outage is not a quote outage)
 * lives here now.
 */
export function isProviderStatus(
  providers: ProviderHealthEntry[] | undefined,
  provider: ProviderName,
  feature: ProviderHealthFeature,
  status: ProviderStatus,
): boolean {
  return (
    providers?.some(
      (p) =>
        p.provider === provider && p.feature === feature && p.status === status,
    ) ?? false
  );
}
