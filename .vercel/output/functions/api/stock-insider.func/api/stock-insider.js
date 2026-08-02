// Vercel serverless wrapper for server/routes/stock-data's handleStockInsider.
// Express req/res objects are duck-type-compatible with Vercel's at runtime,
// so this is a pass-through. Node-cache stays warm within a single function
// bundle; cold caches reset across deployments / idle timeouts.
import { handleStockInsider } from '../server/routes/stock-data';
export default async function (req, res) {
    return handleStockInsider(req, res, () => { });
}
//# sourceMappingURL=stock-insider.js.map