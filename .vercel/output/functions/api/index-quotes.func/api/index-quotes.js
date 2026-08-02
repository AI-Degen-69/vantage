// Vercel serverless wrapper for server/routes/stock-data's handleIndexQuotes.
// Express req/res objects are duck-type-compatible with Vercel's at runtime,
// so this is a pass-through. Node-cache stays warm within a single function
// bundle; cold caches reset across deployments / idle timeouts.
import { handleIndexQuotes } from '../server/routes/stock-data';
export default async function (req, res) {
    return handleIndexQuotes(req, res, () => { });
}
//# sourceMappingURL=index-quotes.js.map