import {
  createViewportState,
  DEFAULT_THEME,
} from "../../../features/rehoboam/engine/defaults";
import { createInitialInteractionState } from "../../../features/rehoboam/engine/input";
import type { WorldEvent } from "../../../features/rehoboam/engine/types";
import type { DivergencePulse } from "../../../features/rehoboam/render/canvas2d/divergence-pulse-tracker";
import { drawDivergencePass } from "../../../features/rehoboam/render/canvas2d/passes/divergence-pass";
import { createMockCanvasContext } from "./mock-canvas-context";

const EVENTS: readonly WorldEvent[] = [
  {
    id: "event-1",
    title: "Relay divergence",
    timestampMs: 1_718_980_000_000,
    severity: "critical",
    category: "system",
  },
  {
    id: "event-2",
    title: "Supply chain delay",
    timestampMs: 1_718_974_000_000,
    severity: "medium",
    category: "economy",
  },
];

const VIEWPORT = createViewportState({
  width: 520,
  height: 520,
  dpr: 1,
  dprCap: 2,
});

const PULSES: readonly DivergencePulse[] = [
  {
    eventId: "event-1",
    startedAtMs: 2_000,
    severity: "critical",
  },
];

describe("drawDivergencePass", () => {
  it("is deterministic for fixed events, pulses, and time", () => {
    const first = createMockCanvasContext();
    const second = createMockCanvasContext();

    drawDivergencePass({
      context: first.context,
      viewport: VIEWPORT,
      theme: DEFAULT_THEME,
      interaction: createInitialInteractionState(),
      events: EVENTS,
      pulses: PULSES,
      elapsedMs: 3_000,
      timeMs: 3_000,
      entranceScale: 1,
    });

    drawDivergencePass({
      context: second.context,
      viewport: VIEWPORT,
      theme: DEFAULT_THEME,
      interaction: createInitialInteractionState(),
      events: EVENTS,
      pulses: PULSES,
      elapsedMs: 3_000,
      timeMs: 3_000,
      entranceScale: 1,
    });

    expect(first.commands).toStrictEqual(second.commands);
  });

  it("changes waveform when localized pulses are present", () => {
    const withoutPulse = createMockCanvasContext();
    const withPulse = createMockCanvasContext();

    drawDivergencePass({
      context: withoutPulse.context,
      viewport: VIEWPORT,
      theme: DEFAULT_THEME,
      interaction: createInitialInteractionState(),
      events: EVENTS,
      pulses: [],
      elapsedMs: 3_000,
      timeMs: 3_000,
      entranceScale: 1,
    });

    drawDivergencePass({
      context: withPulse.context,
      viewport: VIEWPORT,
      theme: DEFAULT_THEME,
      interaction: createInitialInteractionState(),
      events: EVENTS,
      pulses: PULSES,
      elapsedMs: 3_000,
      timeMs: 3_000,
      entranceScale: 1,
    });

    expect(withoutPulse.commands).not.toStrictEqual(withPulse.commands);
  });

  it("keeps directional tears visible without active pulses", () => {
    const context = createMockCanvasContext();

    drawDivergencePass({
      context: context.context,
      viewport: VIEWPORT,
      theme: DEFAULT_THEME,
      interaction: createInitialInteractionState(),
      events: EVENTS,
      pulses: [],
      elapsedMs: 3_000,
      timeMs: 3_000,
      entranceScale: 1,
    });

    const fillCommandCount = context.commands.filter((command) => {
      return command === "fill";
    }).length;

    expect(fillCommandCount).toBeGreaterThan(0);
  });

  it("uses quality-adjusted divergence sample count", () => {
    const lowSampleContext = createMockCanvasContext();
    const highSampleContext = createMockCanvasContext();

    drawDivergencePass({
      context: lowSampleContext.context,
      viewport: VIEWPORT,
      theme: {
        ...DEFAULT_THEME,
        divergenceSampleCount: 140,
      },
      interaction: createInitialInteractionState(),
      events: EVENTS,
      pulses: [],
      elapsedMs: 3_000,
      timeMs: 3_000,
      entranceScale: 1,
    });

    drawDivergencePass({
      context: highSampleContext.context,
      viewport: VIEWPORT,
      theme: {
        ...DEFAULT_THEME,
        divergenceSampleCount: 520,
      },
      interaction: createInitialInteractionState(),
      events: EVENTS,
      pulses: [],
      elapsedMs: 3_000,
      timeMs: 3_000,
      entranceScale: 1,
    });

    const lowSampleLineToCount = lowSampleContext.commands.filter((command) => {
      return command.startsWith("lineTo(");
    }).length;
    const highSampleLineToCount = highSampleContext.commands.filter(
      (command) => {
        return command.startsWith("lineTo(");
      }
    ).length;

    expect(lowSampleLineToCount).toBeLessThan(highSampleLineToCount);
  });
});
