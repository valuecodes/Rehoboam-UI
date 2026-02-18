---
name: docs-sync
description: Synchronize and update documentation across this pnpm-workspace monorepo. Use when requests involve updating docs, propagating command/path/config changes, validating doc consistency, or editing README, AGENTS.md, CLAUDE.md, .codex, .claude, .cursor, docs, or .github instruction files.
---

# Docs Sync

Keep documentation synchronized across root, workspace, and tooling docs so commands and conventions do not drift.

## Repo Rules

- Treat `AGENTS.md` as canonical. Keep `CLAUDE.md` as a symlink to `AGENTS.md`.
- Never edit `CLAUDE.md` directly. Edit `AGENTS.md` and verify the symlink still points correctly.
- Apply minimal, targeted edits. Remove stale content instead of leaving contradictory notes.

## Scope

Consider all relevant documentation targets:

- `README*` (root and workspace)
- `docs/**`
- `**/AGENTS.md`
- `**/CLAUDE.md` (verify link targets, do not directly edit)
- `.codex/**`
- `.claude/**`
- `.cursor/**`
- `.github/**` including workflow docs and `copilot-instructions.md`
- workspace docs such as `apps/*/README.md` and `packages/*/README.md`

## Workflow

1. Find impacted docs.
   - Prefer fast scan commands, for example:
   - `rg --files -g 'README*' -g 'docs/**' -g '**/AGENTS.md' -g '**/CLAUDE.md' -g '.codex/**' -g '.claude/**' -g '.cursor/**' -g '.github/**'`
2. Build a propagation list.
   - For every changed command/path/config/pattern, list all files that reference it.
   - Do not stop after updating the first file.
3. Update references consistently.
   - Apply the same terminology and command syntax everywhere relevant.
   - If an `AGENTS.md` rule changes, update linked guidance files that mirror it.
4. Add or adjust short explanations.
   - Include what changed and why, especially for commands or config behavior.
5. Validate formatting and checks from repo root.
   - `pnpm format`
   - `pnpm lint`
   - `pnpm typecheck`
   - Run `pnpm test` when doc updates affect behavior descriptions, test commands, or validation expectations.
6. Summarize with explicit output sections.

## Writing Guidelines

- Keep docs concise and scannable.
- Prefer concrete commands and examples.
- Use consistent names for workspaces, scripts, and directories.
- Update dates/versions when present.
- Remove obsolete sections instead of leaving TODO-style placeholders.

## Required Final Output

Always finish with:

- `Files changed`: list each documentation file updated.
- `What to review`: call out text that needs human wording/accuracy review.
- `Validation status`: report results for `pnpm format`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` (if run).
