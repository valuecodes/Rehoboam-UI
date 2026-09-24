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
- App workspaces: Rehoboam UI in `apps/ui`, Cloudflare Worker API in `apps/api`, and Cloudflare Worker Jobs in `apps/jobs`
- Package manager: `pnpm` 11 (lockfile: `pnpm-lock.yaml`), tasks run through Turborepo (`turbo.json`)
- Shared dependency versions: `catalog:` in `pnpm-workspace.yaml` (`catalogMode: strict`)
- Required Node version: `24.12.0` (from `.nvmrc`)

## Workspace Map

- App workspaces: `apps/ui`, `apps/api`, `apps/jobs`
- Shared packages: `packages/*`
- Shared tooling configs: `tooling/prettier`, `tooling/typescript`; lint rules in root `.oxlintrc.json`
- Architecture and project docs: `docs/`

## Workspace Guides

- Web app detailed guidance lives in `apps/ui/AGENTS.md`.
- API app guidance lives in `apps/api/AGENTS.md`.
- Jobs app guidance lives in `apps/jobs/AGENTS.md`.
- Before changing a workspace, read its local `AGENTS.md` if present.

## Root Commands

Run from repo root unless noted.

- Install dependencies: `pnpm install`
- Dev (all workspaces): `pnpm dev`
- Build (all workspaces): `pnpm build`
- Typecheck (all workspaces): `pnpm typecheck`
- Lint (whole repo, root-only): `pnpm lint`
- Test (all workspaces): `pnpm test`
- Format all files: `pnpm format`
- Format check: `pnpm format:check`
- Clean caches and build output: `pnpm clean`
- Run one workspace command: `pnpm --filter <workspace> <script>`

## Quality Gates

CI enforces the following on PRs and `main`:

- `typecheck`
- `lint`
- `format:check`
- `test`

Workflows: `.github/workflows/feature.yml` and `.github/workflows/main.yml`.

## Repo Standards

- TypeScript 7 strict mode via `@repo/typescript` (`noUncheckedIndexedAccess` on, except `apps/ui` for now)
- oxlint rules via root `.oxlintrc.json` (type-aware; suppress with `oxlint-disable-next-line <rule> -- <reason>`)
- Prettier rules via `@repo/prettier`
- Dependencies: exact versions only. A version used by more than one workspace goes in the `catalog:` of `pnpm-workspace.yaml` and is referenced as `"catalog:"`; single-consumer deps stay pinned inline. `@repo/*` deps stay `workspace:*`.
- Prefer minimal, targeted edits and preserve existing architecture patterns
- Keep docs in `docs/` aligned with behavior and architecture changes

## Safe Agent Workflow

1. Identify target workspace(s) and read local `AGENTS.md` guidance.
2. Make minimal edits in the correct workspace.
3. Run checks for touched scope (`pnpm --filter <workspace> typecheck test` when possible, plus root `pnpm lint`).
4. Run root checks when changes span multiple workspaces.
5. Update docs if architecture or behavior changed.
