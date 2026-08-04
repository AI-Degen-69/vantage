/**
 * Re-export shim — backward-compat only.
 *
 * The actual `LocalMemoryStore`, `VercelKvStore`, `usageStore` singleton,
 * and `__test__` definitions all live in `./apiUsageTracker` so that the
 * Vercel API bundler ships a single self-contained file (sibling
 * imports get dropped on serverless cold starts). This shim keeps the
 * existing tests and dynamic-import paths in `api/_router.js` working
 * without forcing them to chase through a sibling file.
 *
 * New code should import directly from `./apiUsageTracker`. This file
 * exists only to avoid breaking the existing call sites.
 */

export {
  type TrackedProvider,
  type BucketSnap,
  type UsageStore,
  LocalMemoryStore,
  VercelKvStore,
  usageStore,
  __test__,
} from "./apiUsageTracker";
