# Rehoboam UI

A React app inspired by the "Rehoboam" interface from Westworld TV series.

![Preview](./apps/web/public/preview.jpg)

- Explore a timeline of major world events with Rehoboam-style animation.
- Inspect active signals through synchronized callouts and the event list panel.

## Tech Stack

- React 19
- Vite 7
- TypeScript 5
- ESLint 9
- Prettier 3
- Vitest 4
- pnpm 10

## Requirements

- Node.js `24.12.0` (see `.nvmrc`)
- pnpm `10+`

## Local Development

```bash
pnpm install
pnpm dev
```

Dev server URL: `http://localhost:3000`

## Build and Preview

```bash
pnpm build
pnpm preview
```

## Quality Checks

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

## Playwright Screenshots

Use the local screenshot tool for fast UI iteration snapshots:

```bash
pnpm --filter web screenshot:scene
```

Default outputs:

- full page: `apps/web/.tmp/screenshots/current-codex-auto.png`
- scene element: `apps/web/.tmp/screenshots/current-codex-auto.instrument.png`

Useful options:

```bash
pnpm --filter web screenshot:scene -- --output .tmp/screenshots/current-codex-auto.png
pnpm --filter web screenshot:scene -- --width 1365 --height 1024 --settle-ms 250
pnpm --filter web screenshot:scene -- --base-url http://127.0.0.1:3001
pnpm --filter web screenshot:scene:headed
```

Equivalent environment variables:

- `SCREENSHOT_OUTPUT_BASE`
- `SCREENSHOT_VIEWPORT_WIDTH`
- `SCREENSHOT_VIEWPORT_HEIGHT`
- `SCREENSHOT_SETTLE_MS`
- `SCREENSHOT_BASE_URL`
- `SCREENSHOT_HEADLESS`

The command uses a dedicated screenshot server on port `3001` by default,
waits for `.rehoboam-scene__instrument` to be visible, and then applies a
short settle delay before capturing.

## Scripts

- `pnpm dev` - run the Vite dev server on port `3000`
- `pnpm start` - alias for `pnpm dev` (port `3000`)
- `pnpm build` - create production build
- `pnpm preview` - preview the production build
- `pnpm typecheck` - run TypeScript checks
- `pnpm lint` - run ESLint
- `pnpm format` - auto-format files with Prettier
- `pnpm format:check` - verify formatting
- `pnpm test` - run tests with Vitest
- `pnpm --filter web screenshot:scene` - capture deterministic full + scene screenshots
- `pnpm --filter web screenshot:scene:headed` - run screenshot capture with headed browser

## CI Pipeline

Two GitHub Actions workflows validate every change:

- `.github/workflows/feature.yml`: runs on pull requests to `main`
- `.github/workflows/main.yml`: runs on pushes to `main`

Both workflows run:

- typecheck
- lint
- format check
- test
