---
name: i18n-update-and-ui-text-translation
description: Workflow command scaffold for i18n-update-and-ui-text-translation in qualtrim-design.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /i18n-update-and-ui-text-translation

Use this workflow when working on **i18n-update-and-ui-text-translation** in `qualtrim-design`.

## Goal

Synchronize UI text with translation files and ensure all user-facing strings are internationalized.

## Common Files

- `client/components/*.tsx`
- `client/pages/*.tsx`
- `client/locales/en/translation.json`
- `client/locales/he/translation.json`
- `client/lib/mockData.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Identify new or hardcoded UI strings in component and page files.
- Update or add keys in translation files (client/locales/en/translation.json, client/locales/he/translation.json).
- Refactor UI components/pages to use translation keys instead of hardcoded strings.
- Optionally update mock data to reflect new/translated content.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.