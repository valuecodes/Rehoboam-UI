# Rehoboam Jobs

Cloudflare Worker jobs workspace for scheduled background tasks.

## What It Does

- Runs cron-triggered jobs (no public HTTP API)
- Dispatches scheduled events to registered jobs in `src/jobs`
- Executes matching jobs in parallel with isolated failures via `Promise.allSettled`

## Local Development

Run from repo root:

```bash
pnpm --filter rehoboam-jobs dev
```

Default local URL for scheduled testing: `http://localhost:3002`

Trigger cron locally:

```bash
curl "http://localhost:3002/__scheduled?cron=0+*/6+*+*+*"
```

## Workspace Scripts

- `pnpm --filter rehoboam-jobs dev` - start Wrangler local worker on port `3002` with scheduled testing enabled
- `pnpm --filter rehoboam-jobs start` - start Wrangler local worker with defaults
- `pnpm --filter rehoboam-jobs deploy` - deploy Worker
- `pnpm --filter rehoboam-jobs cf-typegen` - generate `worker-configuration.d.ts`
- `pnpm --filter rehoboam-jobs typecheck` - run TypeScript checks
- `pnpm --filter rehoboam-jobs lint` - run ESLint
- `pnpm --filter rehoboam-jobs test` - run Vitest

## Project Structure

- Worker entry (scheduled-only): `src/index.ts`
- Scheduled dispatcher: `src/scheduled.ts`
- Job registry and contract: `src/jobs/index.ts`
- Jobs implementations: `src/jobs/*`
- Worker runtime and cron triggers: `wrangler.jsonc`
