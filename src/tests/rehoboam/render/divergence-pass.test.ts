import {
  createViewportState,
  DEFAULT_THEME,
} from "../../../features/rehoboam/engine/defaults";
import { createInitialInteractionState } from "../../../features/rehoboam/engine/input";
import type { WorldEvent } from "../../../features/rehoboam/engine/types";
import type { DivergenceCluster } from "../../../features/rehoboam/render/canvas2d/divergence-cluster-tracker";
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

const MULTI_PULSES: readonly DivergencePulse[] = [
  ...PULSES,
  {
    eventId: "event-2",
    startedAtMs: 2_100,
    severity: "medium",
  },
];

const DENSE_CLUSTERS: readonly DivergenceCluster[] = [
  {
    id: "cluster-a",
    centerAngleRad: 1.58,
    widthRad: 0.24,
    strength: 0.02,
    severity: "critical",
    startedAtMs: 0,
    attackMs: 220,
    holdMs: 12_000,
    decayMs: 2_400,
    driftRadPerSecond: 0,
    flareSpeedHz: 0.1,
    flarePhaseOffsetRad: 0.3,
    spikes: [
      {
        angleOffsetRad: -0.06,
        widthRad: 0.09,
        strengthScale: 2.6,
        flickerHz: 0.24,
        phaseOffsetRad: 0.7,
      },
      {
        angleOffsetRad: 0.04,
        widthRad: 0.07,
        strengthScale: 2.4,
        flickerHz: 0.2,
        phaseOffsetRad: 1.4,
      },
      {
        angleOffsetRad: 0.11,
        widthRad: 0.06,
        strengthScale: 2.1,
        flickerHz: 0.18,
        phaseOffsetRad: 2.1,
      },
    ],
  },
  {
    id: "cluster-b",
    centerAngleRad: 1.54,
    widthRad: 0.22,
    strength: 0.018,
    severity: "critical",
    startedAtMs: 0,
    attackMs: 280,
    holdMs: 12_000,
    decayMs: 2_400,
    driftRadPerSecond: 0,
    flareSpeedHz: 0.09,
    flarePhaseOffsetRad: 1.2,
    spikes: [
      {
        angleOffsetRad: -0.09,
        widthRad: 0.08,
        strengthScale: 2.5,
        flickerHz: 0.22,
        phaseOffsetRad: 0.5,
      },
      {
        angleOffsetRad: 0.02,
        widthRad: 0.07,
        strengthScale: 2.25,
        flickerHz: 0.21,
        phaseOffsetRad: 1.6,
      },
    ],
  },
  {
    id: "cluster-c",
    centerAngleRad: 1.62,
    widthRad: 0.2,
    strength: 0.017,
    severity: "high",
    startedAtMs: 0,
    attackMs: 260,
    holdMs: 12_000,
    decayMs: 2_400,
    driftRadPerSecond: 0,
    flareSpeedHz: 0.08,
    flarePhaseOffsetRad: 2.2,
    spikes: [
      {
        angleOffsetRad: -0.05,
        widthRad: 0.07,
        strengthScale: 2.2,
        flickerHz: 0.2,
        phaseOffsetRad: 0.9,
      },
      {
        angleOffsetRad: 0.06,
        widthRad: 0.06,
        strengthScale: 2.1,
        flickerHz: 0.17,
        phaseOffsetRad: 1.3,
      },
    ],
  },
];

const TAU = Math.PI * 2;

type ContourPoint = Readonly<{
  angleRad: number;
  radius: number;
}>;

type RadiusRange = Readonly<{
  min: number;
  max: number;
}>;

const normalizeAngle = (angleRad: number): number => {
  const normalized = angleRad % TAU;

  return normalized >= 0 ? normalized : normalized + TAU;
};

const shortestAngularDistance = (
  fromAngleRad: number,
  toAngleRad: number
): number => {
  const clockwiseDelta = normalizeAngle(toAngleRad - fromAngleRad);

  if (clockwiseDelta > Math.PI) {
    return clockwiseDelta - TAU;
  }

  return clockwiseDelta;
};

const parsePointCommand = (command: string): ContourPoint | null => {
  const match = /^(?:moveTo|lineTo)\((-?\d+\.\d+),(-?\d+\.\d+)\)$/.exec(
    command
  );

  if (match === null) {
    return null;
  }

  const x = Number.parseFloat(match[1]);
  const y = Number.parseFloat(match[2]);
  const dx = x - VIEWPORT.center.x;
  const dy = y - VIEWPORT.center.y;

  return {
    angleRad: normalizeAngle(Math.atan2(dx, -dy)),
    radius: Math.sqrt(dx * dx + dy * dy),
  };
};

const getFirstContourPoints = (
  commands: readonly string[]
): readonly ContourPoint[] => {
  const pathStartIndex = commands.indexOf("beginPath");

  if (pathStartIndex === -1) {
    return [];
  }

  const pathEndIndex = commands.indexOf("stroke", pathStartIndex + 1);

  if (pathEndIndex === -1) {
    return [];
  }

  return commands
    .slice(pathStartIndex + 1, pathEndIndex)
    .map(parsePointCommand)
    .filter((point): point is ContourPoint => {
      return point !== null;
    });
};

const resolveRadiusRange = (points: readonly ContourPoint[]): RadiusRange => {
  if (points.length === 0) {
    throw new Error("No contour points were recorded.");
  }

  return points.reduce(
    (range, point) => {
      return {
        min: Math.min(range.min, point.radius),
        max: Math.max(range.max, point.radius),
      };
    },
    {
      min: Number.POSITIVE_INFINITY,
      max: Number.NEGATIVE_INFINITY,
    }
  );
};

const renderContourPoints = (
  clusters: readonly DivergenceCluster[]
): readonly ContourPoint[] => {
  const context = createMockCanvasContext();

  drawDivergencePass({
    context: context.context,
    viewport: VIEWPORT,
    theme: DEFAULT_THEME,
    interaction: createInitialInteractionState(),
    events: EVENTS,
    pulses: [],
    clusters,
    elapsedMs: 3_000,
    timeMs: 3_000,
    entranceScale: 1,
  });

  return getFirstContourPoints(context.commands);
};

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
      clusters: [],
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
      clusters: [],
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
      clusters: [],
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
      clusters: [],
      elapsedMs: 3_000,
      timeMs: 3_000,
      entranceScale: 1,
    });

    expect(withoutPulse.commands).not.toStrictEqual(withPulse.commands);
  });

  it("blends multiple concentration zones when multiple pulses are active", () => {
    const singlePulse = createMockCanvasContext();
    const multiPulse = createMockCanvasContext();

    drawDivergencePass({
      context: singlePulse.context,
      viewport: VIEWPORT,
      theme: DEFAULT_THEME,
      interaction: createInitialInteractionState(),
      events: EVENTS,
      pulses: PULSES,
      clusters: [],
      elapsedMs: 3_000,
      timeMs: 3_000,
      entranceScale: 1,
    });

    drawDivergencePass({
      context: multiPulse.context,
      viewport: VIEWPORT,
      theme: DEFAULT_THEME,
      interaction: createInitialInteractionState(),
      events: EVENTS,
      pulses: MULTI_PULSES,
      clusters: [],
      elapsedMs: 3_000,
      timeMs: 3_000,
      entranceScale: 1,
    });

    expect(singlePulse.commands).not.toStrictEqual(multiPulse.commands);
  });

  it("keeps mountain extensions visible without active pulses", () => {
    const context = createMockCanvasContext();

    drawDivergencePass({
      context: context.context,
      viewport: VIEWPORT,
      theme: DEFAULT_THEME,
      interaction: createInitialInteractionState(),
      events: EVENTS,
      pulses: [],
      clusters: [],
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
      clusters: [],
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
      clusters: [],
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

  it("caps outward contour lift in densely clustered zones", () => {
    const clusteredRange = resolveRadiusRange(
      renderContourPoints(DENSE_CLUSTERS)
    );
    const baseRadius = VIEWPORT.outerRadius * 0.84;

    expect(clusteredRange.max - baseRadius).toBeLessThanOrEqual(
      VIEWPORT.outerRadius * 0.056
    );
  });

  it("introduces inward contour notches when clustered extensions are active", () => {
    const baselinePoints = renderContourPoints([]);
    const clusteredPoints = renderContourPoints(DENSE_CLUSTERS);
    const clusterCenterAngleRad = 1.58;
    const clusterWindowRad = 0.26;
    const localRadiusDeltas = clusteredPoints
      .map((point, index) => {
        return {
          angleRad: point.angleRad,
          deltaRadius: point.radius - baselinePoints[index].radius,
        };
      })
      .filter((sample) => {
        return (
          Math.abs(
            shortestAngularDistance(sample.angleRad, clusterCenterAngleRad)
          ) <= clusterWindowRad
        );
      });

    expect(localRadiusDeltas.length).toBeGreaterThan(0);
    expect(
      Math.min(...localRadiusDeltas.map((sample) => sample.deltaRadius))
    ).toBeLessThan(-VIEWPORT.outerRadius * 0.0018);
  });
});
