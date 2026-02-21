---
name: code-reviewer
description: Review repository changes against `main` to find security issues, functional bugs, documentation drift, and convention violations. Use when a user asks for a code review, PR review, change risk assessment, or readiness check before merge.
---

# Code Reviewer

## Overview

Perform a risk-focused review of the current branch compared with `main`.
Prioritize actionable findings in security, correctness, documentation currency, and repository convention compliance.

## Review Workflow

1. Determine review base.
   - Prefer `main`.
   - Fallback to `origin/main` if local `main` does not exist.
   - Use merge-base to avoid unrelated history noise.
2. Collect review scope.
   - List changed files and classify by workspace (`apps/ui`, `apps/api`, `packages/*`, docs, tooling).
   - Read root `AGENTS.md` and touched workspace `AGENTS.md` files before judging conventions.
3. Inspect diff content.
   - Review logic changes file-by-file with emphasis on risky surfaces.
   - Prefer high-signal scans first: auth, permissions, API handlers, database writes, config, scripts, CI, dependencies.
4. Validate evidence.
   - Run targeted checks when feasible (`typecheck`, `lint`, `test`) for touched workspace(s).
   - If checks are not run, state that as residual risk.
5. Produce review output.
   - Report findings first, ordered by severity.
   - Include file paths and line numbers for each finding.
   - Add open questions/assumptions.
   - Finish with a short change summary.

## Diff Commands

Use shell commands equivalent to:

```bash
BASE_BRANCH=main
if ! git rev-parse --verify "$BASE_BRANCH" >/dev/null 2>&1; then
  BASE_BRANCH=origin/main
fi
BASE_COMMIT="$(git merge-base HEAD "$BASE_BRANCH")"
git diff --name-status "$BASE_COMMIT"...HEAD
git diff "$BASE_COMMIT"...HEAD
```

If no valid `main` reference exists, state the limitation and use the best available local upstream reference.

## Priority Checklist

### 1. Security

- Flag missing authorization checks around privileged actions.
- Flag trust of unsanitized input in SQL, shell, template, path, or URL construction.
- Flag secret exposure in source, logs, client bundles, or test fixtures.
- Flag insecure defaults in CORS, cookies, tokens, headers, or environment handling.
- Flag attack-surface expansion without compensating controls.

### 2. Functional Bugs

- Flag logic regressions, state handling mistakes, and incorrect conditionals.
- Flag error-path omissions, null/undefined handling gaps, and race conditions.
- Flag contract breaks between API and consumer types or payload shapes.
- Flag behavior changes without corresponding test updates.

### 3. Documentation Currency

- Verify docs reflect behavior/config/command changes.
- Check `README*`, `docs/**`, workflow docs, and workspace guides when affected.
- Enforce canonical rule: edit `AGENTS.md`, never `CLAUDE.md` directly.
- Flag missing docs updates when commands, paths, architecture, or operator steps changed.

### 4. Repo Conventions

- Verify touched code follows monorepo structure and workspace boundaries.
- Verify naming, script usage, and config patterns align with existing repo style.
- Verify required quality gates are considered: `typecheck`, `lint`, `format:check`, `test`.
- Flag deviations from workspace-specific `AGENTS.md` instructions.

## Required Review Output

Use this structure:

1. Findings
   - `[Severity] <title>` with impact, evidence, and file reference.
2. Open questions or assumptions
3. Change summary
4. Validation status

If there are no findings, explicitly say `No findings.` and list remaining risks (for example: checks not run, unreviewed generated files, or missing runtime verification).
