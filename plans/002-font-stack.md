# Plan 002 — Resolve font stack / Heebo mismatch (F4)

- **Repo:** vantage
- **Executor worktree:** `C:/Users/Tiger/Agents/Projects/vantage-exec` (branch `gflow/improve-exec`)
- **Git commit stamp:** `03ab10182da1415b3c42491f3d5caa2e68cb23d5`
- **Audit finding:** F4 (HIGH confidence, S effort)

## Goal
Make the configured primary typeface actually load. `tailwind.config.ts` sets `sans`/`display` to lead with **Heebo**, but `client/global.css` `@import` only loads Inter / Space Grotesk / JetBrains Mono — Heebo is never fetched, so every `font-sans`/`font-display` falls through to the next family. Load Heebo in `global.css` to match the config.

## Exact edit
`client/global.css` line 2 currently:
```
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600;700&family=Space+Grotesk:wght@500;600;700&display=swap");
```
Replace with (Heebo added, weights `300;400;500;600;700;800` to match `index.html`):
```
@import url("https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600;700&family=Space+Grotesk:wght@500;600;700&display=swap");
```

## Verification gates
1. `pnpm typecheck` → exit 0.
2. `pnpm build:client` → succeeds.
3. **Positive:** `grep -c "Heebo" client/global.css` → `1` (the import now references Heebo).

## STOP
- Do NOT change `tailwind.config.ts` `fontFamily` (keep Heebo as configured). Only edit the `@import`.
- If build fails → STOP and report.
