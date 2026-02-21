# AGENTS.md

## Purpose

This document is the API-workspace quick-start for coding agents working in `apps/api`.
Use it with the repo-level guide at root: `AGENTS.md`.

## API Workspace Snapshot

- Workspace: `apps/api`
- Runtime: Cloudflare Workers + Hono + TypeScript
- App type: Worker API that serves timeline events for `apps/web`
- Primary endpoint: `GET /api/events`
- Contract source: `@repo/types` (`EventsResponseSchema`)
- Tests: Vitest (middleware-focused)

## Architecture Map

- Worker entry + route wiring: `src/index.ts`
- Events route: `src/routes/events.ts`
- Request logger middleware: `src/middleware/logger.ts`
- Error + not-found handlers: `src/middleware/error-handlers.ts`
- Worker/Hono app env typing: `src/types.ts`
- Middleware tests: `src/middleware/__tests__/logger.test.ts`
- Worker config and route deployment: `wrangler.jsonc`
- Generated Cloudflare env types: `worker-configuration.d.ts`

## Implementation Notes

- `src/index.ts` wires `loggerMiddleware` globally, installs `onErrorHandler`, mounts `/api/events`, and defines `notFoundHandler`.
- The Worker must default-export the Hono app for Cloudflare runtime compatibility.
- `loggerMiddleware` sets `logger` and `requestId` in context variables; downstream handlers depend on these values.
- `src/routes/events.ts` validates the response with `EventsResponseSchema.parse(...)` before returning JSON.
- Current data source is in-file `mockEvents`; treat this as the active behavior unless explicitly migrating to storage or external APIs.
- If `wrangler.jsonc` bindings change, regenerate `worker-configuration.d.ts`.

## API Commands

Run from repo root:

- Dev (`http://localhost:3001`): `pnpm --filter rehoboam-api dev`
- Start (Wrangler default dev): `pnpm --filter rehoboam-api start`
- Deploy Worker: `pnpm --filter rehoboam-api deploy`
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
2. If changing API payload shape, update `@repo/types` and verify `apps/web` consumers.
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
