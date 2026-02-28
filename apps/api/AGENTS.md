# AGENTS.md

## Purpose

This document is the API-workspace quick-start for coding agents working in `apps/api`.
Use it with the repo-level guide at root: `AGENTS.md`.

## API Workspace Snapshot

- Workspace: `apps/api`
- Runtime: Cloudflare Workers + Hono + TypeScript
- App type: Worker API that serves timeline events for `apps/ui`
- Primary endpoint: `GET /api/events`
- Contract source: `@repo/types` (`EventsResponseSchema`)
- Data source: D1 database (`rehoboam-jobs-db`, shared with `apps/jobs`)
- Database schema: `@repo/db` (shared package)
- Tests: Vitest (middleware + database client)

## Architecture Map

- Worker entry + route wiring: `src/index.ts`
- Events route: `src/routes/events.ts`
- Request logger middleware: `src/middleware/logger.ts`
- Security middleware (CORS, secure headers): `src/middleware/security.ts`
- Cache middleware (ETag, Cloudflare Cache API, Cache-Control): `src/middleware/cache.ts`
- Error + not-found handlers: `src/middleware/error-handlers.ts`
- Database client (Drizzle ORM, D1): `src/clients/database-client.ts`
- Worker/Hono app env typing: `src/types.ts`
- Database client tests: `src/clients/__tests__/database-client.test.ts`
- Middleware tests: `src/middleware/__tests__/logger.test.ts`, `src/middleware/__tests__/security.test.ts`, `src/middleware/__tests__/cache.test.ts`
- Worker config and route deployment: `wrangler.jsonc`
- Generated Cloudflare env types: `worker-configuration.d.ts`

## Implementation Notes

- `src/index.ts` wires security middleware (`secureHeadersMiddleware`, `corsMiddleware`), then `loggerMiddleware`, `etagMiddleware`, a default no-store fallback for responses that don't set `Cache-Control`, and cache middleware for `/api/events`. Logger sets `X-Request-Id` after downstream middleware so cached responses can still receive a fresh per-request ID without persisting stale IDs in cache. Installs `onErrorHandler`, mounts `/api/events`, and defines `notFoundHandler`.
- The Worker must default-export the Hono app for Cloudflare runtime compatibility.
- `loggerMiddleware` sets `logger` and `requestId` in context variables and exposes `X-Request-Id` on the response; downstream handlers depend on these values.
- `security.ts` configures CORS (allowed origins: production domain and localhost:3000) and secure response headers via Hono built-ins.
- `cache.ts` provides two caching layers: `etagMiddleware` (global, weak ETags for conditional requests) and `createCacheMiddleware` (per-route, Cloudflare Cache API with `vary: "Origin"` so cached responses are keyed per origin, preventing CORS cache poisoning). The `cacheControl` utility allows setting custom `Cache-Control` directives per route.
- `src/routes/events.ts` returns the already-validated payload from `DatabaseClient`; `src/clients/database-client.ts` validates and normalizes rows with `EventPublishedAtSchema` and `EventsResponseSchema` before the route responds.
- Events are sourced from the `events` table in D1 (`rehoboam-jobs-db`) via `DatabaseClient`. The `apps/jobs` worker fetches news, processes them with Workers AI (filtering, title shortening, location extraction, severity/category assignment), and stores the results in the `events` table. The API prefers non-skipped events, mapping `locationLabel` to `location` (with `"Unknown"` fallback) and passing through AI-assigned `severity` and `category`. If the `events` table has no rows yet, it falls back to the latest `news_items` rows and serves them as `"general"` / `"medium"` timeline entries with `"Unknown"` location. If processed rows exist but all are skipped, the API returns an empty array rather than resurfacing filtered items. Results are capped at 50 items ordered by `publishedAt` descending.
- Database schema is shared via `@repo/db` package (used by both `apps/api` and `apps/jobs`).
- If `wrangler.jsonc` bindings change, regenerate `worker-configuration.d.ts`.

## API Commands

Run from repo root:

- Dev (`http://localhost:3001`): `pnpm --filter rehoboam-api dev`
- Start (Wrangler default dev): `pnpm --filter rehoboam-api start`
- Deploy Worker: `pnpm --filter rehoboam-api run deploy`
- Regenerate Worker env types: `pnpm --filter rehoboam-api cf-typegen`
- Typecheck: `pnpm --filter rehoboam-api typecheck`
- Lint: `pnpm --filter rehoboam-api lint`
- Test: `pnpm --filter rehoboam-api test`

## API Code Standards

- Follow repo TypeScript strictness and `@repo/eslint` rules.
- Named exports are preferred; keep default export only where Cloudflare runtime requires it (`src/index.ts`).
- Keep request/response contracts aligned with `@repo/types`.
- Preserve `AppEnv` context typing when adding middleware or handlers.

## Safe Workflow For API Changes

1. Read `src/index.ts` and the relevant route/middleware files before edits.
2. If changing API payload shape, update `@repo/types` and verify `apps/ui` consumers.
3. If changing Cloudflare bindings/config, update `wrangler.jsonc` and run `pnpm --filter rehoboam-api cf-typegen`.
4. Make minimal edits and preserve existing route + middleware composition.
5. Run at minimum: `pnpm --filter rehoboam-api typecheck`, `pnpm --filter rehoboam-api lint`, and `pnpm --filter rehoboam-api test`.
6. Update `apps/api/README.md` and relevant docs in `docs/` when behavior or contracts change.

## Cloudflare Docs Requirement

Before Workers platform changes, verify the latest docs and limits:

- Workers docs: `https://developers.cloudflare.com/workers/`
- Platform limits: `https://developers.cloudflare.com/workers/platform/limits/`
- Node.js compatibility: `https://developers.cloudflare.com/workers/runtime-apis/nodejs/`
- Worker errors: `https://developers.cloudflare.com/workers/observability/errors/`
