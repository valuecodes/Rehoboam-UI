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
- AI: Cloudflare Workers AI (`AI` binding) for news processing
- Tests: Vitest

## Architecture Map

- Worker entry (scheduled-only): `src/index.ts`
- Scheduled event dispatcher: `src/scheduled.ts`
- Job registry + types: `src/jobs/index.ts`
- News job: `src/jobs/news-job.ts`
- AI client (Workers AI, `@cf/meta/llama-3.1-8b-instruct-fast` with JSON Mode): `src/clients/ai-client.ts`
- Database client: `src/clients/database-client.ts`
- Database schema: `@repo/db` (shared package at `packages/db`, includes `newsItems` and `events` tables)
- Drizzle Kit config: `drizzle.config.ts`
- Worker config and cron triggers: `wrangler.jsonc` (production), `wrangler.local.jsonc` (mock AI local dev), `wrangler.remote-dev.jsonc` (real AI local dev)
- Generated Cloudflare env types: `worker-configuration.d.ts`

## Implementation Notes

- `src/index.ts` exports only `{ scheduled }` — no `fetch` export. The `--test-scheduled` flag in the dev script handles local cron testing via `/__scheduled`.
- `src/scheduled.ts` receives cron events, looks up matching jobs from the registry via `controller.cron`, and runs them with `Promise.allSettled` so failures are isolated.
- `src/scheduled.ts` initializes `Logger` at `info` level for cron runs, so debug-only service logs are suppressed unless you intentionally lower the threshold.
- Jobs declare their cron pattern and are registered in `src/jobs/index.ts`. Adding a new job requires creating a file in `src/jobs/` and adding it to the registry array.
- `JobRegistry` constructs `DatabaseClient` using `env.DB` and selects `AiClient` or `MockAiClient` based on the runtime bindings (`MOCK_AI=true` or missing `env.AI` uses the mock client); jobs that persist data should depend on injected clients instead of creating their own runtime bindings.
- Production `wrangler.jsonc` sets `AI_ITEM_LIMIT=50` to bound Workers AI usage per cron run; local dev configs override this with a smaller limit.
- `AiClient` processes news items with Workers AI (`@cf/meta/llama-3.1-8b-instruct-fast`) using JSON Mode: it requests a JSON schema response, prefers the structured `response` payload, and falls back to parsing returned text when needed. Results are stored in the `events` table. Fallback logic ensures the pipeline continues if AI is unavailable.
- The `events` table links to `news_items` via `news_item_id` FK with cascade delete. A `skipped` boolean distinguishes AI-filtered items from relevant events. The API reads only non-skipped events.
- `news_items.ai_reserved_at` is set before AI processing begins so a failed event write does not repeatedly rebill the same backlog on later cron runs.
- `NewsService.fetch()` applies an 8-second timeout per source and returns an empty result on timeout or fetch failure so one feed cannot stall the job.

## Jobs Commands

Run from repo root:

- Dev (mock AI, no Cloudflare auth required): `pnpm --filter rehoboam-jobs dev`
- Dev (real Workers AI, capped to a few items locally): `pnpm --filter rehoboam-jobs dev:remote`
- Deploy Worker: `pnpm --filter rehoboam-jobs run deploy`
- Regenerate Worker env types: `pnpm --filter rehoboam-jobs cf-typegen`
- Typecheck: `pnpm --filter rehoboam-jobs typecheck`
- Lint: `pnpm --filter rehoboam-jobs lint`
- Test: `pnpm --filter rehoboam-jobs test`
- Generate migration: `pnpm --filter rehoboam-jobs db:generate`
- Clear local D1 data: `pnpm --filter rehoboam-jobs db:clear:local`
- Apply migrations (local): `pnpm --filter rehoboam-jobs db:migrate:local`
- Apply migrations (remote): `pnpm --filter rehoboam-jobs db:migrate:remote`
- Trigger cron locally: `curl http://localhost:3002/__scheduled?cron=0+9+*+*+*`

## Jobs Code Standards

- Follow repo TypeScript strictness and `@repo/eslint` rules.
- Named exports are preferred; keep default export only in `src/index.ts` for Cloudflare runtime.
- Each job must declare its `cron` pattern matching a pattern in `wrangler.jsonc` triggers.

## Safe Workflow For Jobs Changes

1. Read `src/index.ts`, `src/scheduled.ts`, and relevant job files before edits.
2. If adding a new cron schedule, update both `wrangler.jsonc` and the job's `cron` field.
3. If changing Cloudflare bindings/config, update `wrangler.jsonc` and run `pnpm --filter rehoboam-jobs cf-typegen`.
4. If changing schema, update `packages/db/src/schema.ts` (shared via `@repo/db`), generate migrations in `drizzle/`, and validate locally with `pnpm --filter rehoboam-jobs db:migrate:local`.
5. For production schema rollout, merge to `main` so `.github/workflows/main.yml` runs `migrate-jobs-d1` before worker deploys; use `.github/workflows/migrations.yml` only for manual retries/backfills.
6. Make minimal edits and preserve existing job registry + dispatcher composition.
7. Run at minimum: `pnpm --filter rehoboam-jobs typecheck`, `pnpm --filter rehoboam-jobs lint`, and `pnpm --filter rehoboam-jobs test`.
