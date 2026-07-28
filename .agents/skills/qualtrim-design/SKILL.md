```markdown
# qualtrim-design Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches the core development patterns, coding conventions, and collaborative workflows for the `qualtrim-design` repository—a TypeScript React codebase for building internationalized UI components and features. You will learn how to structure code, manage translations, develop features across client and server, and follow the repository's established commit and testing practices.

## Coding Conventions

### File Naming

- **Components, pages, and most files use PascalCase.**
  - Example: `UserProfile.tsx`, `DashboardPage.tsx`

### Import Style

- **Use alias-based imports for clarity and maintainability.**
  - Example:
    ```typescript
    import { UserCard } from '@/components/UserCard';
    import { fetchData } from '@/lib/api';
    ```

### Export Style

- **Mixed usage of default and named exports.**
  - Example (default export):
    ```typescript
    const UserProfile = () => { /* ... */ };
    export default UserProfile;
    ```
  - Example (named export):
    ```typescript
    export const fetchData = async () => { /* ... */ };
    ```

### Commit Messages

- **Follow Conventional Commits.**
  - Prefixes: `feat`, `fix`, `chore`
  - Example: `feat: add user profile card component`

## Workflows

### i18n Update and UI Text Translation

**Trigger:** When adding new UI components/features with user-facing text, or translating existing hardcoded text.  
**Command:** `/translate-ui`

1. **Identify** new or hardcoded UI strings in component and page files.
   - Example:
     ```tsx
     // Before
     <h1>Welcome to Qualtrim!</h1>
     ```
2. **Update or add** keys in translation files:
   - `client/locales/en/translation.json`
   - `client/locales/he/translation.json`
   - Example:
     ```json
     // translation.json
     {
       "welcome": "Welcome to Qualtrim!"
     }
     ```
3. **Refactor UI** to use translation keys instead of hardcoded strings.
   - Example:
     ```tsx
     import { useTranslation } from 'react-i18next';

     const { t } = useTranslation();
     <h1>{t('welcome')}</h1>
     ```
4. **Optionally update** mock data to reflect new/translated content.
   - Edit: `client/lib/mockData.ts`

**Files involved:**
- `client/components/*.tsx`
- `client/pages/*.tsx`
- `client/locales/en/translation.json`
- `client/locales/he/translation.json`
- `client/lib/mockData.ts`

---

### Feature Development with Shared UI and API

**Trigger:** When implementing a significant new feature or migrating upstream APIs, requiring coordinated changes across client, server, and shared files.  
**Command:** `/new-feature`

1. **Implement or update UI** components and pages.
   - Example: Add `client/components/FeatureCard.tsx`
2. **Update or add shared logic** in `client/lib` or `shared/api.ts`.
   - Example:
     ```typescript
     // shared/api.ts
     export const getFeatureData = async () => { /* ... */ };
     ```
3. **Update or add server routes/services** in `server/routes/*.ts` and `server/services/*.ts`.
4. **Update translation files** for any new UI text.
   - See i18n workflow above.
5. **Update documentation** as needed.
   - Edit: `docs/*.md`, `AGENTS.md`
6. **Update package metadata** if dependencies or project identity change.
   - Edit: `package.json`, `pnpm-lock.yaml`
7. **Validate with tests** and smoke scripts.
   - Run or update: `*.test.*`, `scripts/smoke.mjs`

**Files involved:**
- `client/components/*.tsx`
- `client/pages/*.tsx`
- `client/lib/*.ts`
- `shared/api.ts`
- `server/routes/*.ts`
- `server/services/*.ts`
- `client/locales/en/translation.json`
- `client/locales/he/translation.json`
- `docs/*.md`
- `AGENTS.md`
- `package.json`
- `pnpm-lock.yaml`
- `scripts/smoke.mjs`

---

## Testing Patterns

- **Test files use the pattern:** `*.test.*`
  - Example: `UserProfile.test.tsx`
- **Testing framework:** Not specified (check project for details).
- **Tests should cover new features and bug fixes.**

## Commands

| Command        | Purpose                                                                 |
|----------------|-------------------------------------------------------------------------|
| /translate-ui  | Start the i18n update and UI text translation workflow                  |
| /new-feature   | Start the feature development workflow spanning UI, shared, and API code |
```