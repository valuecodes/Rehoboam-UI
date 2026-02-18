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
pnpm --filter api dev
```

Default local URL: `http://localhost:3001`

For full stack local dev (web + api in parallel), run:

```bash
pnpm dev
```

The web app in `apps/web` proxies `/api/*` requests to
`http://localhost:3001`.

## Workspace Scripts

- `pnpm --filter api dev` - start Wrangler local worker on port `3001`
- `pnpm --filter api start` - start Wrangler local worker with Wrangler defaults
- `pnpm --filter api deploy` - deploy Worker
- `pnpm --filter api cf-typegen` - generate `worker-configuration.d.ts`
- `pnpm --filter api typecheck` - run TypeScript checks
- `pnpm --filter api lint` - run ESLint
- `pnpm --filter api test` - run Vitest

## Project Structure

- Router entry: `src/index.ts`
- Events route: `src/routes/events.ts`
- Worker config: `wrangler.jsonc`
