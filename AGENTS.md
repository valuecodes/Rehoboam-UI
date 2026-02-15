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
- Tests: Vitest unit tests + Playwright screenshot flow

## Repository Map

- Entry point: `src/main.tsx`
- Root app: `src/app.tsx`
- Scene composition: `src/features/rehoboam/scene/rehoboam-scene.tsx`
- Scene styles: `src/features/rehoboam/scene/rehoboam-scene.css`
- Scene event cycle helper: `src/features/rehoboam/scene/event-cycle.ts`
- Engine core: `src/features/rehoboam/engine/rehoboam-engine.ts`
- Interaction updates: `src/features/rehoboam/engine/input.ts`
- Renderer orchestration: `src/features/rehoboam/render/canvas2d/renderer-2d.ts`
- Renderer trackers: `src/features/rehoboam/render/canvas2d/divergence-pulse-tracker.ts`, `src/features/rehoboam/render/canvas2d/divergence-cluster-tracker.ts`
- Render passes: `src/features/rehoboam/render/canvas2d/passes/{background,rings,divergence,sweep,event-contour}-pass.ts`
- Divergence pass: `src/features/rehoboam/render/canvas2d/passes/divergence-pass.ts`
- Event callout overlay: `src/features/rehoboam/overlay/callout-overlay.tsx`
- Intro callout overlay: `src/features/rehoboam/overlay/intro-callout-overlay.tsx`
- Event list panel: `src/features/rehoboam/overlay/event-list-panel.tsx`
- Data source + pipeline: `src/features/rehoboam/data/source.ts`
- Data transforms: `src/features/rehoboam/data/normalize.ts`, `src/features/rehoboam/data/dedupe.ts`
- Persistence + boot refresh: `src/features/rehoboam/data/persistence.ts`, `src/features/rehoboam/data/bootstrap.ts`
- Layout math: `src/features/rehoboam/layout/compute-angles.ts`, `src/features/rehoboam/layout/polar.ts`
- Shared event fixture: `src/features/rehoboam/fixtures/mock-events.json`
- Scene quality tiering: `src/features/rehoboam/scene/quality.ts`
- Unit tests root: `src/tests/rehoboam/**`
- Playwright screenshot test: `tests/e2e/screenshot.scene.playwright.ts`

## Documentation

- Architecture reference: `docs/architecture.md`
- Keep docs in `docs/` in sync when behavior/architecture changes.

## Local Commands

- Install deps: `pnpm install`
- Run dev server (`http://localhost:3000`): `pnpm dev`
- Start alias (`http://localhost:3000`): `pnpm start`
- Build: `pnpm build`
- Preview build: `pnpm preview`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Format check: `pnpm format:check`
- Auto-format: `pnpm format`
- Tests: `pnpm test`
- Screenshot tool: `pnpm screenshot:scene`
- Screenshot tool (headed): `pnpm screenshot:scene:headed`

CI enforces `typecheck`, `lint`, `format-check`, and `test` on PRs and `main`
via `.github/workflows/feature.yml` and `.github/workflows/main.yml`.

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
- Active Canvas2D pipeline currently runs background -> rings -> divergence -> sweep each frame.
- `src/features/rehoboam/render/canvas2d/passes/event-contour-pass.ts` exists but is not wired into `Renderer2D`.
- Scene boot is cache-first via IndexedDB persistence, then mock-source refresh in background.
- Playback sequencing still relies on timers/RAF and refs for interaction synchronization.
- Rendering quality is tiered by viewport/device capability (ring count + divergence samples).

## Safe Agent Workflow

1. Read relevant files in `src/features/rehoboam/**` before changing timeline behavior.
2. Read `docs/architecture.md` for current architecture assumptions before changing core engine/render/data behavior.
3. Make minimal, targeted edits and preserve existing named-export patterns.
4. Run, at minimum, `pnpm typecheck` and `pnpm lint` after code edits.
5. Run `pnpm format` if formatting drifts, then re-run checks.
6. If behavior changes in animation or timeline sequencing, run `pnpm test` and perform a quick manual dev run (`pnpm dev`).
7. If architecture or behavior changes, update `docs/architecture.md` and any related docs under `docs/`.

## Testing State

- Unit tests are present under `src/tests/rehoboam/**` (data, layout, engine, renderer, overlay, quality).
- Screenshot-oriented Playwright coverage exists at `tests/e2e/screenshot.scene.playwright.ts`.
- Add targeted tests with behavior-heavy changes when feasible.
