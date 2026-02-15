---
name: validate-scene-ui
description: Validate Rehoboam scene animation and UI quality with deterministic Playwright screenshots driven by `apps/web/scripts/screenshot-scene.ts`. Use when changes touch animation timing, Canvas2D rendering, layout/CSS, overlays, timeline sequencing, or any visual behavior that should be confirmed by screenshots.
---

# Validate Scene UI

## Overview

Run screenshot-based visual validation after scene/UI changes and use the captures as objective evidence in the final report.

## Validation Workflow

1. Run screenshot capture.

```bash
pnpm --filter web screenshot:scene
```

2. Use options when needed:

- `pnpm --filter web screenshot:scene -- --count 3 --interval-ms 1200` to sample animation progression.
- `pnpm --filter web screenshot:scene -- --output .tmp/screenshots/<label>.png` to keep outputs tied to the task.
- `pnpm --filter web screenshot:scene:headed` for local visual debugging.

3. Review both generated images:

- Full page: `<output>.png`
- Instrument crop: `<output>.instrument.png`

4. Check visual quality:

- Preserve layout alignment and spacing.
- Avoid clipping, overlap, or unreadable text.
- Keep ring/sweep/divergence rendering stable and intentional.
- Confirm callouts/panel positioning remains usable.

5. Report concrete findings with screenshot file paths and whether the scene quality appears acceptable.

## Notes

- The underlying command executes `apps/web/scripts/screenshot-scene.ts`, which runs Playwright against `http://127.0.0.1:3001` by default and captures deterministic outputs under `apps/web/.tmp/screenshots/`.
- Use this skill by default for UI/animation validation unless the user explicitly asks to skip screenshot checks.
