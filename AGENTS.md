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
- Root app: `src/app.tsx`
- Scene composition: `src/features/rehoboam/scene/rehoboam-scene.tsx`
- Renderer orchestration: `src/features/rehoboam/render/canvas2d/renderer-2d.ts`
- Divergence pass: `src/features/rehoboam/render/canvas2d/passes/divergence-pass.ts`
- Event callout overlay: `src/features/rehoboam/overlay/callout-overlay.tsx`
- Event list panel: `src/features/rehoboam/overlay/event-list-panel.tsx`
- Data source + pipeline: `src/features/rehoboam/data/source.ts`
- Persistence + boot refresh: `src/features/rehoboam/data/persistence.ts`, `src/features/rehoboam/data/bootstrap.ts`
- Shared event fixture: `src/features/rehoboam/fixtures/mock-events.json`
- Scene quality tiering: `src/features/rehoboam/scene/quality.ts`

## Local Commands

- Install deps: `pnpm install`
- Run dev server (`http://localhost:3000`): `pnpm dev`
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

- The active implementation is V2 under `src/features/rehoboam/**`; legacy V1 source files were removed.
- Scene boot is cache-first via IndexedDB persistence, then mock-source refresh in background.
- Playback sequencing still relies on timers/RAF and refs for interaction synchronization.
- Rendering quality is tiered by viewport/device capability (ring count + divergence samples).

## Safe Agent Workflow

1. Read relevant files in `src/features/rehoboam/**` before changing timeline behavior.
2. Make minimal, targeted edits and preserve existing named-export patterns.
3. Run, at minimum, `pnpm typecheck` and `pnpm lint` after code edits.
4. Run `pnpm format` if formatting drifts, then re-run checks.
5. If behavior changes in animation or timeline sequencing, run `pnpm test` and perform a quick manual dev run (`pnpm dev`).

## Testing State

- No source tests are currently present under `src/`.
- If you add behavior-heavy logic, prefer adding targeted tests alongside the changed module.
