# Plan 006 — Remove tracked tmp/ scratch artifacts (F7)

- **Repo:** vantage
- **Executor worktree:** `C:/Users/Tiger/Agents\Projects\vantage-exec` (branch `gflow/improve-exec`)
- **Git commit stamp:** `03ab10182da1415b3c42491f3d5caa2e68cb23d5`
- **Audit finding:** F7 (HIGH confidence, S effort)

## Goal
`tmp/` (`all_fundamental.txt` 420KB, `full_index_log.txt` 255KB, `git_log_index_temp.txt` 255KB, `pr-body.md` 5KB) is committed and not gitignored — scratch dumps, not source. Remove from tracking + disk and ignore.

## Exact steps (run in the worktree)
1. `git rm -r --cached tmp`
2. `rm -rf tmp`
3. Ensure `.gitignore` ignores tmp — if `tmp/` is not already present, append:
   `printf '\n# scratch artifacts\ntmp/\n' >> .gitignore`
4. `git add .gitignore` (only if it changed)
5. Commit: `git commit -m "chore: drop tracked tmp/ scratch artifacts"`

## Verification gates
1. `git ls-files tmp/` → empty (no tracked files under `tmp/`).
2. `test -d tmp && echo "STILL THERE" || echo "removed"` → `removed`.
3. `grep -q "tmp/" .gitignore` → true.

## Recovery note (report in closeout)
The files remain recoverable from history: `git show 03ab101:tmp/all_fundamental.txt`. No data is lost, only un-tracked.

## STOP
- Do NOT force-push or touch other branches.
- If `git rm` fails (e.g., already removed) → STOP and report.
