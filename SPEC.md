# SPEC.md — Issue #75: RTL slider & price-range behavior (Hebrew)

## Goal
In Hebrew (`dir=rtl`) every slider fill stays attached to the thumb growing
from the min-value side, and every price-range surface (Day / 52W /
Index corridor) mirrors to standard Hebrew-IL RTL convention with
translated, right-aligned, justified text. English LTR is unchanged.

## Direction Policy (from issue — DECIDED)
- Everything mirrors to RTL in Hebrew. No surface stays LTR.
- Body/paragraph text: justified, paragraphs start at the right edge.
- Numbers stay in the RTL line: a numeric-only label is a right-aligned
  RTL line, never flipped into an LTR line via bidi isolation.
- Axis/caption strings render in Hebrew via the i18n dictionary.

## Surfaces & Expected Behavior
1. **Landing DCF sandbox** (`client/pages/Landing.tsx`, 4 range inputs):
   fill attached to thumb, growing from min side at every value; drag correct.
2. **Charts DCF widget** (`client/components/DCFWidget.tsx`, 4 range inputs):
   same fix.
3. **Charts Day + 52W ranges** (`client/pages/Charts.tsx` `DualRange`):
   mirrored track (low=right, high=left), needle/fill track current price,
   captions in Hebrew, no mixed-direction layout.
4. **Index 52W corridor** (`client/pages/Index.tsx` ~1094–1189): axis labels
   in Hebrew, correct RTL order, right-aligned; numeric-only labels stay
   right-aligned RTL lines.
5. **Justify**: Hebrew body text `text-align: justify`, scoped to
   `html[dir="rtl"]` so LTR is untouched.

## Out of Scope
Reverse-DCF gauge, 2D heat matrix, Screener page.

## Acceptance Criteria (from issue)
- [ ] HE: all Landing + DCF-widget slider fills attached to thumb, grow from
  min side; drag correct.
- [ ] HE: Day/52W bars mirrored (high left, low right), needle/fill track
  price, captions Hebrew, no mixed direction.
- [ ] HE: Index 52W labels Hebrew, correct order, right-aligned; numeric-only
  labels stay right-aligned RTL lines.
- [ ] HE text justify-aligned, paragraphs start right.
- [ ] EN LTR unchanged. `pnpm typecheck` + `pnpm test` green.

## Technical Approach (locked)
- Sliders: direction-aware gradient — `to left` when `isRtl`, else
  `to right` — via existing `useI18n().isRtl`. Native input mirroring
  (min on right in RTL) is kept; only the painted fill flips.
- `DualRange`: remove forced `dir="ltr"` root; anchor fill/needle with
  logical `inset-inline-start` (or conditional `left`/`right`), swap axis
  order in RTL; drop `dir="ltr"` on midpoint/in-range captions, keep
  numbers inline (`tabular-nums`, no line-flipping isolation).
- Index corridor: add `index.corridor*` i18n keys (EN+HE), RTL-conditional
  axis order, keep width-% fill (block div starts from right in RTL =
  grows from min side).
- Justify: `html[dir="rtl"]` scoped CSS rule in `client/global.css`.
