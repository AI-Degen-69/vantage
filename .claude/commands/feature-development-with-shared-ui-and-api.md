---
name: feature-development-with-shared-ui-and-api
description: Workflow command scaffold for feature-development-with-shared-ui-and-api in qualtrim-design.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-development-with-shared-ui-and-api

Use this workflow when working on **feature-development-with-shared-ui-and-api** in `qualtrim-design`.

## Goal

Develop new features that span UI components, shared logic, and server/API layers, including updating documentation and package metadata.

## Common Files

- `client/components/*.tsx`
- `client/pages/*.tsx`
- `client/lib/*.ts`
- `shared/api.ts`
- `server/routes/*.ts`
- `server/services/*.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Implement or update UI components and pages.
- Update or add shared logic (client/lib, shared/api.ts).
- Update or add server routes and services.
- Update translation files for new UI text.
- Update documentation (e.g., endpoints.md, AGENTS.md).

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.