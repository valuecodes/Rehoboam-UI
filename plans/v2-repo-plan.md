# Rehoboam V2 Repo Plan

This is the implementation plan for V2 in this repository.  
It is intentionally repo-specific and assumes a clean break from V1.

## Decision and Assumptions

- V2 is not backward compatible with the current implementation.
- We will replace V1 as the app entry experience.
- We can keep old files temporarily during migration, but V1 behavior is not preserved.
- Primary reference spec is `plans/v2.md`.
- Quality gates remain: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`.

## Target Architecture (V2)

Create a new feature root and keep rendering, state, data, and overlay separated:

```text
src/
  features/
    rehoboam/
      index.ts
      scene/
        rehoboam-scene.tsx
      engine/
        rehoboam-engine.ts
        input.ts
        timing.ts
        types.ts
        defaults.ts
      render/
        canvas2d/
          renderer-2d.ts
          passes/
            background-pass.ts
            rings-pass.ts
            divergence-pass.ts
            sweep-pass.ts
            markers-pass.ts
      layout/
        polar.ts
        compute-angles.ts
        clustering.ts
      overlay/
        callout-overlay.tsx
        event-list-panel.tsx
      data/
        normalize.ts
        dedupe.ts
        source.ts
        persistence.ts
      fixtures/
        mock-events.json
  shared/
    utils/
      seeded-rng.ts
```

Testing layout:

```text
src/tests/
  rehoboam/
    layout/*.test.ts
    data/*.test.ts
    engine/*.test.ts
    render/*.test.ts
e2e/
  rehoboam.spec.ts (phase-gated)
```

## Cutover Plan

1. Switch `src/app.tsx` to render V2 scene only.
2. Stop importing V1 components from `src/components/mainsection/*`.
3. Keep V1 files until V2 reaches parity for core interactions, then remove V1 tree in a cleanup PR.
4. Update `README.md` after the first working V2 milestone.

## Milestones

## M0 - Bootstrapping and App Cutover

Scope:

- Scaffold `src/features/rehoboam/*` folders and stubs.
- Add `rehoboam-scene.tsx` and render it from `src/app.tsx`.
- Introduce V2-scoped CSS variables and remove hard requirements like fixed `800x800` min layout from active styles.

Acceptance criteria:

- App runs and shows an empty V2 scene container.
- No imports from V1 in `src/app.tsx`.
- `pnpm typecheck && pnpm lint` pass.

## M1 - Core Types, Math, and Deterministic Utilities

Scope:

- Implement `engine/types.ts` (`WorldEvent`, interaction/camera/viewport contracts).
- Implement `layout/polar.ts` helpers:
  - angle normalization `[0, 2pi)`
  - shortest angular distance
  - polar/cartesian conversion with 12 o'clock clockwise convention
- Implement seeded RNG utility for deterministic motion where needed.

Acceptance criteria:

- Unit tests for math utilities and seed determinism.
- No use of random event placement for layout logic.
- `pnpm test` passes with added tests.

## M2 - Engine Boundary and Frame Lifecycle

Scope:

- Implement `RehoboamEngine` interface:
  - `start`, `stop`, `resize`, `setEvents`, `setInteraction`, `setTheme`, `destroy`
- Use `requestAnimationFrame` with a monotonic time source.
- Connect `ResizeObserver` in `rehoboam-scene.tsx` and apply DPR cap.

Acceptance criteria:

- Engine starts/stops cleanly (no leaked RAF loops).
- Resize updates canvas pixel dimensions correctly.
- Smoke tests cover engine lifecycle.

## M3 - Base Renderer (Background, Rings, Sweep)

Scope:

- Implement:
  - `background-pass.ts`
  - `rings-pass.ts` with `setLineDash` and animated `lineDashOffset`
  - `sweep-pass.ts`
- Build `renderer-2d.ts` to orchestrate passes and shared draw context.

Acceptance criteria:

- Ring stack animates continuously with per-ring speed/direction.
- Sweep rotates and can be targeted later by interaction state.
- Render tests validate deterministic draw-command output for fixed seed/time.

## M4 - Event Data Pipeline and Layout Mapping

Scope:

- Add `fixtures/mock-events.json` in V2 schema.
- Implement `normalize.ts`, `dedupe.ts`, `source.ts`.
- Implement `compute-angles.ts`:
  - stable event ordering
  - time-window mapping
  - severity -> marker height mapping
  - clustering threshold when over max visible count

Acceptance criteria:

- Same input always yields same event IDs and angles.
- Deduping merges updates and prevents duplicates.
- Unit tests cover boundary timestamps and severity scaling.

## M5 - Markers, Overlay Callouts, and Interaction State Machine

Scope:

- Implement `markers-pass.ts`.
- Implement `overlay/callout-overlay.tsx` with leader line draw animation.
- Implement `engine/input.ts` with Pointer Events semantics:
  - hover dwell
  - click-to-select
  - Escape to clear
  - selection lock behavior

Acceptance criteria:

- Hover shows callout after dwell delay.
- Click locks callout and selection state.
- Escape clears selection.
- Hit targets meet minimum practical target size.

## M6 - Divergence Waveform and Event-Triggered Pulses

Scope:

- Implement `divergence-pass.ts`:
  - baseline ripple
  - localized pulse envelope (attack/decay)
- Add event trigger plumbing so new/updated events emit divergence pulses.

Acceptance criteria:

- New event visibly creates localized waveform perturbation near its angle.
- Pulse timing follows configured attack/decay.
- Render pass stays deterministic for fixed seed/time.

## M7 - Persistence and Fetch Strategy

Scope:

- Implement IndexedDB persistence in `data/persistence.ts`.
- Boot flow:
  - rehydrate cached events immediately
  - refresh source in background
  - update event store and pulse changed/new events
- Keep mock source as default fallback.

Acceptance criteria:

- Reload keeps previous event state without network.
- Background refresh updates UI when data changes.
- Parsing handles partial/messy input without throwing.

## M8 - Accessibility, Performance Tuning, and Cleanup

Scope:

- Implement `overlay/event-list-panel.tsx` as accessible parallel representation.
- Keyboard navigation mirrors ring selection state.
- Add quality tiers:
  - reduce ring count/wave samples on constrained devices
  - keep DPR cap at configured max
- Remove V1 files and stale CSS once V2 is stable.

Acceptance criteria:

- Keyboard-only flow can browse/select events.
- Performance remains smooth on typical laptop targets.
- V1 tree removed (or explicitly archived) in final cleanup PR.

## M9 - Visual Regression (Optional but Recommended)

Scope:

- Add Playwright scene snapshot test with deterministic fixture and frozen time.

Acceptance criteria:

- Stable screenshot assertion locally and in CI.
- Flakiness controls documented (seed/time/animation mode).

## Implementation Rules for This Repo

- Keep pure logic modules framework-agnostic and unit-tested (`layout/`, `data/`, `engine/input` state logic).
- Keep Canvas rendering testable through draw-command snapshots, not raw pixel assertions.
- Keep DOM text and hit targets in overlay components for readability and accessibility.
- Use named exports only.
- Prefer `type` imports where applicable.

## PR Slicing Strategy

1. PR1: M0 + M1
2. PR2: M2 + M3
3. PR3: M4 + M5
4. PR4: M6 + M7
5. PR5: M8 (+ M9 if enabled)

Each PR must pass:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

## Definition of Done (V2)

- V2 scene fully replaces V1 at app entry.
- Layered rendering implemented: base rings, sweep, markers, divergence waveform, callouts.
- Deterministic event mapping and state machine behavior.
- Data normalization/dedupe + local persistence working.
- Accessibility baseline present via keyboard navigable event list.
- Repo quality gates pass in CI.
