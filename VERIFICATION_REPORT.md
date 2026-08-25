# Vantage — Dark Theme Verification Report

**Task:** t_70fef520 — Verify dark theme consistency and visual regression across key views
**Date:** 2026-08-20
**Verifier:** default profile (kanban worker)
**Scope:** the slate-* → Observatory semantic-token migration (parent t_20af042e), across the 19 modified files.

---

## 1. Verdict

The slate-* → token migration is **mechanically sound and visually consistent** for its scope.
Dark surfaces now resolve through the Observatory token system (`--card`, `--muted`, `--border`,
`--foreground`, `--muted-foreground`) rather than raw slate classes. Two migration-introduced defects
were found and fixed; one migration gap (hex-form slate) was found and fixed. Remaining drift is
pre-existing chrome (blue/green/red/amber/sky/zinc/stone) that was **never in the slate migration's
scope** and is escalated as a follow-up task.

---

## 2. Verification method

- Read `DESIGN.md`, `client/global.css` (`.dark` + `:root`), `tailwind.config.ts`.
- Reviewed `SLATE_OBSERVATORY_MAPPING.md` (parent t_4f05880c) against live files.
- `git diff` on the key views (Index, Charts, Portfolio) to confirm token semantics.
- Grep for remaining slate-* color classes, hardcoded hex/rgb/hsl, and retired Tailwind-default chrome.
- `pnpm typecheck` (tsc) and `pnpm build:client` (vite) — both pass.

### Evidence

- Remaining slate-* **color classes: 2** (the two documented `bg-slate-500` keeps — DipFinder
  progress marker line 152, ProviderHealthIndicator status dot line 44). All other slate-* are gone.
- No hardcoded slate/blue hex remains in `DCFWidget.tsx`.
- No malformed inline `/* … */` comments remain in className strings.

---

## 3. Fixes applied (3)

### 3.1 Malformed TODO comments (migration regression)
The parent injected `/* TODO: Observatory — needs --progress token */` **inside** the className
string literals, which renders as a garbage class token rather than a comment.

- `client/components/DipFinder.tsx:151` → moved to a proper JSX `{/* … */}` comment.
- `client/components/ProviderHealthIndicator.tsx:43` → moved to a proper `// …` comment.

### 3.2 DCFWidget chart SVG (migration gap — hex-form slate)
The slate-class audit only matched classes, so the Recharts chart still hardcoded the retired
slate/blue palette as hex. Replaced with Observatory `hsl()` literals (Recharts SVG attributes do not
resolve CSS custom properties, matching the existing `ChartModal.tsx` convention):

| Old hex | Old meaning | New | Token |
|---|---|---|---|
| `#1e293b` | slate-800 gridline/tooltip border | `hsl(250 20% 16%)` | `--border` (Graticule) |
| `#e2e8f0` | slate-200 reference line / tooltip text | `hsl(210 20% 95%)` | `--foreground` |
| `#64748b` | slate-500 axis ticks | `hsl(220 10% 60%)` | `--muted-foreground` (Dust) |
| `#0f172a` | slate-900 tooltip bg / dot stroke | `hsl(250 30% 9%)` | `--card` (Deep Field) |
| `#3b82f6` | blue-500 projection line | `hsl(200 60% 60%)` | `--chart-blue` (Nebula Blue) |

Values are defined once as local `chart*` constants with `--token` comments.

---

## 4. Findings — intentional edge cases (documented, no action required)

These are design tradeoffs the mapping doc (parent t_4f05880c) already accepted. They are **not bugs**
but they do change visual weight in dark mode:

- **`bg-slate-900` vs `bg-slate-800` collapse** — both map to `--card`/`--muted`, which are the *same*
  HSL (`250 30% 9%`). Any surface that relied on the two-step distinction now reads as one material.
  Per DESIGN.md this is intended ("not a separate material"); use `bg-accent` for a genuine elevation step.
- **`bg-slate-700` → `bg-accent`** — badges/pills (EarningsAlertStrip, Watchlists, sectorGlyphs) get
  visibly darker (slate-700 ≈ 23% L → accent ≈ 12% L).
- **`text-slate-400` → `text-foreground/80`** (48 occurrences) — opacity workaround for the missing
  mid-tier text token (Observatory jumps Starlight White → Dust with nothing between).

---

## 5. Escalations

### 5.1 (new task) Phase-2: retire remaining blue/green/red/amber/sky/zinc/stone chrome
~15 of the 19 modified files still carry hardcoded Tailwind-default "Bloomberg terminal" chrome that
DESIGN.md explicitly rejects ("Don't carry over the old hardcoded slate-*/blue-600 chrome colors").
This was **out of scope** for the slate-* migration and remains as visible drift:

- `bg-blue-600` / `hover:bg-blue-700` buttons (DCFWidget toggle, EarningsCalendar, LanguageSwitcher,
  TickerLogo, Portfolio) → should be `bg-primary` / `bg-accent`.
- `focus:border-blue-500` / `focus:ring-blue-500` (7+ files) → `focus:border-ring` / `focus:ring-ring`.
- `text-green-400` / `text-red-400` gain/loss → `text-chart-positive` / `text-chart-negative`.
- `text-blue-400` / `text-amber-400` emphasis → `text-primary` / `text-chart-amber`.
- `bg-amber-*` ratings, `bg-sky-*` info strips, `bg-zinc-*` / `bg-stone-*` sector badges.

Created as kanban task (see completion metadata) with a mapping doc as its deliverable.

### 5.2 (design decision) Add fidelity tokens
The mapping doc recommends four new tokens to restore the lost slate-density without opacity hacks:
`--foreground-secondary: 210 15% 78%`, `--progress: 220 10% 45%`, `--border-subtle: 250 16% 12%`,
`--badge: 250 20% 20%`.

**`--progress` is now ADDED** (global.css `:root` + `.dark`, plus a `progress` color in tailwind.config.ts),
and the two functional `bg-slate-500` keeps were migrated to `bg-progress` (DipFinder progress marker,
ProviderHealthIndicator `notConfigured` dot). The remaining three (`--foreground-secondary`,
`--border-subtle`, `--badge`) stay pending a design decision — they are fidelity refinements, not
theme-bypass defects.

---

## 6. Light-theme finding

The task asks to inspect "both light and dark themes", but **light theme is unreachable**: `client/global.css`
forces `html { @apply dark; }` and there is no `ThemeProvider` or toggle anywhere in the tree
(`main.tsx` wraps only `I18nProvider`; the sole `next-themes` `useTheme()` is in `ui/sonner.tsx` for the
toast, and has no provider). The app is **dark-only by design** — only `.dark` tokens are live; the
shadcn `:root` light block is dead. No light-mode regression is possible. (Observation: `sonner`'s
`useTheme()` returns the default `"system"` with no provider — latent, pre-existing, out of scope.)

---

## 7. Acceptance checklist

- [x] No drift between surfaces and `--card`/`--border` tokens (slate-* classes: 0; the 2 former `bg-slate-500` functional keeps now use `bg-progress`).
- [x] Dark theme surfaces consistent — panels use `bg-card`/`bg-muted`, borders use `border-border`.
- [x] Charts use `--chart-*` / token values (DCFWidget hex gap fixed).
- [x] Regressions documented and either fixed (2 comment defects, DCFWidget hex) or escalated (phase-2 chrome, fidelity tokens).
- [x] Typecheck + build pass after fixes.
