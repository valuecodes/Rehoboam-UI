# AGENTS.md

## Purpose

This document is the Jobs-workspace quick-start for coding agents working in `apps/jobs`.
Use it with the repo-level guide at root: `AGENTS.md`.

## Jobs Workspace Snapshot

- Workspace: `apps/jobs`
- Runtime: Cloudflare Workers + TypeScript
- App type: Non-public cron-only Worker (no HTTP, no Hono)
- Trigger: Cron schedules configured in `wrangler.jsonc`
- Storage: Cloudflare D1 (`DB` binding) with Drizzle ORM migrations in `drizzle/`
- Tests: Vitest

## Architecture Map

- Worker entry (scheduled-only): `src/index.ts`
- Scheduled event dispatcher: `src/scheduled.ts`
- Job registry + types: `src/jobs/index.ts`
- News job: `src/jobs/news-job.ts`
- Database schema: `src/db/schema.ts`
- Database client: `src/clients/database-client.ts`
- Migration config: `drizzle.config.ts`
- Worker config and cron triggers: `wrangler.jsonc`
- Generated Cloudflare env types: `worker-configuration.d.ts`

## Implementation Notes

- `src/index.ts` exports only `{ scheduled }` — no `fetch` export. The `--test-scheduled` flag in the dev script handles local cron testing via `/__scheduled`.
- `src/scheduled.ts` receives cron events, looks up matching jobs from the registry via `controller.cron`, and runs them with `Promise.allSettled` so failures are isolated.
- Jobs declare their cron pattern and are registered in `src/jobs/index.ts`. Adding a new job requires creating a file in `src/jobs/` and adding it to the registry array.
- `JobRegistry` constructs `DatabaseClient` using `env.DB`; jobs that persist data should depend on injected clients instead of creating their own runtime bindings.

## Jobs Commands

Run from repo root:

- Dev: `pnpm --filter rehoboam-jobs dev`
- Deploy Worker: `pnpm --filter rehoboam-jobs run deploy`
- Regenerate Worker env types: `pnpm --filter rehoboam-jobs cf-typegen`
- Typecheck: `pnpm --filter rehoboam-jobs typecheck`
- Lint: `pnpm --filter rehoboam-jobs lint`
- Test: `pnpm --filter rehoboam-jobs test`
- Generate migration: `pnpm --filter rehoboam-jobs db:generate`
- Apply migrations (local): `pnpm --filter rehoboam-jobs db:migrate:local`
- Apply migrations (remote): `pnpm --filter rehoboam-jobs db:migrate:remote`
- Trigger cron locally: `curl http://localhost:3002/__scheduled?cron=0+*/6+*+*+*`

## Jobs Code Standards

- Follow repo TypeScript strictness and `@repo/eslint` rules.
- Named exports are preferred; keep default export only in `src/index.ts` for Cloudflare runtime.
- Each job must declare its `cron` pattern matching a pattern in `wrangler.jsonc` triggers.

## Safe Workflow For Jobs Changes

1. Read `src/index.ts`, `src/scheduled.ts`, and relevant job files before edits.
2. If adding a new cron schedule, update both `wrangler.jsonc` and the job's `cron` field.
3. If changing Cloudflare bindings/config, update `wrangler.jsonc` and run `pnpm --filter rehoboam-jobs cf-typegen`.
4. If changing schema, update `src/db/schema.ts`, generate migrations in `drizzle/`, and validate locally with `pnpm --filter rehoboam-jobs db:migrate:local`.
5. For production schema rollout, trigger `.github/workflows/migrations.yml` (`Migrations`, job `migrate-jobs-d1`) after merge.
6. Make minimal edits and preserve existing job registry + dispatcher composition.
7. Run at minimum: `pnpm --filter rehoboam-jobs typecheck`, `pnpm --filter rehoboam-jobs lint`, and `pnpm --filter rehoboam-jobs test`.
