# CONSTRAINTS.md — Issue #75 (RTL sliders & price ranges)

## Zero Regressions
- `pnpm typecheck` must pass; `pnpm test` stays green.
- English (LTR) rendering is pixel-unchanged: every visual change is gated
  behind RTL (`isRtl` / `html[dir="rtl"]` / `dir` prop). No unconditional
  layout flips.

## Scope Lock
- IN: Landing DCF sandbox sliders (4), Charts DCF widget sliders (4),
  Charts Day/52w `DualRange` + captions, Index 52W corridor labels +
  RTL layout, Hebrew justify alignment.
- OUT: reverse-DCF speedometer gauge, 2D valuation heat matrix, Screener page.

## Anti-Cheat
- No `skip`/`disable`/deleted assertions; no eslint suppressions to silence
  RTL or a11y warnings; no snapshot updates that mask LTR drift.

## Dependencies
- No new external dependencies. Only existing `useI18n` (`isRtl`) +
  Tailwind/CSS logical properties.

## Performance / A11y
- No runtime cost beyond a direction conditional; keep `prefers-reduced-motion`
  behavior intact; sliders keep native keyboard + aria-label behavior.
