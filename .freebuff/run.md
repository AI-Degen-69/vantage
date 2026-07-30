# Vantage — Run Instructions

## How to reproduce uncommitted artifacts

1. **Environment file**: Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   The app works with placeholder API keys — it falls back to mock data when real API calls fail.

2. **Dependencies**: Already installed in `node_modules/`. If missing:
   ```bash
   pnpm install
   ```

## How to run the dev server

```bash
pnpm dev
```

This boots Vite on port 8080 with an integrated Express backend. The Vite config (`vite.config.ts`) includes an `express-plugin` that mounts the Express app as middleware, so both client HMR and API routes are served on the same port.

**Production mode**:
```bash
pnpm build
pnpm start
```

This builds the client SPA to `dist/spa/` and the server to `dist/server/`, then runs the production server.

## Other commands

| Command | Purpose |
|---|---|
| `pnpm typecheck` | Run TypeScript compiler checks |
| `pnpm test` | Run Vitest test suite |
| `pnpm format.fix` | Run Prettier formatter |
