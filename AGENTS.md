# AGENTS.md

## Purpose

This document is a quick-start guide for coding agents working in this repository.
It summarizes the current architecture, quality gates, and safe editing workflow.

## Canonical File

- `AGENTS.md` is the source of truth.
- `CLAUDE.md` must be a symbolic link to `AGENTS.md`.
- Never edit `CLAUDE.md` directly. Always update `AGENTS.md`.

## Project Snapshot

- App: Rehoboam-style React UI with animated timeline events
- Runtime: React 19 + Vite 7 + TypeScript 5
- Package manager: `pnpm` (lockfile is `pnpm-lock.yaml`)
- Required Node version: `24.12.0` (from `.nvmrc`)

## Repository Map

- Entry point: `src/main.tsx`
- Root app: `src/App.tsx`
- Main composition: `src/components/mainsection/reheboam.tsx`
- Animation/timeline control: `src/components/mainsection/animation/animation.tsx`
- Canvas ring rendering: `src/components/mainsection/animation/canvas.tsx`
- Event overlay UI: `src/components/mainsection/divergency/mainSVG.tsx`
- Event details panel: `src/components/mainsection/divergency/divergengy.tsx`
- Custom event creation UI: `src/components/mainsection/navigation/create/create.tsx`
- Timeline data: `src/components/mainsection/data/corona.json`
- Shared types: `src/types.ts`

## Local Commands

- Install deps: `pnpm install`
- Run dev server: `pnpm dev`
- Build: `pnpm build`
- Preview build: `pnpm preview`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Format check: `pnpm format:check`
- Auto-format: `pnpm format`
- Tests: `pnpm test`

CI enforces `typecheck`, `lint`, `format-check`, and `test` on PRs and `main`.

## Code Standards (Repo-Specific)

- TypeScript strict mode is enabled in `tsconfig.json`.
- ESLint is strict and includes type-aware rules.
- `import/no-default-export` is enabled: use named exports.
- Prefer `type` imports where applicable (`@typescript-eslint/consistent-type-imports`).
- `@typescript-eslint/no-non-null-assertion` is enabled.
- Function declarations are disallowed via `func-style`; prefer function expressions/arrow functions.
- Prettier is configured with sorted imports (`@ianvs/prettier-plugin-sort-imports`).

## Implementation Notes

- The app relies on fixed geometry centered around an 800x800 visualization.
- Playback sequencing in `animation.tsx` uses timers (`setInterval`/`setTimeout`) and refs for state synchronization.
- Positioning in `reheboam.tsx` is computed from DOM measurements and screen width checks.
- A typo in folder/file naming is intentional and currently part of the codebase: `divergency/divergengy.tsx`.
  Keep existing imports/paths consistent unless deliberately refactoring.

## Safe Agent Workflow

1. Read relevant files in `src/components/mainsection/**` before changing timeline behavior.
2. Make minimal, targeted edits and preserve existing named-export patterns.
3. Run, at minimum, `pnpm typecheck` and `pnpm lint` after code edits.
4. Run `pnpm format` if formatting drifts, then re-run checks.
5. If behavior changes in animation or timeline sequencing, run `pnpm test` and perform a quick manual dev run (`pnpm dev`).

## Testing State

- No source tests are currently present under `src/`.
- If you add behavior-heavy logic, prefer adding targeted tests alongside the changed module.
