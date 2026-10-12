# tasks/plan.md — Issue #75 (Standard | Design/UI + Debug)

Size: **Standard** (5 files, one architectural decision: full-RTL mirroring).
Stack: React 18 + TS 5 + Vite + Tailwind 3, `pnpm typecheck` (`tsc`),
`pnpm test` (`vitest --run`). No test files currently in repo —
verification is typecheck + test-suite-green + browser RTL check.
Interview: skipped — requirements fully clear from the issue
(direction policy DECIDED, file/line anchors, acceptance criteria).

## Task 1 — [Design/UI] i18n keys for Index 52W corridor
- Files: `client/lib/i18n/dictionaries.ts` (EN ~line 97 area + HE ~line 1607+)
- What: add `index.corridor52w`, `index.corridorLow/Current/High`,
  `index.pctOfRange` (EN + HE). Reuse existing `charts.low/high` Hebrew
  ("נמוך"/"גבוה") wording for consistency.
- Skill: `frontend-ui-engineering` | Verify: `pnpm typecheck`

## Task 2 — [Design/UI + Debug] Landing DCF sandbox sliders RTL fill
- Files: `client/pages/Landing.tsx` (~1091–1196)
- What: read `isRtl` from `useI18n`; flip the 4 hardcoded
  `linear-gradient(to right, …)` fills to `to left` when RTL.
  Keep native drag/keyboard behavior untouched.
- Skill: `frontend-ui-engineering` | Verify: `pnpm typecheck` + browser
  HE/EN slider drag check

## Task 3 — [Design/UI + Debug] DCFWidget sliders RTL fill
- Files: `client/components/DCFWidget.tsx` (~415–607)
- What: same direction-aware gradient flip for the 4 widget sliders.
  Keep existing `dir="ltr"` on numeric value chips (isolated numbers are
  fine); only the track fill mirrors.
- Skill: `frontend-ui-engineering` | Verify: `pnpm typecheck` + browser
  HE/EN check

## Task 4 — [Design/UI + Debug] Charts DualRange mirror + captions
- Files: `client/pages/Charts.tsx` (`DualRange` 525–591; captions 340–354,
  367–376, 386–426)
- What: remove forced `dir="ltr"` on DualRange root; anchor fill/needle
  with `inset-inline-start` (or RTL-conditional left/right) so fill grows
  from min (right) side; swap axis order so high=left, low=right in RTL;
  drop `dir="ltr"` on midpoint + in-range captions (numbers stay inline,
  `tabular-nums`, right-aligned RTL lines).
- Skill: `frontend-ui-engineering` + `debugging-and-error-recovery`
  (verify needle tracks price at 0/50/100%) | Verify: `pnpm typecheck` +
  browser HE/EN check

## Task 5 — [Design/UI] Index 52W corridor RTL labels + order
- Files: `client/pages/Index.tsx` (~1094–1189)
- What: replace hardcoded "52W Corridor / Low / Current / High /
  % of 52W Range" with new `t()` keys; RTL-conditional axis order
  (Low right, High left); numeric values inline without line-flipping
  `dir="ltr"` wrappers; keep width-% fill (grows from right/min in RTL).
- Skill: `frontend-ui-engineering` | Verify: `pnpm typecheck` + browser
  HE/EN check

## Task 6 — [Design/UI] Hebrew justify alignment (scoped)
- Files: `client/global.css`
- What: add `html[dir="rtl"]` scoped rule justifying body/paragraph text
  (paragraphs start right naturally in RTL). No LTR selector changes.
- Skill: `frontend-ui-engineering` | Verify: `pnpm typecheck` + browser
  HE/EN check

## Task 7 — [Debug] Final verification gate
- What: `pnpm typecheck` passes, `pnpm test` green, EN LTR unchanged,
  all acceptance checkboxes manually confirmed in HE + EN.
- Skill: `verification-before-completion` | Verify: full gate output

## Improvement pass (proposed, NOT folded in silently)
- 💡 Extract a tiny `sliderFill(pct, isRtl)` helper (shared by Landing +
  DCFWidget, 8 call sites) instead of 8 inline ternaries — less drift risk.
  Adopt / defer / drop per operator decision during build.
