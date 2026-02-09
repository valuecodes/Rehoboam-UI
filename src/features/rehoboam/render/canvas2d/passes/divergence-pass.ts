import type {
  InteractionState,
  RehoboamTheme,
  ViewportState,
  WorldEvent,
  WorldEventSeverity,
} from "../../../engine/types";
import {
  computeAngles,
  DEFAULT_LAYOUT_WINDOW_MS,
  DEFAULT_MAX_VISIBLE_EVENT_COUNT,
} from "../../../layout/compute-angles";
import {
  normalizeAngle,
  polarToCartesian,
  shortestAngularDistance,
  TAU,
} from "../../../layout/polar";
import {
  DIVERGENCE_ATTACK_MS,
  DIVERGENCE_DECAY_MS,
  DIVERGENCE_PULSE_LIFETIME_MS,
} from "../divergence-constants";
import type { DivergencePulse } from "../divergence-pulse-tracker";

const LEADING_TIME_OFFSET_MS = 45 * 60 * 1000;

const SEVERITY_RANK: Readonly<Record<WorldEventSeverity, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const IDLE_TEAR_STRENGTH: Readonly<Record<WorldEventSeverity, number>> = {
  low: 0.0048,
  medium: 0.0068,
  high: 0.0092,
  critical: 0.012,
};

const PULSE_AMPLITUDE_SCALE: Readonly<Record<WorldEventSeverity, number>> = {
  low: 0.014,
  medium: 0.024,
  high: 0.038,
  critical: 0.06,
};

const PULSE_WINDOW_RAD: Readonly<Record<WorldEventSeverity, number>> = {
  low: 0.12,
  medium: 0.16,
  high: 0.2,
  critical: 0.24,
};

export type DivergencePassInput = Readonly<{
  context: CanvasRenderingContext2D;
  viewport: ViewportState;
  theme: RehoboamTheme;
  interaction: InteractionState;
  events: readonly WorldEvent[];
  pulses: readonly DivergencePulse[];
  elapsedMs: number;
  timeMs: number;
  entranceScale: number;
}>;

type ContourSample = Readonly<{
  angleRad: number;
  radius: number;
  pulseInfluence: number;
}>;

type ActivePulseDescriptor = Readonly<{
  angleRad: number;
  strength: number;
  severity: WorldEventSeverity;
}>;

type FlowLane = Readonly<{
  radiusOffsetFactor: number;
  stride: number;
  driftCyclesPerSecond: number;
  alpha: number;
  minCircleRadius: number;
  maxCircleRadius: number;
}>;

const FLOW_LANES: readonly FlowLane[] = [
  {
    radiusOffsetFactor: -0.028,
    stride: 3,
    driftCyclesPerSecond: 0.06,
    alpha: 0.072,
    minCircleRadius: 0.42,
    maxCircleRadius: 1.08,
  },
  {
    radiusOffsetFactor: -0.012,
    stride: 2,
    driftCyclesPerSecond: -0.08,
    alpha: 0.086,
    minCircleRadius: 0.5,
    maxCircleRadius: 1.18,
  },
  {
    radiusOffsetFactor: 0.008,
    stride: 2,
    driftCyclesPerSecond: 0.1,
    alpha: 0.096,
    minCircleRadius: 0.54,
    maxCircleRadius: 1.24,
  },
  {
    radiusOffsetFactor: 0.024,
    stride: 3,
    driftCyclesPerSecond: -0.05,
    alpha: 0.068,
    minCircleRadius: 0.4,
    maxCircleRadius: 1.02,
  },
] as const;

const sanitizeSampleCount = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 360;
  }

  return Math.max(96, Math.min(720, Math.trunc(value)));
};

const positiveModulo = (value: number, modulus: number): number => {
  const remainder = value % modulus;

  return remainder < 0 ? remainder + modulus : remainder;
};

const getTearCountForSeverity = (severity: WorldEventSeverity): number => {
  if (severity === "critical") {
    return 9;
  }

  if (severity === "high") {
    return 8;
  }

  if (severity === "medium") {
    return 7;
  }

  return 6;
};

const getLayoutNowMs = (events: readonly WorldEvent[]): number => {
  if (events.length === 0) {
    return 0;
  }

  const latestTimestampMs = events.reduce((latest, event) => {
    return Math.max(latest, event.timestampMs);
  }, 0);

  return latestTimestampMs + LEADING_TIME_OFFSET_MS;
};

const getPulseEnvelope = (elapsedMs: number): number => {
  if (elapsedMs <= 0 || elapsedMs >= DIVERGENCE_PULSE_LIFETIME_MS) {
    return 0;
  }

  if (elapsedMs <= DIVERGENCE_ATTACK_MS) {
    const attackProgress = elapsedMs / DIVERGENCE_ATTACK_MS;

    return attackProgress * attackProgress;
  }

  const decayProgress =
    (elapsedMs - DIVERGENCE_ATTACK_MS) / DIVERGENCE_DECAY_MS;

  return (1 - decayProgress) ** 2;
};

const getRaisedCosineWindow = (
  distanceRad: number,
  windowRad: number
): number => {
  if (distanceRad >= windowRad) {
    return 0;
  }

  return 0.5 * (1 + Math.cos((Math.PI * distanceRad) / windowRad));
};

const resolveEventAnglesByEventId = (
  events: readonly WorldEvent[]
): ReadonlyMap<string, number> => {
  const eventAngles = computeAngles(events, {
    nowMs: getLayoutNowMs(events),
    windowMs: DEFAULT_LAYOUT_WINDOW_MS,
    maxVisibleCount: DEFAULT_MAX_VISIBLE_EVENT_COUNT,
    distributionMode: "ordered",
  });
  const angleByEventId = new Map<string, number>();

  for (const eventAngle of eventAngles) {
    for (const eventId of eventAngle.eventIds) {
      angleByEventId.set(eventId, eventAngle.angleRad);
    }
  }

  return angleByEventId;
};

const resolveActivePulseDescriptors = (
  pulses: readonly DivergencePulse[],
  pulseAngles: ReadonlyMap<string, number>,
  timeMs: number
): readonly ActivePulseDescriptor[] => {
  const descriptors: ActivePulseDescriptor[] = [];

  for (const pulse of pulses) {
    const angleRad = pulseAngles.get(pulse.eventId);

    if (angleRad === undefined) {
      continue;
    }

    const elapsedPulseMs = timeMs - pulse.startedAtMs;
    const strength =
      getPulseEnvelope(elapsedPulseMs) * PULSE_AMPLITUDE_SCALE[pulse.severity];

    if (strength <= 0) {
      continue;
    }

    descriptors.push({
      angleRad,
      strength,
      severity: pulse.severity,
    });
  }

  return descriptors.sort((left, right) => {
    return right.strength - left.strength;
  });
};

const getPulseStrength = (pulse: DivergencePulse, timeMs: number): number => {
  const elapsedPulseMs = timeMs - pulse.startedAtMs;

  return getPulseEnvelope(elapsedPulseMs) * PULSE_AMPLITUDE_SCALE[pulse.severity];
};

const resolvePrimaryPulseEventId = (
  pulses: readonly DivergencePulse[],
  eventAnglesByEventId: ReadonlyMap<string, number>,
  interaction: InteractionState,
  timeMs: number
): string | null => {
  for (const eventId of [
    interaction.selectedEventId,
    interaction.hoveredEventId,
    interaction.hoverCandidateEventId,
  ]) {
    if (eventId === null) {
      continue;
    }

    const isActive = pulses.some((pulse) => {
      if (
        pulse.eventId !== eventId ||
        eventAnglesByEventId.get(pulse.eventId) === undefined
      ) {
        return false;
      }

      return getPulseStrength(pulse, timeMs) > 0;
    });

    if (isActive) {
      return eventId;
    }
  }

  let strongestEventId: string | null = null;
  let strongestStrength = 0;

  for (const pulse of pulses) {
    if (eventAnglesByEventId.get(pulse.eventId) === undefined) {
      continue;
    }

    const strength = getPulseStrength(pulse, timeMs);

    if (strength <= strongestStrength) {
      continue;
    }

    strongestStrength = strength;
    strongestEventId = pulse.eventId;
  }

  return strongestEventId;
};

const compareEventsByPriority = (left: WorldEvent, right: WorldEvent): number => {
  const severityDelta =
    SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];

  if (severityDelta !== 0) {
    return severityDelta;
  }

  if (left.timestampMs !== right.timestampMs) {
    return right.timestampMs - left.timestampMs;
  }

  return left.id.localeCompare(right.id);
};

const resolvePrimaryEventId = (
  events: readonly WorldEvent[],
  eventAnglesByEventId: ReadonlyMap<string, number>,
  interaction: InteractionState
): string | null => {
  for (const eventId of [
    interaction.selectedEventId,
    interaction.hoveredEventId,
    interaction.hoverCandidateEventId,
  ]) {
    if (eventId !== null && eventAnglesByEventId.has(eventId)) {
      return eventId;
    }
  }

  return [...events]
    .filter((event) => eventAnglesByEventId.has(event.id))
    .sort(compareEventsByPriority)[0]?.id ?? null;
};

const createIdleTearDescriptor = (
  events: readonly WorldEvent[],
  eventAnglesByEventId: ReadonlyMap<string, number>,
  primaryEventId: string | null,
  elapsedMs: number
): ActivePulseDescriptor | null => {
  if (primaryEventId === null) {
    return null;
  }

  const angleRad = eventAnglesByEventId.get(primaryEventId);
  const event = events.find((candidate) => candidate.id === primaryEventId);

  if (angleRad === undefined || event === undefined) {
    return null;
  }

  const elapsedSeconds = elapsedMs / 1000;
  const modulation =
    0.88 + 0.12 * Math.sin(elapsedSeconds * 1.3 + angleRad * 2.1);

  return {
    angleRad,
    severity: event.severity,
    strength: IDLE_TEAR_STRENGTH[event.severity] * modulation,
  };
};

const createContourSamples = (
  viewport: ViewportState,
  elapsedMs: number,
  timeMs: number,
  pulses: readonly DivergencePulse[],
  pulseAngles: ReadonlyMap<string, number>,
  sampleCount: number,
  entranceScale: number
): readonly ContourSample[] => {
  const samples = sanitizeSampleCount(sampleCount);
  const elapsedSeconds = elapsedMs / 1000;
  const baseRadius = viewport.outerRadius * 0.84;

  return Array.from({ length: samples + 1 }, (_, index) => {
    const angleRad = (index / samples) * TAU;
    const baselineOffset =
      Math.sin(angleRad * 4.6 - elapsedSeconds * 0.42) *
        viewport.outerRadius *
        0.0039 +
      Math.sin(angleRad * 8.8 + elapsedSeconds * 0.74) *
        viewport.outerRadius *
        0.0028 +
      Math.sin(angleRad * 14.1 - elapsedSeconds * 1.05) *
        viewport.outerRadius *
        0.0017;

    let pulseInfluence = 0;
    const pulseOffset = pulses.reduce((sum, pulse) => {
      const pulseAngleRad = pulseAngles.get(pulse.eventId);

      if (pulseAngleRad === undefined) {
        return sum;
      }

      const pulseElapsedMs = timeMs - pulse.startedAtMs;
      const timeEnvelope = getPulseEnvelope(pulseElapsedMs);

      if (timeEnvelope <= 0) {
        return sum;
      }

      const angularDistance = Math.abs(
        shortestAngularDistance(angleRad, pulseAngleRad)
      );
      const windowRad = PULSE_WINDOW_RAD[pulse.severity];
      const angularEnvelope = getRaisedCosineWindow(angularDistance, windowRad);

      if (angularEnvelope <= 0) {
        return sum;
      }

      const ripple =
        0.88 + 0.12 * Math.sin((pulseElapsedMs / 1000) * 10 + pulseAngleRad);
      const amplitude =
        viewport.outerRadius * PULSE_AMPLITUDE_SCALE[pulse.severity];
      const influence = timeEnvelope * angularEnvelope;
      pulseInfluence += influence;

      return sum + amplitude * influence * ripple * entranceScale;
    }, 0);
    const grainOffset =
      pulseInfluence <= 0
        ? 0
        : ((Math.sin(angleRad * 33 + elapsedSeconds * 2.9) +
            Math.sin(angleRad * 57 - elapsedSeconds * 2.4)) /
            2) *
          viewport.outerRadius *
          0.0046 *
          Math.min(1, pulseInfluence * 1.1) *
          entranceScale;
    const roughnessOffset =
      pulseInfluence <= 0
        ? 0
        : ((Math.sin(angleRad * 87 + elapsedSeconds * 5.2) +
            Math.sin(angleRad * 119 - elapsedSeconds * 4.1)) /
            2) *
          viewport.outerRadius *
          0.0038 *
          Math.min(1, pulseInfluence * 1.2) *
          entranceScale;

    return {
      angleRad,
      radius:
        baseRadius +
        baselineOffset +
        pulseOffset +
        grainOffset +
        roughnessOffset,
      pulseInfluence: Math.min(1, pulseInfluence) * entranceScale,
    };
  });
};

const drawContourStroke = (
  context: CanvasRenderingContext2D,
  viewport: ViewportState,
  samples: readonly ContourSample[],
  strokeStyle: string,
  alpha: number,
  width: number
): void => {
  context.save();
  context.strokeStyle = strokeStyle;
  context.globalAlpha = alpha;
  context.lineWidth = width;
  context.setLineDash([]);
  context.lineDashOffset = 0;
  context.beginPath();

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const point = polarToCartesian(
      {
        radius: sample.radius,
        angleRad: sample.angleRad,
      },
      viewport.center
    );

    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  }

  context.stroke();
  context.restore();
};

const drawFlowCircleLanes = (
  context: CanvasRenderingContext2D,
  viewport: ViewportState,
  theme: RehoboamTheme,
  samples: readonly ContourSample[],
  elapsedMs: number
): void => {
  const sampleCount = samples.length - 1;

  if (sampleCount <= 0) {
    return;
  }

  const elapsedSeconds = elapsedMs / 1000;

  context.save();
  context.fillStyle = theme.ringColor;
  context.shadowColor = theme.ringColor;
  context.shadowBlur = 2.2;

  for (const lane of FLOW_LANES) {
    const phaseShift = Math.trunc(
      elapsedSeconds * lane.driftCyclesPerSecond * sampleCount
    );

    for (let index = 0; index < sampleCount; index += lane.stride) {
      const laneIndex = positiveModulo(index + phaseShift, sampleCount);
      const sample = samples[laneIndex];
      const laneWave =
        Math.sin(
          sample.angleRad * 9.6 +
            elapsedSeconds * (1.2 + lane.driftCyclesPerSecond * 4) +
            lane.radiusOffsetFactor * 86
        ) * viewport.outerRadius * 0.0042;
      const radius =
        sample.radius +
        viewport.outerRadius * lane.radiusOffsetFactor +
        laneWave * (0.62 + sample.pulseInfluence * 0.58);
      const point = polarToCartesian(
        {
          radius,
          angleRad: sample.angleRad,
        },
        viewport.center
      );
      const sizeMix =
        (Math.sin(sample.angleRad * 27 + elapsedSeconds * 2.6) + 1) / 2;
      const circleRadius =
        lane.minCircleRadius +
        (lane.maxCircleRadius - lane.minCircleRadius) * sizeMix +
        sample.pulseInfluence * 0.7;

      context.globalAlpha = Math.min(
        0.34,
        lane.alpha * (0.92 + sample.pulseInfluence * 1.45)
      );
      context.beginPath();
      context.arc(point.x, point.y, circleRadius, 0, TAU);
      context.fill();
    }
  }

  context.restore();
};

const drawInterRingParticles = (
  context: CanvasRenderingContext2D,
  viewport: ViewportState,
  theme: RehoboamTheme,
  samples: readonly ContourSample[],
  elapsedMs: number
): void => {
  const sampleCount = samples.length - 1;

  if (sampleCount <= 0) {
    return;
  }

  const elapsedSeconds = elapsedMs / 1000;

  context.save();
  context.fillStyle = theme.ringColor;
  context.shadowColor = theme.ringColor;
  context.shadowBlur = 1.8;

  for (let index = 0; index < sampleCount; index += 2) {
    const sample = samples[index];
    const flowSignal =
      (Math.sin(sample.angleRad * 41 - elapsedSeconds * 3.2) + 1) / 2;
    const pulseBoost = sample.pulseInfluence * 0.7;

    if (flowSignal + pulseBoost < 0.44) {
      continue;
    }

    const radialMix =
      (Math.sin(sample.angleRad * 73 + elapsedSeconds * 4.7) + 1) / 2;
    const radialOffsetFactor = -0.031 + radialMix * 0.064;
    const radius = sample.radius + viewport.outerRadius * radialOffsetFactor;
    const driftAngle = normalizeAngle(sample.angleRad + (flowSignal - 0.5) * 0.018);
    const point = polarToCartesian(
      {
        radius,
        angleRad: driftAngle,
      },
      viewport.center
    );
    const particleRadius =
      0.34 +
      radialMix * 1.02 +
      flowSignal * 0.28 +
      sample.pulseInfluence * 0.92;

    context.globalAlpha =
      0.03 + flowSignal * 0.068 + sample.pulseInfluence * 0.14;
    context.beginPath();
    context.arc(point.x, point.y, particleRadius, 0, TAU);
    context.fill();
  }

  context.restore();
};

const drawPulseGrain = (
  context: CanvasRenderingContext2D,
  viewport: ViewportState,
  samples: readonly ContourSample[],
  elapsedMs: number
): void => {
  const elapsedSeconds = elapsedMs / 1000;

  context.save();
  context.fillStyle = "#171717";

  for (let index = 0; index < samples.length; index += 2) {
    const sample = samples[index];

    if (sample.pulseInfluence < 0.08) {
      continue;
    }

    const jitter =
      (Math.sin(sample.angleRad * 133 + elapsedSeconds * 7.2) +
        Math.sin(sample.angleRad * 79 - elapsedSeconds * 5.6)) /
      2;
    const grainRadius =
      sample.radius +
      jitter * viewport.outerRadius * 0.01 * sample.pulseInfluence +
      viewport.outerRadius * 0.008 * sample.pulseInfluence;
    const point = polarToCartesian(
      {
        radius: grainRadius,
        angleRad: sample.angleRad,
      },
      viewport.center
    );

    context.globalAlpha = 0.05 + sample.pulseInfluence * 0.11;
    context.beginPath();
    context.arc(point.x, point.y, 0.9 + sample.pulseInfluence * 1.05, 0, TAU);
    context.fill();
  }

  context.restore();
};

const drawDirectionalTears = (
  context: CanvasRenderingContext2D,
  viewport: ViewportState,
  theme: RehoboamTheme,
  pulses: readonly ActivePulseDescriptor[],
  elapsedMs: number,
  entranceScale: number
): void => {
  const strongestPulses = pulses.slice(0, 1);
  const elapsedSeconds = elapsedMs / 1000;
  const baseRadius = viewport.outerRadius * 0.84;

  context.save();
  context.fillStyle = theme.ringColor;
  context.strokeStyle = theme.ringColor;

  for (const pulse of strongestPulses) {
    const tearCount = getTearCountForSeverity(pulse.severity);

    for (let index = 0; index < tearCount; index += 1) {
      const normalizedIndex =
        tearCount <= 1 ? 0 : index / (tearCount - 1) - 0.5;
      const localOffset = normalizedIndex * 0.22;
      const flutter =
        Math.sin(elapsedSeconds * 0.7 + pulse.angleRad * 4 + index * 0.8) *
        0.014;
      const angleRad = normalizeAngle(pulse.angleRad + localOffset + flutter);
      const noise =
        (Math.sin(angleRad * 41 + index * 1.37 + elapsedSeconds * 4.6) + 1) / 2;
      const widthRad =
        (0.0036 + pulse.strength * 0.14 * (0.5 + noise * 0.7)) *
        entranceScale;
      const tearHeight =
        viewport.outerRadius *
        (0.014 + pulse.strength * 1.45) *
        (0.52 + noise * 1.18) *
        entranceScale;
      const tipRadius = baseRadius + tearHeight;
      const leftPoint = polarToCartesian(
        {
          radius: baseRadius,
          angleRad: normalizeAngle(angleRad - widthRad),
        },
        viewport.center
      );
      const rightPoint = polarToCartesian(
        {
          radius: baseRadius,
          angleRad: normalizeAngle(angleRad + widthRad),
        },
        viewport.center
      );
      const tipPoint = polarToCartesian(
        {
          radius: tipRadius,
          angleRad,
        },
        viewport.center
      );

      context.globalAlpha = (0.09 + pulse.strength * 4.4) * entranceScale;
      context.beginPath();
      context.moveTo(leftPoint.x, leftPoint.y);
      context.lineTo(tipPoint.x, tipPoint.y);
      context.lineTo(rightPoint.x, rightPoint.y);
      context.lineTo(leftPoint.x, leftPoint.y);
      context.fill();
      context.globalAlpha = (0.06 + pulse.strength * 2.4) * entranceScale;
      context.lineWidth = 0.95;
      context.stroke();
    }
  }

  context.restore();
};

export const drawDivergencePass = (input: DivergencePassInput): void => {
  const {
    context,
    viewport,
    theme,
    interaction,
    events,
    pulses,
    elapsedMs,
    timeMs,
    entranceScale,
  } = input;

  if (events.length === 0) {
    return;
  }

  const eventAnglesByEventId = resolveEventAnglesByEventId(events);
  const primaryEventId = resolvePrimaryEventId(
    events,
    eventAnglesByEventId,
    interaction
  );
  const primaryPulseEventId = resolvePrimaryPulseEventId(
    pulses,
    eventAnglesByEventId,
    interaction,
    timeMs
  );
  const activePulses =
    primaryPulseEventId === null
      ? []
      : pulses.filter((pulse) => {
          return pulse.eventId === primaryPulseEventId;
        });
  const activePulseDescriptors = resolveActivePulseDescriptors(
    activePulses,
    eventAnglesByEventId,
    timeMs
  );
  const idleTearDescriptor = createIdleTearDescriptor(
    events,
    eventAnglesByEventId,
    primaryEventId,
    elapsedMs
  );
  const directionalTears =
    activePulseDescriptors.length > 0
      ? activePulseDescriptors
      : idleTearDescriptor === null
        ? []
        : [idleTearDescriptor];
  const resolvedEntranceScale = Math.max(0, Math.min(1, entranceScale));
  const samples = createContourSamples(
    viewport,
    elapsedMs,
    timeMs,
    activePulses,
    eventAnglesByEventId,
    theme.divergenceSampleCount,
    resolvedEntranceScale
  );

  drawContourStroke(context, viewport, samples, theme.ringColor, 0.19, 1.45);
  drawFlowCircleLanes(context, viewport, theme, samples, elapsedMs);
  drawInterRingParticles(context, viewport, theme, samples, elapsedMs);
  drawPulseGrain(context, viewport, samples, elapsedMs);
  drawContourStroke(context, viewport, samples, theme.ringColor, 0.1, 4.9);
  drawDirectionalTears(
    context,
    viewport,
    theme,
    directionalTears,
    elapsedMs,
    resolvedEntranceScale
  );
};
