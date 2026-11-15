# AGENTS.md

Guide for AI agents (and people) working in this repo. Keep it short; details live in `README.md`.

## Stack

React 19 + TypeScript (strict) + Vite, TanStack Query, zustand, react-hook-form + zod, Tailwind +
shadcn/ui (Radix), i18next, Vitest + Testing Library.

## Layers (top → bottom; import only your layer and lower ones)

1. `src/pages/<section>/` (+ `App.tsx`, `main.tsx`) — screens; a page never imports another page.
2. `src/components/`, `src/hooks/`, `src/stores/`, `src/contexts/` — shared UI and state.
3. `src/api/`, `src/auth/` — HTTP clients; `axios` only here (`src/auth/apiClient.ts` is the instance).
4. `src/lib/`, `src/types/`, `src/const/`, `src/i18n/` — pure helpers, types, constants.

`src/components/ui/` is the design system: it imports only `lib/` and packages.
Colors come only from semantic tokens (no raw Tailwind palette): see `docs/ui.md`.

## Commands

- `npm run verify` — every check: type-check → lint → format:check → arch → dup → knip → tests.
- `npm run lint` / `npm run lint:fix` / `npm run lint:prune` — ESLint; prune after fixing a baselined
  violation.
- `npm run arch` (dependency-cruiser), `npm run dup` (jscpd), `npm run knip`, `npm run test:run`.

## Done =

`npm run verify` is green **and** the new behaviour has a test.

## Never

- Weaken a check: edit `eslint.config.js`, `eslint-suppressions.json`, `.dependency-cruiser.cjs`,
  `.jscpd.json`, `.jscpd-baseline.json`, `knip.json`, `tsconfig*.json`, `vite.config.ts`,
  `vitest.config.ts`, `package.json` scripts, `.lintstagedrc.json`, `.husky/`, `.github/`,
  `.prettierrc`, `.prettierignore`, `.nvmrc` or `.claude/` — ask the owner instead.
- Add `eslint-disable`, `/* eslint rule: … */`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`,
  `as any`, `as unknown as`.
- `git push --force`, `--no-verify`.
- Grow the baseline (`--suppress-all`) — fix the code.

The Claude Code hooks in `.claude/settings.json` enforce these: ESLint runs on every edited file,
`npm run verify` runs before the agent finishes and blocks while it is red (if the agent stops again
without changing anything, the user is warned that verify is red).
