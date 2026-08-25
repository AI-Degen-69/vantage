# plans/index.md — vantage consistency audit (improve skill)

- **Generated:** 2026-08-19
- **Commit stamp:** `03ab10182da1415b3c42491f3d5caa2e68cb23d5`
- **Executor worktree:** `C:/Users/Tiger/Agents\Projects\vantage-exec` (branch `gflow/improve-exec`)
- **Auditor model:** main (writes only `plans/`). Execution + merge decision belong to the user.

## Priority order (leverage = impact ÷ effort, weighted by confidence)
1. `001-gain-loss-colors.md` — F1 gain/loss canonicalization (HIGH / M)
2. `002-font-stack.md` — F4 Heebo font mismatch (HIGH / S) — quick win
3. `003-page-headers.md` — F3 page-header consistency (HIGH / M)
4. `004-slate-sweep.md` — F2 slate→theme-token sweep (HIGH / L)
5. `005-design-doc.md` — F6 author DESIGN.md, fixes F5 (MED / M)
6. `006-tmp-cleanup.md` — F7 tmp/ cleanup (HIGH / S)

## Dependency graph
- `001` → `004`: run 001 before 004 so financial-sign reds are gone before the slate sweep (avoids re-touching same lines).
- `003` depends on `PageHeader` (already exists) — no code dependency.
- `002`, `005`, `006` are independent.
- **Recommended execution order:** `002` → `001` → `003` → `004` → `005` → `006`.

## Findings dropped / subsumed
- F5 (dangling `DESIGN.md` references) is resolved by F6 (authoring the doc).

## Process notes
- Main repo tree stays clean; only `plans/` written here by the auditor.
- Execution happens in the isolated worktree branch; the merge is the user's decision.
- `fable-judge` review required on executor return before any merge.
