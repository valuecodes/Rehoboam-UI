# AGENTS.md

## Purpose

This document is the repo-level quick-start for coding agents.
Use it for monorepo orientation, shared quality gates, and safe editing workflow.

## Canonical File

- `AGENTS.md` is the source of truth.
- `CLAUDE.md` must be a symbolic link to `AGENTS.md`.
- Never edit `CLAUDE.md` directly. Always update `AGENTS.md`.

## Monorepo Snapshot

- Monorepo: pnpm workspaces (`apps/`, `packages/`)
- App workspaces: Rehoboam UI in `apps/ui`, Cloudflare Worker API in `apps/api`, and Cloudflare Worker Jobs in `apps/jobs`
- Package manager: `pnpm` 12 (pinned by `packageManager`; lockfile: `pnpm-lock.yaml`), tasks run through Turborepo (`turbo.json`)
- Dependency versions: `catalog:` in `pnpm-workspace.yaml` (`catalogMode: strict`)
- Required Node version: Node 24, exact version in `.nvmrc`

## Workspace Map

- App workspaces: `apps/ui`, `apps/api`, `apps/jobs`
- Shared packages: `packages/*`, including the tsconfig presets in `packages/typescript` (`@repo/typescript`)
- Root tool configs: `.oxlintrc.json` (oxlint), `.oxfmtrc.jsonc` (oxfmt), `knip.jsonc` (knip), `.gitleaks.toml` (gitleaks)
- CI helpers (not workspaces): the composite setup action in `.github/actions/setup/` and the gitleaks script in `.github/scripts/`
- Architecture and project docs: `docs/`

Apps may import packages; packages must never import apps. oxlint bans `../`
imports and deep `@repo/*/src` imports: import other workspaces by package
name, and inside an app use the `~/` alias (`src/*`) to go up the tree.
Packages use package.json `imports` (`#...`) instead, because a tsconfig
`paths` alias would resolve against the consuming app's program.

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
- Unused files, exports and dependencies (whole repo, root-only): `pnpm knip`
- Test (all workspaces): `pnpm test`
- Format all files: `pnpm format`
- Format check: `pnpm format:check`
- Secrets scan over the full git history: `pnpm secrets:scan`
- Clean per-workspace caches, build output and `node_modules`: `pnpm clean`
- Run one workspace command: `pnpm --filter <workspace> <script>`

`lint` and `knip` do not go through Turbo; each is one process over the whole
repo. oxlint prints nothing when there are no findings, so silent output means
clean. There is no post-edit formatting hook: run `pnpm format` yourself before
committing.

`secrets:scan` runs gitleaks (`.github/scripts/secrets-scan.sh`, version pinned
there) using a local `gitleaks` v8.19+ if one is on PATH, otherwise the pinned
Docker image. Known false positives are allowlisted in `.gitleaks.toml`.

## Quality Gates

CI checks are defined once in the reusable `.github/workflows/checks.yml`:
`typecheck`, `lint`, `knip`, `format:check`, `test`, `build`, `e2e`
(Playwright smoke), `secrets-scan`, CodeQL code scanning
(`javascript-typescript`) and workflow-lint (actionlint + zizmor, from
`valuecodes/automation`). `feature.yml` calls it on PRs and `main.yml` on push
to `main`, where the D1 migration and deploy jobs run after it. `all-passed` in
`feature.yml` is the one check to require in branch protection. The typecheck,
test and build jobs restore Turbo's `.turbo` cache from the previous run.

Dependabot (`.github/dependabot.yml`) bumps the SHA-pinned actions monthly in
one grouped PR; npm dependencies are updated by hand.
`maintenance-dashboard.yml` keeps one issue, **Maintenance dashboard**, listing
due `catalog:`, pnpm, gitleaks, Node.js and `pnpm audit` updates. It never opens
PRs. For a Node.js bump, change only `.nvmrc`. The dashboard and workflow-lint
pin the same `valuecodes/automation` commit, so bump them together.

## Repo Standards

- TypeScript 7 strict mode via `@repo/typescript` (`noUncheckedIndexedAccess` on, except `apps/ui` for now)
- oxlint rules via root `.oxlintrc.json` (type-aware; suppress with `oxlint-disable-next-line <rule> -- <reason>`). Notable rules: named exports only, declared first with one export list at the bottom of each file, arrow functions, no `../` imports, max 400 code lines per file, kebab-case filenames.
- Formatting via oxfmt (`.oxfmtrc.jsonc`), which also sorts imports
- Dependencies: exact versions only. Every external version lives in the `catalog:` of `pnpm-workspace.yaml` and manifests reference it as `"catalog:"`; `@repo/*` deps stay `workspace:*`. Add with `pnpm --filter <workspace> add <dep>`, update with `pnpm up --latest -r`. `updateConfig.ignoreDependencies` holds `@types/node` to the `.nvmrc` major, so bump it by hand.
- Every install enforces the supply-chain settings in `pnpm-workspace.yaml` (`minimumReleaseAge`, `trustPolicy: no-downgrade`). When one fails, investigate: never disable it, and never exclude a whole package to get past it.
- Prefer minimal, targeted edits and preserve existing architecture patterns
- Keep docs in `docs/` aligned with behavior and architecture changes

## Safe Agent Workflow

1. Identify target workspace(s) and read local `AGENTS.md` guidance.
2. Make minimal edits in the correct workspace.
3. Run checks for touched scope (`pnpm --filter <workspace> typecheck test` when possible, plus root `pnpm lint` and `pnpm knip`).
4. Run root checks when changes span multiple workspaces.
5. Update docs if architecture or behavior changed.
