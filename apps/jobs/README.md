# Rehoboam Jobs

Cloudflare Worker jobs workspace for scheduled background tasks.

## What It Does

- Runs cron-triggered jobs (no public HTTP API)
- Dispatches scheduled events to registered jobs in `src/jobs`
- Executes matching jobs in parallel with isolated failures via `Promise.allSettled`
- Applies an 8-second per-source timeout to external news feed fetches so slow providers do not block the full run

## Database (Cloudflare D1)

News items are persisted to a D1 SQLite database using Drizzle ORM. The database schema is shared via the `@repo/db` package (also used by `apps/api` to read news items).

### First-Time Setup

1. Create the D1 database:
   ```bash
   wrangler d1 create rehoboam-jobs-db
   ```
2. Copy the returned `database_id` into `wrangler.jsonc` (replace `<YOUR_DATABASE_ID>` before deploying)
3. Apply the migration locally:
   ```bash
   pnpm --filter rehoboam-jobs db:migrate:local
   ```

### Database Scripts

- `pnpm --filter rehoboam-jobs db:generate` - generate a new migration from schema changes in `@repo/db`
- `pnpm --filter rehoboam-jobs db:migrate:local` - apply migrations to local D1
- `pnpm --filter rehoboam-jobs db:migrate:remote` - apply migrations to production D1 (used automatically in `.github/workflows/main.yml`, and by manual GitHub workflow `Migrations` for retries/backfills)

### Schema Change Workflow

1. Edit the schema in `packages/db/src/schema.ts` (shared via `@repo/db`)
2. `pnpm --filter rehoboam-jobs db:generate` — creates a new `.sql` file in `drizzle/`
3. `pnpm --filter rehoboam-jobs db:migrate:local` — apply to local DB for testing
4. Merge to `main` — `.github/workflows/main.yml` runs `migrate-jobs-d1` before `deploy-api` and `deploy-jobs`
5. Use the manual GitHub Actions workflow `Migrations` only for retries/backfills when an explicit rerun is needed

### Production Migration Runbook

1. Merge schema/code changes to `main`
2. Verify `.github/workflows/main.yml` completes `migrate-jobs-d1` before `deploy-api` and `deploy-jobs`
3. If the automatic migration needs a manual retry or backfill, trigger GitHub Actions workflow `Migrations` with the target ref (`ref` input defaults to `main`)
4. Approve the `production` environment gate and verify migration logs

## Local Development

Run from repo root:

```bash
pnpm --filter rehoboam-jobs dev
```

This uses a local mock AI client by default, so it does not require Cloudflare authentication.
For a real Workers AI-backed local run, use:

```bash
pnpm --filter rehoboam-jobs dev:remote
```

Both local dev modes cap AI processing to 3 unprocessed items per run. Production caps AI processing to 50 items per run.

Default local URL for scheduled testing: `http://localhost:3002`

Trigger cron locally:

```bash
curl "http://localhost:3002/__scheduled?cron=0+9+*+*+*"
```

## Workspace Scripts

- `pnpm --filter rehoboam-jobs dev` - start Wrangler local worker on port `3002` with scheduled testing enabled, mock AI enabled, and AI processing capped to 3 items
- `pnpm --filter rehoboam-jobs dev:remote` - start Wrangler local worker against the real Workers AI binding with AI processing capped to 3 items
- `pnpm --filter rehoboam-jobs start` - start Wrangler local worker with defaults
- `pnpm --filter rehoboam-jobs deploy` - deploy Worker code only (no remote migrations)
- `pnpm --filter rehoboam-jobs cf-typegen` - generate `worker-configuration.d.ts`
- `pnpm --filter rehoboam-jobs typecheck` - run TypeScript checks
- `pnpm --filter rehoboam-jobs lint` - run ESLint
- `pnpm --filter rehoboam-jobs test` - run Vitest
- `pnpm --filter rehoboam-jobs db:generate` - generate migration from schema
- `pnpm --filter rehoboam-jobs db:clear:local` - delete all local `news_items` rows (and cascaded `events`)
- `pnpm --filter rehoboam-jobs db:migrate:local` - apply migrations locally
- `pnpm --filter rehoboam-jobs db:migrate:remote` - apply migrations to production

## Project Structure

- Worker entry (scheduled-only): `src/index.ts`
- Scheduled dispatcher: `src/scheduled.ts`
- Job registry and contract: `src/jobs/index.ts`
- Jobs implementations: `src/jobs/*`
- Database schema: `@repo/db` (shared package at `packages/db`)
- Database client: `src/clients/database-client.ts`
- Drizzle Kit config: `drizzle.config.ts`
- Migrations: `drizzle/`
- Worker runtime and cron triggers: `wrangler.jsonc` (production), `wrangler.local.jsonc` (mock AI local dev), and `wrangler.remote-dev.jsonc` (real AI local dev)
