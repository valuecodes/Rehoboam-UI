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
});
