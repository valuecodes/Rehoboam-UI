# AGENTS.md

## Purpose

This document is the repo-level quick-start for coding agents.
Use it for monorepo orientation, shared quality gates, and safe editing workflow.

## Canonical File

- `AGENTS.md` is the source of truth.
- `CLAUDE.md` must be a symbolic link to `AGENTS.md`.
- Never edit `CLAUDE.md` directly. Always update `AGENTS.md`.

## Monorepo Snapshot

- Monorepo: pnpm workspaces (`apps/`, `packages/`, `tooling/`)
- Primary app: Rehoboam-style React UI in `apps/web`
- Package manager: `pnpm` (lockfile: `pnpm-lock.yaml`)
- Required Node version: `24.12.0` (from `.nvmrc`)

## Workspace Map

- App workspace: `apps/web`
- Shared packages: `packages/*`
- Shared tooling configs: `tooling/eslint`, `tooling/prettier`, `tooling/typescript`
- Architecture and project docs: `docs/`

## Workspace Guides

- Web app detailed guidance lives in `apps/web/AGENTS.md`.
- Before changing a workspace, read its local `AGENTS.md` if present.

## Root Commands

Run from repo root unless noted.

- Install dependencies: `pnpm install`
- Dev (all workspaces): `pnpm dev`
- Build (all workspaces): `pnpm build`
- Typecheck (all workspaces): `pnpm typecheck`
- Lint (all workspaces): `pnpm lint`
- Test (all workspaces): `pnpm test`
- Format all files: `pnpm format`
- Format check: `pnpm format:check`
- Run one workspace command: `pnpm --filter <workspace> <script>`

## Quality Gates

CI enforces the following on PRs and `main`:

- `typecheck`
- `lint`
- `format:check`
- `test`

Workflows: `.github/workflows/feature.yml` and `.github/workflows/main.yml`.

## Repo Standards

- TypeScript strict mode via `@repo/typescript`
- ESLint rules via `@repo/eslint` (type-aware)
- Prettier rules via `@repo/prettier`
- Prefer minimal, targeted edits and preserve existing architecture patterns
- Keep docs in `docs/` aligned with behavior and architecture changes

## Safe Agent Workflow

1. Identify target workspace(s) and read local `AGENTS.md` guidance.
2. Make minimal edits in the correct workspace.
3. Run checks for touched scope (`pnpm --filter <workspace> typecheck lint test` when possible).
4. Run root checks when changes span multiple workspaces.
5. Update docs if architecture or behavior changed.
