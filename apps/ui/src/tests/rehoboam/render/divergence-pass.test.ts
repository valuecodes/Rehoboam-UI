import {
  createViewportState,
  DEFAULT_THEME,
} from "../../../features/rehoboam/engine/defaults";
import { createInitialInteractionState } from "../../../features/rehoboam/engine/input";
import type { WorldEvent } from "../../../features/rehoboam/engine/types";
import type { DivergenceCluster } from "../../../features/rehoboam/render/canvas2d/divergence-cluster-tracker";
import { drawDivergencePass } from "../../../features/rehoboam/render/canvas2d/passes/divergence-pass";
import { createMockCanvasContext } from "./mock-canvas-context";

const createEvent = (): WorldEvent => {
  return {
    id: "event-1",
    title: "Event 1",
    timestampMs: 1_770_500_000_000,
    severity: "high",
    category: "system",
  };
};

const createZeroDurationCluster = (): DivergenceCluster => {
  return {
    id: "cluster-1",
    centerAngleRad: 0.5,
    widthRad: 0.2,
    strength: 0.01,
    severity: "high",
    startedAtMs: 0,
    attackMs: 0,
    holdMs: 0,
    decayMs: 0,
    driftRadPerSecond: 0,
    flareSpeedHz: 0.1,
    flarePhaseOffsetRad: 0,
    spikes: [],
  };
};

describe("drawDivergencePass", () => {
  it("handles clusters with zero attack/decay without non-finite draw commands", () => {
    const mock = createMockCanvasContext();
    const viewport = createViewportState({
      width: 420,
      height: 420,
      dpr: 1,
      dprCap: 2,
    });

    drawDivergencePass({
      context: mock.context,
      viewport,
      theme: DEFAULT_THEME,
      interaction: createInitialInteractionState(),
      events: [createEvent()],
      eventAnglesByEventId: new Map([["event-1", 0.5]]),
      pulses: [],
      clusters: [createZeroDurationCluster()],
      elapsedMs: 10_000,
      timeMs: 10_000,
      entranceScale: 1,
    });

    expect(
      mock.commands.some((command) => {
        return command.includes("NaN") || command.includes("Infinity");
      })
    ).toBe(false);
  });

  it("scales displacement across 0, base, and boosted intensity levels", () => {
    const viewport = createViewportState({
      width: 420,
      height: 420,
      dpr: 1,
      dprCap: 2,
    });
    const center = { x: 210, y: 210 };

    const extractMaxRadius = (commands: readonly string[]): number => {
      let maxRadius = 0;

      for (const command of commands) {
        const match = /^(?:moveTo|lineTo)\((-?\d+\.\d+),(-?\d+\.\d+)\)$/.exec(
          command
        );

        if (match === null) {
          continue;
        }

        const x = Number(match[1]);
        const y = Number(match[2]);
        const radius = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
        maxRadius = Math.max(maxRadius, radius);
      }

      return maxRadius;
    };
    const extractRadiusSpread = (commands: readonly string[]): number => {
      let maxRadius = 0;
      let minRadius = Number.POSITIVE_INFINITY;

      for (const command of commands) {
        const match = /^(?:moveTo|lineTo)\((-?\d+\.\d+),(-?\d+\.\d+)\)$/.exec(
          command
        );

        if (match === null) {
          continue;
        }

        const x = Number(match[1]);
        const y = Number(match[2]);
        const radius = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
        maxRadius = Math.max(maxRadius, radius);
        minRadius = Math.min(minRadius, radius);
      }

      if (!Number.isFinite(minRadius)) {
        return 0;
      }

      return maxRadius - minRadius;
    };

    const calmMock = createMockCanvasContext();
    drawDivergencePass({
      context: calmMock.context,
      viewport,
      theme: { ...DEFAULT_THEME, divergenceIntensity: 0 },
      interaction: createInitialInteractionState(),
      events: [],
      eventAnglesByEventId: new Map(),
      pulses: [],
      clusters: [],
      elapsedMs: 5_000,
      timeMs: 5_000,
      entranceScale: 1,
    });

    const baseMock = createMockCanvasContext();
    drawDivergencePass({
      context: baseMock.context,
      viewport,
      theme: { ...DEFAULT_THEME, divergenceIntensity: 1 },
      interaction: createInitialInteractionState(),
      events: [],
      eventAnglesByEventId: new Map(),
      pulses: [],
      clusters: [],
      elapsedMs: 5_000,
      timeMs: 5_000,
      entranceScale: 1,
    });

    const boostedMock = createMockCanvasContext();
    drawDivergencePass({
      context: boostedMock.context,
      viewport,
      theme: { ...DEFAULT_THEME, divergenceIntensity: 2 },
      interaction: createInitialInteractionState(),
      events: [],
      eventAnglesByEventId: new Map(),
      pulses: [],
      clusters: [],
      elapsedMs: 5_000,
      timeMs: 5_000,
      entranceScale: 1,
    });

    const calmMaxRadius = extractMaxRadius(calmMock.commands);
    const baseMaxRadius = extractMaxRadius(baseMock.commands);
    const boostedMaxRadius = extractMaxRadius(boostedMock.commands);
    const calmRadiusSpread = extractRadiusSpread(calmMock.commands);
    const baseRadiusSpread = extractRadiusSpread(baseMock.commands);
    const boostedRadiusSpread = extractRadiusSpread(boostedMock.commands);

    expect(calmMaxRadius).toBeGreaterThan(0);
    expect(baseMaxRadius).toBeGreaterThan(0);
    expect(boostedMaxRadius).toBeGreaterThan(0);
    expect(calmRadiusSpread).toBeGreaterThan(0);
    expect(baseRadiusSpread).toBeGreaterThan(0);
    expect(boostedRadiusSpread).toBeGreaterThan(0);
    expect(calmMaxRadius).toBeLessThan(baseMaxRadius);
    expect(baseMaxRadius).toBeLessThan(boostedMaxRadius);
    expect(baseMaxRadius - calmMaxRadius).toBeLessThan(
      viewport.outerRadius * 0.1
    );
    expect(boostedMaxRadius - baseMaxRadius).toBeLessThan(
      viewport.outerRadius * 0.15
    );
    expect(boostedMaxRadius).toBeLessThan(viewport.outerRadius * 1.05);
    expect(calmRadiusSpread).toBeLessThan(baseRadiusSpread);
    expect(baseRadiusSpread).toBeLessThan(boostedRadiusSpread);
    expect(boostedRadiusSpread - baseRadiusSpread).toBeLessThan(
      viewport.outerRadius * 0.12
    );
  });
});
