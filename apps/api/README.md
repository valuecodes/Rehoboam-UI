# Rehoboam API

Cloudflare Worker API workspace for timeline events consumed by `apps/web`.

## Endpoint

- `GET /api/events`
- Response body is a JSON array with this shape:

```json
[
  {
    "id": "dotcom-bubble-burst",
    "date": "2000-03-10",
    "title": "Dot-com bubble burst",
    "location": "New York",
    "severity": "high"
  }
]
```

`severity` is one of `low | medium | high | critical`.

## Local Development

Run from repo root:

```bash
pnpm --filter rehoboam-api dev
```

Default local URL: `http://localhost:3001`

For full stack local dev (web + api in parallel), run:

```bash
pnpm dev
```

The web app in `apps/web` proxies `/api/*` requests to
`http://localhost:3001`.

## Workspace Scripts

- `pnpm --filter rehoboam-api dev` - start Wrangler local worker on port `3001`
- `pnpm --filter rehoboam-api start` - start Wrangler local worker with Wrangler defaults
- `pnpm --filter rehoboam-api deploy` - deploy Worker
- `pnpm --filter rehoboam-api cf-typegen` - generate `worker-configuration.d.ts`
- `pnpm --filter rehoboam-api typecheck` - run TypeScript checks
- `pnpm --filter rehoboam-api lint` - run ESLint
- `pnpm --filter rehoboam-api test` - run Vitest

## Project Structure

- Router entry: `src/index.ts`
- Events route: `src/routes/events.ts`
- Worker config: `wrangler.jsonc`
