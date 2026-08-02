// Vercel serverless wrapper for server/routes/stock-data's handleBatchQuotes.
// Express req/res objects are duck-type-compatible with Vercel's at runtime,
// so this is a pass-through. Node-cache stays warm within a single function
// bundle; cold caches reset across deployments / idle timeouts.
import { handleBatchQuotes } from '../server/routes/stock-data';
export default async function (req, res) {
    return handleBatchQuotes(req, res, () => { });
}
//# sourceMappingURL=stock-batch-quotes.js.map