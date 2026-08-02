// Vercel serverless wrapper for server/routes/stock-data's handleStockOverview.
// Express req/res objects are duck-type-compatible with Vercel's at runtime,
// so this is a pass-through. Node-cache stays warm within a single function
// bundle; cold caches reset across deployments / idle timeouts.
import { handleStockOverview } from '../server/routes/stock-data';
export default async function (req, res) {
    return handleStockOverview(req, res, () => { });
}
//# sourceMappingURL=stock-overview.js.map