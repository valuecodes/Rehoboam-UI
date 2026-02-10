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
const MAX_RENDERABLE_PULSES = 14;
const MAX_AMBIENT_TEAR_SOURCES = 5;
const MAX_DIRECTIONAL_TEAR_SOURCES = 6;

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

type MountainWaveLayer = Readonly<{
  baseOffsetFactor: number;
  amplitudeFactor: number;
  crestFrequencyA: number;
  crestFrequencyB: number;
  driftCyclesPerSecond: number;
  fillAlpha: number;
  strokeAlpha: number;
  lineWidth: number;
}>;

type MountainWaveSample = Readonly<{
  angleRad: number;
  baseRadius: number;
  crestRadius: number;
  crestHeight: number;
}>;

const MOUNTAIN_WAVE_LAYERS: readonly MountainWaveLayer[] = [
  {
    baseOffsetFactor: 0.003,
    amplitudeFactor: 0.022,
    crestFrequencyA: 16,
    crestFrequencyB: 39,
    driftCyclesPerSecond: 0.08,
    fillAlpha: 0.082,
    strokeAlpha: 0.22,
    lineWidth: 1.18,
  },
  {
    baseOffsetFactor: 0.01,
    amplitudeFactor: 0.028,
    crestFrequencyA: 19,
    crestFrequencyB: 46,
    driftCyclesPerSecond: -0.06,
    fillAlpha: 0.065,
    strokeAlpha: 0.18,
    lineWidth: 1.04,
  },
  {
    baseOffsetFactor: 0.017,
    amplitudeFactor: 0.034,
    crestFrequencyA: 23,
    crestFrequencyB: 58,
    driftCyclesPerSecond: 0.07,
    fillAlpha: 0.052,
    strokeAlpha: 0.16,
    lineWidth: 0.92,
  },
  {
    baseOffsetFactor: 0.025,
    amplitudeFactor: 0.041,
    crestFrequencyA: 28,
    crestFrequencyB: 71,
    driftCyclesPerSecond: -0.05,
    fillAlpha: 0.043,
    strokeAlpha: 0.13,
    lineWidth: 0.82,
  },
] as const;

const sanitizeSampleCount = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 360;
  }

  return Math.max(96, Math.min(720, Math.trunc(value)));
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
  const descriptorByEventId = new Map<string, ActivePulseDescriptor>();

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

    const existingDescriptor = descriptorByEventId.get(pulse.eventId);

    if (existingDescriptor === undefined || strength > existingDescriptor.strength) {
      descriptorByEventId.set(pulse.eventId, {
        angleRad,
        strength,
        severity: pulse.severity,
      });
    }
  }

  return [...descriptorByEventId.values()].sort((left, right) => {
    if (left.strength !== right.strength) {
      return right.strength - left.strength;
    }

    return SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
  });
};

const getPulseStrength = (pulse: DivergencePulse, timeMs: number): number => {
  const elapsedPulseMs = timeMs - pulse.startedAtMs;

  return getPulseEnvelope(elapsedPulseMs) * PULSE_AMPLITUDE_SCALE[pulse.severity];
};

type PrioritizedPulse = Readonly<{
  pulse: DivergencePulse;
  strength: number;
}>;

const resolveRenderablePulses = (
  pulses: readonly DivergencePulse[],
  eventAnglesByEventId: ReadonlyMap<string, number>,
  interaction: InteractionState,
  timeMs: number
): readonly DivergencePulse[] => {
  const prioritizedPulses: PrioritizedPulse[] = [];

  for (const pulse of pulses) {
    if (!eventAnglesByEventId.has(pulse.eventId)) {
      continue;
    }

    const strength = getPulseStrength(pulse, timeMs);

    if (strength <= 0) {
      continue;
    }

    const isInteractionEvent =
      pulse.eventId === interaction.selectedEventId ||
      pulse.eventId === interaction.hoveredEventId ||
      pulse.eventId === interaction.hoverCandidateEventId;

    prioritizedPulses.push({
      pulse,
      strength: isInteractionEvent ? strength * 1.22 : strength,
    });
  }

  prioritizedPulses.sort((left, right) => {
    if (left.strength !== right.strength) {
      return right.strength - left.strength;
    }

    if (left.pulse.startedAtMs !== right.pulse.startedAtMs) {
      return right.pulse.startedAtMs - left.pulse.startedAtMs;
    }

    return left.pulse.eventId.localeCompare(right.pulse.eventId);
  });

  return prioritizedPulses
    .slice(0, MAX_RENDERABLE_PULSES)
    .map((prioritizedPulse) => {
      return prioritizedPulse.pulse;
    });
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

const getInteractionBoostForEvent = (
  eventId: string,
  interaction: InteractionState
): number => {
  if (eventId === interaction.selectedEventId) {
    return 1.45;
  }

  if (eventId === interaction.hoveredEventId) {
    return 1.3;
  }

  if (eventId === interaction.hoverCandidateEventId) {
    return 1.18;
  }

  return 1;
};

const resolveAmbientTearDescriptors = (
  events: readonly WorldEvent[],
  eventAnglesByEventId: ReadonlyMap<string, number>,
  interaction: InteractionState,
  elapsedMs: number
): readonly ActivePulseDescriptor[] => {
  const elapsedSeconds = elapsedMs / 1000;

  return [...events]
    .filter((event) => eventAnglesByEventId.has(event.id))
    .sort(compareEventsByPriority)
    .slice(0, MAX_AMBIENT_TEAR_SOURCES)
    .map((event, index) => {
      const angleRad = eventAnglesByEventId.get(event.id) ?? 0;
      const rankFalloff = Math.max(0.48, 1 - index * 0.14);
      const modulation =
        0.84 +
        0.16 *
          Math.sin(
            elapsedSeconds * (1.1 + index * 0.17) + angleRad * 1.9 + index * 0.44
          );

      return {
        angleRad,
        severity: event.severity,
        strength:
          IDLE_TEAR_STRENGTH[event.severity] *
          rankFalloff *
          modulation *
          getInteractionBoostForEvent(event.id, interaction),
      };
    });
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
  context.strokeStyle = theme.ringColor;
  context.setLineDash([]);
  context.lineDashOffset = 0;

  for (const layer of MOUNTAIN_WAVE_LAYERS) {
    const mountainSamples: MountainWaveSample[] = Array.from(
      { length: sampleCount + 1 },
      (_, index) => {
        const sample = samples[index];
        const baseRadius = sample.radius + viewport.outerRadius * layer.baseOffsetFactor;
        const carrierEnvelope =
          0.4 +
          ((Math.sin(sample.angleRad * 7.2 + elapsedSeconds * 0.4) + 1) / 2) * 0.6;
        const waveA =
          (Math.sin(
            sample.angleRad * layer.crestFrequencyA +
              elapsedSeconds * layer.driftCyclesPerSecond * TAU
          ) +
            1) /
          2;
        const waveB =
          (Math.sin(
            sample.angleRad * layer.crestFrequencyB -
              elapsedSeconds *
                layer.driftCyclesPerSecond *
                1.7 *
                TAU +
              layer.baseOffsetFactor * 180
          ) +
            1) /
          2;
        const jaggedness = Math.pow(waveA, 3) * 0.58 + Math.pow(waveB, 6) * 0.42;
        const pulseBoost = 0.74 + Math.pow(sample.pulseInfluence, 0.78) * 2.8;
        const crestHeight =
          viewport.outerRadius *
          layer.amplitudeFactor *
          carrierEnvelope *
          jaggedness *
          pulseBoost;

        return {
          angleRad: sample.angleRad,
          baseRadius,
          crestRadius: baseRadius + crestHeight,
          crestHeight,
        };
      }
    );

    context.globalAlpha = layer.fillAlpha;
    context.beginPath();

    for (let index = 0; index < mountainSamples.length; index += 1) {
      const mountainSample = mountainSamples[index];
      const crestPoint = polarToCartesian(
        {
          radius: mountainSample.crestRadius,
          angleRad: mountainSample.angleRad,
        },
        viewport.center
      );

      if (index === 0) {
        context.moveTo(crestPoint.x, crestPoint.y);
      } else {
        context.lineTo(crestPoint.x, crestPoint.y);
      }
    }

    for (let index = mountainSamples.length - 1; index >= 0; index -= 1) {
      const mountainSample = mountainSamples[index];
      const basePoint = polarToCartesian(
        {
          radius: mountainSample.baseRadius,
          angleRad: mountainSample.angleRad,
        },
        viewport.center
      );

      context.lineTo(basePoint.x, basePoint.y);
    }

    const firstMountainSample = mountainSamples[0];
    const firstCrestPoint = polarToCartesian(
      {
        radius: firstMountainSample.crestRadius,
        angleRad: firstMountainSample.angleRad,
      },
      viewport.center
    );
    context.lineTo(firstCrestPoint.x, firstCrestPoint.y);
    context.fill();

    context.globalAlpha = layer.strokeAlpha;
    context.lineWidth = layer.lineWidth;
    context.beginPath();

    for (let index = 0; index < mountainSamples.length; index += 1) {
      const mountainSample = mountainSamples[index];
      const crestPoint = polarToCartesian(
        {
          radius: mountainSample.crestRadius,
          angleRad: mountainSample.angleRad,
        },
        viewport.center
      );

      if (index === 0) {
        context.moveTo(crestPoint.x, crestPoint.y);
      } else {
        context.lineTo(crestPoint.x, crestPoint.y);
      }
    }

    context.stroke();
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
  const strongestPulses = pulses.slice(0, MAX_DIRECTIONAL_TEAR_SOURCES);
  const elapsedSeconds = elapsedMs / 1000;
  const baseRadius = viewport.outerRadius * 0.84;

  context.save();
  context.fillStyle = theme.ringColor;
  context.strokeStyle = theme.ringColor;

  for (let sourceIndex = 0; sourceIndex < strongestPulses.length; sourceIndex += 1) {
    const pulse = strongestPulses[sourceIndex];
    const tearCount = getTearCountForSeverity(pulse.severity);
    const sourceFalloff = Math.max(0.46, 1 - sourceIndex * 0.13);

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
        sourceFalloff *
        entranceScale;
      const tearHeight =
        viewport.outerRadius *
        (0.014 + pulse.strength * 1.45) *
        (0.52 + noise * 1.18) *
        sourceFalloff *
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

      context.globalAlpha =
        (0.09 + pulse.strength * 4.4) * sourceFalloff * entranceScale;
      context.beginPath();
      context.moveTo(leftPoint.x, leftPoint.y);
      context.lineTo(tipPoint.x, tipPoint.y);
      context.lineTo(rightPoint.x, rightPoint.y);
      context.lineTo(leftPoint.x, leftPoint.y);
      context.fill();
      context.globalAlpha =
        (0.06 + pulse.strength * 2.4) * sourceFalloff * entranceScale;
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
  const renderablePulses = resolveRenderablePulses(
    pulses,
    eventAnglesByEventId,
    interaction,
    timeMs
  );
  const activePulseDescriptors = resolveActivePulseDescriptors(
    renderablePulses,
    eventAnglesByEventId,
    timeMs
  );
  const ambientTearDescriptors = resolveAmbientTearDescriptors(
    events,
    eventAnglesByEventId,
    interaction,
    elapsedMs
  );
  const directionalTears = [...activePulseDescriptors, ...ambientTearDescriptors]
    .sort((left, right) => {
      return right.strength - left.strength;
    })
    .slice(0, MAX_DIRECTIONAL_TEAR_SOURCES);
  const resolvedEntranceScale = Math.max(0, Math.min(1, entranceScale));
  const samples = createContourSamples(
    viewport,
    elapsedMs,
    timeMs,
    renderablePulses,
    eventAnglesByEventId,
    theme.divergenceSampleCount,
    resolvedEntranceScale
  );

  drawContourStroke(context, viewport, samples, theme.ringColor, 0.19, 1.45);
  drawFlowCircleLanes(context, viewport, theme, samples, elapsedMs);
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
