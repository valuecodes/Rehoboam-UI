# AGENTS.md

## Purpose

This document is the web-app-specific quick-start for coding agents working in `apps/ui`.
Use it with the repo-level guide at the root: `AGENTS.md`.

## Web App Snapshot

- Workspace: `apps/ui`
- Runtime: React 19 + Vite 7 + TypeScript 5
- App type: Rehoboam-style animated timeline UI
- Tests: Vitest unit tests + Playwright screenshot flow

## Architecture Map

- Entry point: `src/main.tsx`
- Root app: `src/app.tsx`
- Scene composition: `src/features/rehoboam/scene/rehoboam-scene.tsx`
- Scene styles: `src/features/rehoboam/scene/rehoboam-scene.css`
- Scene event cycle helper: `src/features/rehoboam/scene/event-cycle.ts`
- Scene quality tiering: `src/features/rehoboam/scene/quality.ts`
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
- Shared fixture: `src/features/rehoboam/fixtures/mock-events.json`
- Unit tests: `src/tests/rehoboam/**`
- Playwright screenshot test: `tests/e2e/screenshot.scene.playwright.ts`

## Implementation Notes

- Active implementation is V2 under `src/features/rehoboam/**`; legacy V1 sources were removed.
- Current Canvas2D frame pipeline: background -> rings -> divergence -> sweep.
- `src/features/rehoboam/render/canvas2d/passes/event-contour-pass.ts` exists but is not wired into `Renderer2D`.
- Scene boot is cache-first via IndexedDB persistence, then API refresh via `/api/events` in background.
- Playback sequencing relies on timers/RAF and refs for interaction synchronization.
- Rendering quality is tiered by viewport/device capability (ring count + divergence samples).

## Web Commands

Run from repo root:

- Dev server (`http://localhost:3000`): `pnpm --filter rehoboam-ui dev`
- Start alias (`http://localhost:3000`): `pnpm --filter rehoboam-ui start`
- Build: `pnpm --filter rehoboam-ui build`
- Bundle analysis: `pnpm --filter rehoboam-ui bundle:analyze`
- Preview build: `pnpm --filter rehoboam-ui preview`
- Typecheck: `pnpm --filter rehoboam-ui typecheck`
- Lint: `pnpm --filter rehoboam-ui lint`
- Unit tests: `pnpm --filter rehoboam-ui test`
- Screenshot tool: `pnpm --filter rehoboam-ui screenshot:scene`
- Screenshot tool (headed): `pnpm --filter rehoboam-ui screenshot:scene:headed`

## Web Code Standards

- TypeScript strict mode is enabled.
- `import/no-default-export` is enabled: use named exports.
- Prefer `type` imports where applicable.
- `@typescript-eslint/no-non-null-assertion` is enabled.
- Function declarations are disallowed via `func-style`; use function expressions/arrow functions.

## Safe Workflow For Web Changes

1. Read relevant files in `src/features/rehoboam/**` before changing timeline behavior.
2. Read `docs/architecture.md` before changing core engine/render/data behavior.
3. Make minimal edits and preserve existing named-export patterns.
4. Run at minimum: `pnpm --filter rehoboam-ui typecheck` and `pnpm --filter rehoboam-ui lint`.
5. Run `pnpm format` from root if formatting drifts, then re-run checks.
6. If animation/timeline behavior changes, run `pnpm --filter rehoboam-ui test` and do a quick manual run (`pnpm --filter rehoboam-ui dev`).
7. If architecture or behavior changes, update `docs/architecture.md` and related docs in `docs/`.

## Testing State

- Unit tests exist under `src/tests/rehoboam/**` (data, layout, engine, renderer, overlay, quality).
- Screenshot-oriented Playwright coverage exists at `tests/e2e/screenshot.scene.playwright.ts`.
- Add targeted tests for behavior-heavy changes when feasible.
