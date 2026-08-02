// Vercel serverless wrapper for server/routes/demo's handleDemo.
// Express req/res objects are duck-type-compatible with Vercel's at runtime,
// so this is a pass-through. Node-cache stays warm within a single function
// bundle; cold caches reset across deployments / idle timeouts.
import { handleDemo } from '../server/routes/demo';
export default async function (req, res) {
    return handleDemo(req, res, () => { });
}
//# sourceMappingURL=demo.js.map