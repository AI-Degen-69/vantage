// Vercel serverless wrapper for server/routes/company-logo's handleCompanyLogo.
// Express req/res objects are duck-type-compatible with Vercel's at runtime,
// so this is a pass-through. Node-cache stays warm within a single function
// bundle; cold caches reset across deployments / idle timeouts.
import { handleCompanyLogo } from '../server/routes/company-logo';
export default async function (req, res) {
    return handleCompanyLogo(req, res, () => { });
}
//# sourceMappingURL=company-logo.js.map