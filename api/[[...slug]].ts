// Vercel optional catch-all serverless function routing all /api/* requests.
// Imports from a .js router (prefixed _ so Vercel doesn't treat it as an
// endpoint) because Vercel's @vercel/node bundler cannot handle TypeScript
// local imports at runtime (FUNCTION_INVOCATION_FAILED).
import { router } from "./_router.js";

export default async function handler(req: any, res: any) {
  return router(req, res);
}
