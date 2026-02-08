# Rehoboam UI

A React app inspired by the "Rehoboam" interface from Westworld TV series.

![Preview](./public/Picture.JPG)

- Watch critical COVID-19 timeline events.
- Create and launch a custom timeline.

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

## Scripts

- `pnpm dev` - run the Vite dev server
- `pnpm start` - alias for `pnpm dev`
- `pnpm build` - create production build
- `pnpm preview` - preview the production build
- `pnpm typecheck` - run TypeScript checks
- `pnpm lint` - run ESLint
- `pnpm format` - auto-format files with Prettier
- `pnpm format:check` - verify formatting
- `pnpm test` - run tests with Vitest

## CI Pipeline

Two GitHub Actions workflows validate every change:

- `.github/workflows/feature.yml`: runs on pull requests to `main`
- `.github/workflows/main.yml`: runs on pushes to `main`

Both workflows run:

- typecheck
- lint
- format check
- test
