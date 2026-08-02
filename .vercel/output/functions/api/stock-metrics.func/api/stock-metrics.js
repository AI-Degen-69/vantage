// Vercel serverless wrapper for server/routes/stock-data's handleStockMetrics.
// Express req/res objects are duck-type-compatible with Vercel's at runtime,
// so this is a pass-through. Node-cache stays warm within a single function
// bundle; cold caches reset across deployments / idle timeouts.
import { handleStockMetrics } from '../server/routes/stock-data';
export default async function (req, res) {
    return handleStockMetrics(req, res, () => { });
}
//# sourceMappingURL=stock-metrics.js.map