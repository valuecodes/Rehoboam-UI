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
import type { DivergenceCluster } from "../divergence-cluster-tracker";
import {
  DIVERGENCE_ATTACK_MS,
  DIVERGENCE_DECAY_MS,
  DIVERGENCE_PULSE_LIFETIME_MS,
} from "../divergence-constants";
import type { DivergencePulse } from "../divergence-pulse-tracker";

const LEADING_TIME_OFFSET_MS = 45 * 60 * 1000;
const MAX_RENDERABLE_PULSES = 14;
const MAX_MOUNTAIN_EXTENSION_SOURCES = 16;
const MAX_RENDERABLE_PULSE_EXTENSIONS = 4;
const MAX_SPIKE_DESCRIPTORS_PER_CLUSTER = 3;
const CORE_RING_RADIUS_FACTOR = 0.84;
const BASE_WAVE_COLOR = "#101010";
const ACCENT_WAVE_COLOR = "#040404";
const CLUSTER_MODULATION_SPEED_SCALE = 0.52;
const EXTENSION_INFLUENCE_SCALE = 15;
const EXTENSION_OFFSET_SCALE = 1.05;
const EXTENSION_OUTWARD_OFFSET_CAP = 0.043;
const EXTENSION_INWARD_OFFSET_CAP = 0.04;
const BASELINE_WAVE_FREQUENCIES = [5, 9, 14] as const;
const MOUNTAIN_CARRIER_FREQUENCY = 7;
const CORE_CONTOUR_OUTWARD_DELTA_GAIN = 0.18;
const CORE_CONTOUR_OUTWARD_PULSE_DELTA_GAIN = 0.1;
const CORE_CONTOUR_INWARD_DELTA_GAIN = 0.8;
const CORE_CONTOUR_INWARD_PULSE_DELTA_GAIN = 0.32;
const CORE_CONTOUR_MAX_OUTWARD_FACTOR = 0.0065;
const CORE_CONTOUR_MAX_INWARD_FACTOR = 0.03;
const SEAM_UNDERPAINT_MIN_WIDTH_FACTOR = 0.004;
const SEAM_UNDERPAINT_BASE_OUTER_FACTOR = 0.0065;
const SEAM_UNDERPAINT_EXTENSION_GAIN_FACTOR = 0.008;
const SEAM_UNDERPAINT_EXTENSION_CAP_FACTOR = 0.015;
const SEAM_UNDERPAINT_CREST_GAIN = 0.18;
const SEAM_UNDERPAINT_CREST_CAP_FACTOR = 0.012;
const SEAM_UNDERPAINT_GRADIENT_INNER_OFFSET_FACTOR = 0.013;
const SEAM_UNDERPAINT_GRADIENT_OUTER_OFFSET_FACTOR = 0.056;
const BOTTOM_WAVE_DARKEN_WINDOW_RAD = Math.PI * 0.84;
const BOTTOM_WAVE_DARKEN_THRESHOLD = 0.18;

const SEVERITY_RANK: Readonly<Record<WorldEventSeverity, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const PULSE_AMPLITUDE_SCALE: Readonly<Record<WorldEventSeverity, number>> = {
  low: 0.02,
  medium: 0.035,
  high: 0.056,
  critical: 0.09,
};

const PULSE_WINDOW_RAD: Readonly<Record<WorldEventSeverity, number>> = {
  low: 0.085,
  medium: 0.112,
  high: 0.142,
  critical: 0.17,
};
const UINT32_RANGE = 0x1_0000_0000;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export type DivergencePassInput = Readonly<{
  context: CanvasRenderingContext2D;
  viewport: ViewportState;
  theme: RehoboamTheme;
  interaction: InteractionState;
  events: readonly WorldEvent[];
  pulses: readonly DivergencePulse[];
  clusters: readonly DivergenceCluster[];
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
  windowScale: number;
  phaseOffsetRad: number;
}>;

type ExtensionOffsetResolution = Readonly<{
  offset: number;
  influenceEnergy: number;
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
  extensionInfluence: number;
  bottomWeight: number;
}>;

type CartesianPoint = Readonly<{
  x: number;
  y: number;
}>;

const MOUNTAIN_WAVE_LAYERS: readonly MountainWaveLayer[] = [
  {
    baseOffsetFactor: 0.003,
    amplitudeFactor: 0.045,
    crestFrequencyA: 18,
    crestFrequencyB: 50,
    driftCyclesPerSecond: 0.08,
    fillAlpha: 0.24,
    strokeAlpha: 0.58,
    lineWidth: 1.24,
  },
  {
    baseOffsetFactor: 0.01,
    amplitudeFactor: 0.062,
    crestFrequencyA: 24,
    crestFrequencyB: 66,
    driftCyclesPerSecond: -0.06,
    fillAlpha: 0.205,
    strokeAlpha: 0.49,
    lineWidth: 1.06,
  },
  {
    baseOffsetFactor: 0.017,
    amplitudeFactor: 0.081,
    crestFrequencyA: 31,
    crestFrequencyB: 84,
    driftCyclesPerSecond: 0.07,
    fillAlpha: 0.168,
    strokeAlpha: 0.44,
    lineWidth: 0.92,
  },
  {
    baseOffsetFactor: 0.025,
    amplitudeFactor: 0.106,
    crestFrequencyA: 38,
    crestFrequencyB: 108,
    driftCyclesPerSecond: -0.05,
    fillAlpha: 0.13,
    strokeAlpha: 0.39,
    lineWidth: 0.8,
  },
] as const;

const sanitizeSampleCount = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 360;
  }

  return Math.max(96, Math.min(720, Math.trunc(value)));
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

const getBottomWaveWeight = (angleRad: number): number => {
  const distanceFromBottomRad = Math.abs(
    shortestAngularDistance(angleRad, Math.PI)
  );

  return getRaisedCosineWindow(
    distanceFromBottomRad,
    BOTTOM_WAVE_DARKEN_WINDOW_RAD
  );
};

const getSeverityExtensionWindowRad = (
  severity: WorldEventSeverity
): number => {
  if (severity === "critical") {
    return 0.2;
  }

  if (severity === "high") {
    return 0.172;
  }

  if (severity === "medium") {
    return 0.138;
  }

  return 0.112;
};

const getExtensionWindowRad = (descriptor: ActivePulseDescriptor): number => {
  const scaledWindowRad =
    getSeverityExtensionWindowRad(descriptor.severity) * descriptor.windowScale;

  return Math.max(0.048, Math.min(0.27, scaledWindowRad));
};

const hashStringToUnitInterval = (value: string): number => {
  let hash = FNV_OFFSET_BASIS;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }

  return (hash >>> 0) / UINT32_RANGE;
};

const resolveStablePhaseOffsetRad = (key: string): number => {
  return hashStringToUnitInterval(key) * TAU;
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

    if (
      existingDescriptor === undefined ||
      strength > existingDescriptor.strength
    ) {
      descriptorByEventId.set(pulse.eventId, {
        angleRad,
        strength,
        severity: pulse.severity,
        windowScale: 1,
        phaseOffsetRad: resolveStablePhaseOffsetRad(`pulse:${pulse.eventId}`),
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

  return (
    getPulseEnvelope(elapsedPulseMs) * PULSE_AMPLITUDE_SCALE[pulse.severity]
  );
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

const getClusterEnvelope = (
  cluster: DivergenceCluster,
  timeMs: number
): number => {
  const attackMs = Math.max(0, cluster.attackMs);
  const holdMs = Math.max(0, cluster.holdMs);
  const decayMs = Math.max(0, cluster.decayMs);
  const elapsedMs = timeMs - cluster.startedAtMs;

  if (elapsedMs <= 0) {
    return 0;
  }

  if (attackMs > 0 && elapsedMs <= attackMs) {
    const attackProgress = elapsedMs / attackMs;

    return attackProgress * attackProgress;
  }

  const sustainEndMs = attackMs + holdMs;

  if (elapsedMs <= sustainEndMs) {
    return 1;
  }

  if (decayMs <= 0) {
    return 0;
  }

  const decayProgress = (elapsedMs - sustainEndMs) / decayMs;

  if (decayProgress >= 1) {
    return 0;
  }

  return (1 - decayProgress) ** 2;
};

const resolveClusterDescriptors = (
  clusters: readonly DivergenceCluster[],
  elapsedMs: number,
  timeMs: number
): readonly ActivePulseDescriptor[] => {
  const elapsedSeconds = elapsedMs / 1000;
  const clusterDescriptors: ActivePulseDescriptor[] = [];

  for (const cluster of clusters) {
    const clusterEnvelope = getClusterEnvelope(cluster, timeMs);

    if (clusterEnvelope <= 0) {
      continue;
    }

    const ageSeconds = Math.max(0, (timeMs - cluster.startedAtMs) / 1000);
    const angleRad = normalizeAngle(
      cluster.centerAngleRad + cluster.driftRadPerSecond * ageSeconds
    );
    const baseWindowRad = getSeverityExtensionWindowRad(cluster.severity);
    const flareModulation =
      0.78 +
      0.22 *
        Math.sin(
          elapsedSeconds *
            CLUSTER_MODULATION_SPEED_SCALE *
            cluster.flareSpeedHz *
            TAU +
            cluster.flarePhaseOffsetRad
        );
    const baseStrength = cluster.strength * clusterEnvelope * flareModulation;

    if (baseStrength <= 0) {
      continue;
    }

    clusterDescriptors.push({
      angleRad,
      strength: baseStrength,
      severity: cluster.severity,
      windowScale: Math.max(
        0.7,
        Math.min(1.65, cluster.widthRad / baseWindowRad)
      ),
      phaseOffsetRad: resolveStablePhaseOffsetRad(`cluster:${cluster.id}`),
    });

    for (const [spikeIndex, spike] of cluster.spikes
      .slice(0, MAX_SPIKE_DESCRIPTORS_PER_CLUSTER)
      .entries()) {
      const spikeFlicker =
        0.72 +
        0.28 *
          Math.sin(
            elapsedSeconds *
              CLUSTER_MODULATION_SPEED_SCALE *
              spike.flickerHz *
              TAU +
              spike.phaseOffsetRad
          );
      const spikeStrength = baseStrength * spike.strengthScale * spikeFlicker;

      if (spikeStrength <= 0) {
        continue;
      }

      clusterDescriptors.push({
        angleRad: normalizeAngle(angleRad + spike.angleOffsetRad),
        strength: spikeStrength,
        severity: cluster.severity,
        windowScale: Math.max(
          0.28,
          Math.min(1.12, spike.widthRad / baseWindowRad)
        ),
        phaseOffsetRad: resolveStablePhaseOffsetRad(
          `cluster:${cluster.id}:spike:${spikeIndex}`
        ),
      });
    }
  }

  return clusterDescriptors;
};

type ResolveExtensionOffsetInput = Readonly<{
  angleRad: number;
  elapsedSeconds: number;
  extensions: readonly ActivePulseDescriptor[];
  viewportOuterRadius: number;
  entranceScale: number;
}>;

const resolveExtensionOffset = (
  input: ResolveExtensionOffsetInput
): ExtensionOffsetResolution => {
  const {
    angleRad,
    elapsedSeconds,
    extensions,
    viewportOuterRadius,
    entranceScale,
  } = input;

  let extensionInfluenceEnergy = 0;
  let outwardOffset = 0;
  let inwardOffset = 0;

  for (const extension of extensions) {
    const angularDistance = Math.abs(
      shortestAngularDistance(angleRad, extension.angleRad)
    );
    const extensionWindowRad = getExtensionWindowRad(extension);
    const angularEnvelope = getRaisedCosineWindow(
      angularDistance,
      extensionWindowRad
    );

    if (angularEnvelope <= 0) {
      continue;
    }

    const shimmer =
      0.7 +
      0.3 *
        Math.sin(
          elapsedSeconds *
            (0.34 + extension.windowScale * 0.18) *
            CLUSTER_MODULATION_SPEED_SCALE +
            extension.angleRad * 2.4
        );
    const influence =
      angularEnvelope *
      Math.min(1, extension.strength * EXTENSION_INFLUENCE_SCALE);
    extensionInfluenceEnergy += influence;
    const outwardContribution = extension.strength * influence * shimmer;

    const notchCarrier =
      0.5 +
      0.5 *
        Math.sin(
          angleRad * (21 + extension.windowScale * 4.6) -
            elapsedSeconds * (1.4 + extension.windowScale * 0.18) +
            extension.angleRad * 2.7 +
            extension.phaseOffsetRad
        );
    const notchShape = Math.pow(notchCarrier, 2.45);
    const inwardScale = 0.92 + extension.windowScale * 0.34;
    const signedContribution =
      outwardContribution -
      extension.strength * influence * inwardScale * notchShape;

    if (signedContribution >= 0) {
      outwardOffset += signedContribution;
      continue;
    }

    inwardOffset += Math.abs(signedContribution);
  }

  const outwardSoftCapScale =
    1 - Math.min(0.26, extensionInfluenceEnergy * 0.094);
  const cappedOutwardOffset = Math.min(
    EXTENSION_OUTWARD_OFFSET_CAP * outwardSoftCapScale,
    outwardOffset * EXTENSION_OFFSET_SCALE
  );
  const cappedInwardOffset = Math.min(
    EXTENSION_INWARD_OFFSET_CAP,
    inwardOffset * EXTENSION_OFFSET_SCALE * 1.12
  );

  return {
    offset:
      viewportOuterRadius *
      (cappedOutwardOffset - cappedInwardOffset) *
      entranceScale,
    influenceEnergy: extensionInfluenceEnergy,
  };
};

const createContourSamples = (
  viewport: ViewportState,
  elapsedMs: number,
  timeMs: number,
  pulses: readonly DivergencePulse[],
  pulseAngles: ReadonlyMap<string, number>,
  extensions: readonly ActivePulseDescriptor[],
  sampleCount: number,
  entranceScale: number
): readonly ContourSample[] => {
  const samples = sanitizeSampleCount(sampleCount);
  const elapsedSeconds = elapsedMs / 1000;
  const baseRadius = viewport.outerRadius * CORE_RING_RADIUS_FACTOR;

  return Array.from({ length: samples + 1 }, (_, index) => {
    const angleRad = (index / samples) * TAU;
    const baselineOffset =
      Math.sin(
        angleRad * BASELINE_WAVE_FREQUENCIES[0] - elapsedSeconds * 0.42
      ) *
        viewport.outerRadius *
        0.0039 +
      Math.sin(
        angleRad * BASELINE_WAVE_FREQUENCIES[1] + elapsedSeconds * 0.74
      ) *
        viewport.outerRadius *
        0.0028 +
      Math.sin(
        angleRad * BASELINE_WAVE_FREQUENCIES[2] - elapsedSeconds * 1.05
      ) *
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
    const {
      offset: extensionOffset,
      influenceEnergy: extensionInfluenceEnergy,
    } = resolveExtensionOffset({
      angleRad,
      elapsedSeconds,
      extensions,
      viewportOuterRadius: viewport.outerRadius,
      entranceScale,
    });
    pulseInfluence += Math.min(1.2, extensionInfluenceEnergy * 0.55);
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
        extensionOffset +
        grainOffset +
        roughnessOffset,
      pulseInfluence: Math.min(1, pulseInfluence) * entranceScale,
    };
  });
};

const resolveCoreContourRadius = (
  sample: ContourSample,
  viewport: ViewportState
): number => {
  const baseRadius = viewport.outerRadius * CORE_RING_RADIUS_FACTOR;
  const radiusDelta = sample.radius - baseRadius;
  const gain =
    radiusDelta >= 0
      ? CORE_CONTOUR_OUTWARD_DELTA_GAIN +
        sample.pulseInfluence * CORE_CONTOUR_OUTWARD_PULSE_DELTA_GAIN
      : CORE_CONTOUR_INWARD_DELTA_GAIN +
        sample.pulseInfluence * CORE_CONTOUR_INWARD_PULSE_DELTA_GAIN;
  const scaledDelta = radiusDelta * gain;
  const maxOutwardDelta =
    viewport.outerRadius * CORE_CONTOUR_MAX_OUTWARD_FACTOR;
  const maxInwardDelta = viewport.outerRadius * CORE_CONTOUR_MAX_INWARD_FACTOR;
  const clampedDelta = Math.max(
    -maxInwardDelta,
    Math.min(maxOutwardDelta, scaledDelta)
  );

  return baseRadius + clampedDelta;
};

const pointsAreEquivalent = (
  left: CartesianPoint,
  right: CartesianPoint
): boolean => {
  return (
    Math.abs(left.x - right.x) <= 0.0001 && Math.abs(left.y - right.y) <= 0.0001
  );
};

const toClosedLoopPoints = (
  points: readonly CartesianPoint[]
): readonly CartesianPoint[] => {
  if (points.length < 2) {
    return points;
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  if (!pointsAreEquivalent(firstPoint, lastPoint)) {
    return points;
  }

  return points.slice(0, points.length - 1);
};

const toMidpoint = (
  left: CartesianPoint,
  right: CartesianPoint
): CartesianPoint => {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };
};

const supportsQuadraticCurveTo = (
  context: CanvasRenderingContext2D
): boolean => {
  const maybeContext = context as CanvasRenderingContext2D & {
    quadraticCurveTo?: CanvasRenderingContext2D["quadraticCurveTo"];
  };

  return typeof maybeContext.quadraticCurveTo === "function";
};

const traceClosedLinearPath = (
  context: CanvasRenderingContext2D,
  sourcePoints: readonly CartesianPoint[]
): void => {
  const points = toClosedLoopPoints(sourcePoints);

  if (points.length === 0) {
    return;
  }

  context.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    context.lineTo(point.x, point.y);
  }

  context.closePath();
};

const traceOpenLinearPath = (
  context: CanvasRenderingContext2D,
  points: readonly CartesianPoint[],
  moveToFirst: boolean
): void => {
  if (points.length === 0) {
    return;
  }

  if (moveToFirst) {
    context.moveTo(points[0].x, points[0].y);
  }

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    context.lineTo(point.x, point.y);
  }
};

const traceBandFillPath = (
  context: CanvasRenderingContext2D,
  crestPoints: readonly CartesianPoint[],
  basePoints: readonly CartesianPoint[]
): void => {
  if (crestPoints.length === 0 || basePoints.length === 0) {
    return;
  }

  context.moveTo(crestPoints[0].x, crestPoints[0].y);
  traceOpenCurvePath(context, crestPoints, false);
  context.lineTo(basePoints[0].x, basePoints[0].y);
  traceOpenCurvePath(context, basePoints, false);
  context.closePath();
};

const traceClosedBandFillPath = (
  context: CanvasRenderingContext2D,
  crestPoints: readonly CartesianPoint[],
  basePoints: readonly CartesianPoint[]
): void => {
  const closedCrestPoints = toClosedLoopPoints(crestPoints);
  const closedBasePoints = toClosedLoopPoints(basePoints);

  if (closedCrestPoints.length < 2 || closedBasePoints.length < 2) {
    return;
  }

  traceClosedCurvePath(context, closedCrestPoints);
  traceClosedCurvePath(context, closedBasePoints);
};

const traceClosedCurvePath = (
  context: CanvasRenderingContext2D,
  sourcePoints: readonly CartesianPoint[]
): void => {
  if (!supportsQuadraticCurveTo(context)) {
    traceClosedLinearPath(context, sourcePoints);

    return;
  }

  const points = toClosedLoopPoints(sourcePoints);

  if (points.length === 0) {
    return;
  }

  if (points.length === 1) {
    context.moveTo(points[0].x, points[0].y);

    return;
  }

  if (points.length === 2) {
    context.moveTo(points[0].x, points[0].y);
    context.lineTo(points[1].x, points[1].y);
    context.closePath();

    return;
  }

  const firstMidpoint = toMidpoint(points[0], points[1]);
  context.moveTo(firstMidpoint.x, firstMidpoint.y);

  for (let index = 1; index < points.length; index += 1) {
    const currentPoint = points[index];
    const nextPoint = points[(index + 1) % points.length];
    const midpoint = toMidpoint(currentPoint, nextPoint);

    context.quadraticCurveTo(
      currentPoint.x,
      currentPoint.y,
      midpoint.x,
      midpoint.y
    );
  }

  context.closePath();
};

const traceOpenCurvePath = (
  context: CanvasRenderingContext2D,
  points: readonly CartesianPoint[],
  moveToFirst = true
): void => {
  if (!supportsQuadraticCurveTo(context)) {
    traceOpenLinearPath(context, points, moveToFirst);

    return;
  }

  if (points.length === 0) {
    return;
  }

  if (moveToFirst) {
    context.moveTo(points[0].x, points[0].y);
  }

  if (points.length === 1) {
    return;
  }

  if (points.length === 2) {
    context.lineTo(points[1].x, points[1].y);

    return;
  }

  for (let index = 1; index < points.length - 1; index += 1) {
    const currentPoint = points[index];
    const nextPoint = points[index + 1];
    const midpoint = toMidpoint(currentPoint, nextPoint);

    context.quadraticCurveTo(
      currentPoint.x,
      currentPoint.y,
      midpoint.x,
      midpoint.y
    );
  }

  const lastPoint = points[points.length - 1];
  context.lineTo(lastPoint.x, lastPoint.y);
};

const drawFlowCircleLanes = (
  context: CanvasRenderingContext2D,
  viewport: ViewportState,
  samples: readonly ContourSample[],
  extensions: readonly ActivePulseDescriptor[],
  elapsedMs: number
): void => {
  const sampleCount = samples.length - 1;

  if (sampleCount <= 0) {
    return;
  }

  const elapsedSeconds = elapsedMs / 1000;

  context.save();
  context.globalCompositeOperation = "multiply";
  context.fillStyle = BASE_WAVE_COLOR;
  context.strokeStyle = BASE_WAVE_COLOR;
  context.setLineDash([]);
  context.lineDashOffset = 0;
  context.lineJoin = "round";
  context.lineCap = "round";
  const coreContourRadii = samples.map((sample) => {
    return resolveCoreContourRadius(sample, viewport);
  });
  const contourPoints = samples.map((sample, index) => {
    const coreRadius = resolveCoreContourRadius(sample, viewport);
    const point = polarToCartesian(
      {
        radius: coreContourRadii[index] ?? coreRadius,
        angleRad: sample.angleRad,
      },
      viewport.center
    );

    return {
      x: point.x,
      y: point.y,
    };
  });
  const drawCoreSeamUnderpaint = (
    mountainSamples: readonly MountainWaveSample[]
  ): void => {
    if (mountainSamples.length === 0 || contourPoints.length <= 1) {
      return;
    }

    const seamOuterPoints = mountainSamples.map((mountainSample, index) => {
      const coreContourRadius =
        coreContourRadii[index] ??
        viewport.outerRadius * CORE_RING_RADIUS_FACTOR;
      const extensionLift = Math.min(
        viewport.outerRadius * SEAM_UNDERPAINT_EXTENSION_CAP_FACTOR,
        mountainSample.extensionInfluence *
          viewport.outerRadius *
          SEAM_UNDERPAINT_EXTENSION_GAIN_FACTOR
      );
      const crestLift = Math.min(
        viewport.outerRadius * SEAM_UNDERPAINT_CREST_CAP_FACTOR,
        mountainSample.crestHeight * SEAM_UNDERPAINT_CREST_GAIN
      );
      const targetOuterRadius =
        mountainSample.baseRadius +
        viewport.outerRadius * SEAM_UNDERPAINT_BASE_OUTER_FACTOR +
        extensionLift +
        crestLift;
      const minimumOuterRadius =
        coreContourRadius +
        viewport.outerRadius * SEAM_UNDERPAINT_MIN_WIDTH_FACTOR;
      const outerRadius = Math.max(minimumOuterRadius, targetOuterRadius);
      const point = polarToCartesian(
        {
          radius: outerRadius,
          angleRad: mountainSample.angleRad,
        },
        viewport.center
      );

      return {
        x: point.x,
        y: point.y,
      };
    });

    const gradientInnerRadius =
      viewport.outerRadius *
      Math.max(
        0,
        CORE_RING_RADIUS_FACTOR - SEAM_UNDERPAINT_GRADIENT_INNER_OFFSET_FACTOR
      );
    const gradientOuterRadius =
      viewport.outerRadius *
      (CORE_RING_RADIUS_FACTOR + SEAM_UNDERPAINT_GRADIENT_OUTER_OFFSET_FACTOR);

    if (gradientOuterRadius <= gradientInnerRadius) {
      return;
    }

    const maybeContext = context as CanvasRenderingContext2D & {
      createRadialGradient?: CanvasRenderingContext2D["createRadialGradient"];
    };

    if (typeof maybeContext.createRadialGradient !== "function") {
      context.globalAlpha = 0.22;
      context.fillStyle = BASE_WAVE_COLOR;
      context.beginPath();
      traceClosedBandFillPath(context, seamOuterPoints, contourPoints);
      context.fill("evenodd");

      return;
    }

    const seamGradient = maybeContext.createRadialGradient(
      viewport.center.x,
      viewport.center.y,
      gradientInnerRadius,
      viewport.center.x,
      viewport.center.y,
      gradientOuterRadius
    );
    seamGradient.addColorStop(0, "rgba(4, 4, 4, 0)");
    seamGradient.addColorStop(0.38, "rgba(4, 4, 4, 0.42)");
    seamGradient.addColorStop(0.7, "rgba(16, 16, 16, 0.2)");
    seamGradient.addColorStop(1, "rgba(16, 16, 16, 0)");

    context.globalAlpha = 1;
    context.fillStyle = seamGradient;
    context.beginPath();
    traceClosedBandFillPath(context, seamOuterPoints, contourPoints);
    context.fill("evenodd");
  };

  const strokeCoreContour = (
    lineWidth: number,
    alpha: number,
    strokeStyle: string
  ): void => {
    context.globalAlpha = alpha;
    context.strokeStyle = strokeStyle;
    context.lineWidth = lineWidth;
    context.beginPath();
    traceClosedCurvePath(context, contourPoints);
    context.stroke();
  };

  strokeCoreContour(
    Math.max(1.35, viewport.outerRadius * 0.0082),
    0.72,
    ACCENT_WAVE_COLOR
  );
  strokeCoreContour(
    Math.max(2, viewport.outerRadius * 0.015),
    0.28,
    BASE_WAVE_COLOR
  );

  for (const [layerIndex, layer] of MOUNTAIN_WAVE_LAYERS.entries()) {
    const mountainSamples: MountainWaveSample[] = Array.from(
      { length: sampleCount + 1 },
      (_, index) => {
        const sample = samples[index];
        const baseRadius =
          sample.radius + viewport.outerRadius * layer.baseOffsetFactor;
        const carrierEnvelope =
          0.4 +
          ((Math.sin(
            sample.angleRad * MOUNTAIN_CARRIER_FREQUENCY + elapsedSeconds * 0.4
          ) +
            1) /
            2) *
            0.6;
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
              elapsedSeconds * layer.driftCyclesPerSecond * 1.7 * TAU +
              layer.baseOffsetFactor * 180
          ) +
            1) /
          2;
        const extensionStrength = extensions.reduce((sum, extension) => {
          const extensionDistance = Math.abs(
            shortestAngularDistance(sample.angleRad, extension.angleRad)
          );
          const extensionWindowRad = getExtensionWindowRad(extension);
          const extensionEnvelope = getRaisedCosineWindow(
            extensionDistance,
            extensionWindowRad
          );

          if (extensionEnvelope <= 0) {
            return sum;
          }

          return sum + extension.strength * extensionEnvelope;
        }, 0);
        const normalizedExtension = Math.pow(
          Math.min(1, extensionStrength * 10.6),
          1.25
        );
        const ridgeShape =
          Math.pow(waveA, 4) * 0.46 + Math.pow(waveB, 8) * 0.24;
        const needleShape =
          Math.pow(Math.max(waveA, waveB), 14) *
          (0.05 + normalizedExtension * 1.8);
        const jaggedness = ridgeShape + needleShape;
        const pulseBoost =
          0.58 +
          Math.pow(sample.pulseInfluence, 0.82) * 2.9 +
          normalizedExtension * 3.1;
        const crestHeight =
          viewport.outerRadius *
          layer.amplitudeFactor *
          carrierEnvelope *
          jaggedness *
          pulseBoost;
        const cappedCrestHeight = Math.min(
          viewport.outerRadius * 0.16,
          crestHeight
        );

        return {
          angleRad: sample.angleRad,
          baseRadius,
          crestRadius: baseRadius + cappedCrestHeight,
          crestHeight: cappedCrestHeight,
          extensionInfluence: normalizedExtension,
          bottomWeight: getBottomWaveWeight(sample.angleRad),
        };
      }
    );
    const peakExtensionInfluence = mountainSamples.reduce(
      (peak, mountainSample) => {
        return Math.max(peak, mountainSample.extensionInfluence);
      },
      0
    );
    const layerFillAlpha = Math.min(
      0.34,
      layer.fillAlpha + peakExtensionInfluence * 0.13
    );
    const layerStrokeAlpha = Math.min(
      0.86,
      layer.strokeAlpha + peakExtensionInfluence * 0.34
    );
    const crestPoints = mountainSamples.map((mountainSample) => {
      const crestPoint = polarToCartesian(
        {
          radius: mountainSample.crestRadius,
          angleRad: mountainSample.angleRad,
        },
        viewport.center
      );

      return {
        x: crestPoint.x,
        y: crestPoint.y,
      };
    });
    const basePoints = [...mountainSamples].reverse().map((mountainSample) => {
      const basePoint = polarToCartesian(
        {
          radius: mountainSample.baseRadius,
          angleRad: mountainSample.angleRad,
        },
        viewport.center
      );

      return {
        x: basePoint.x,
        y: basePoint.y,
      };
    });

    if (layerIndex === 0) {
      drawCoreSeamUnderpaint(mountainSamples);
    }

    context.fillStyle = BASE_WAVE_COLOR;
    context.globalAlpha = layerFillAlpha;
    context.beginPath();
    traceClosedBandFillPath(context, crestPoints, basePoints);
    context.fill("evenodd");

    context.strokeStyle = ACCENT_WAVE_COLOR;
    context.globalAlpha = layerStrokeAlpha;
    context.lineWidth = layer.lineWidth;
    context.beginPath();
    traceClosedCurvePath(context, crestPoints);
    context.stroke();

    let bottomSegment: MountainWaveSample[] = [];
    const flushBottomSegment = (): void => {
      if (bottomSegment.length < 2) {
        bottomSegment = [];

        return;
      }

      const averageBottomWeight =
        bottomSegment.reduce((sum, sample) => {
          return sum + sample.bottomWeight;
        }, 0) / bottomSegment.length;
      const peakBottomExtension = bottomSegment.reduce((peak, sample) => {
        return Math.max(peak, sample.extensionInfluence * sample.bottomWeight);
      }, 0);
      const crestSegmentPoints = bottomSegment.map((sample) => {
        const point = polarToCartesian(
          {
            radius: sample.crestRadius,
            angleRad: sample.angleRad,
          },
          viewport.center
        );

        return {
          x: point.x,
          y: point.y,
        };
      });
      const baseSegmentPoints = [...bottomSegment].reverse().map((sample) => {
        const point = polarToCartesian(
          {
            radius: sample.baseRadius,
            angleRad: sample.angleRad,
          },
          viewport.center
        );

        return {
          x: point.x,
          y: point.y,
        };
      });
      const bottomFillAlpha = Math.min(
        0.31,
        0.045 + averageBottomWeight * 0.13 + peakBottomExtension * 0.11
      );
      const bottomStrokeAlpha = Math.min(
        0.6,
        0.06 + averageBottomWeight * 0.18 + peakBottomExtension * 0.28
      );

      context.fillStyle = ACCENT_WAVE_COLOR;
      context.globalAlpha = bottomFillAlpha;
      context.beginPath();
      traceBandFillPath(context, crestSegmentPoints, baseSegmentPoints);
      context.fill();

      context.strokeStyle = BASE_WAVE_COLOR;
      context.globalAlpha = bottomStrokeAlpha;
      context.lineWidth = layer.lineWidth + 0.24 + peakBottomExtension * 1.15;
      context.beginPath();
      traceOpenCurvePath(context, crestSegmentPoints);
      context.stroke();

      bottomSegment = [];
    };

    for (const mountainSample of mountainSamples) {
      if (mountainSample.bottomWeight >= BOTTOM_WAVE_DARKEN_THRESHOLD) {
        bottomSegment.push(mountainSample);

        continue;
      }

      flushBottomSegment();
    }

    flushBottomSegment();

    for (const extension of extensions.slice(0, 4)) {
      const extensionWindowRad = getExtensionWindowRad(extension);
      const accentAlpha = Math.min(0.78, 0.16 + extension.strength * 7.2);
      const accentWidth = layer.lineWidth + 0.12 + extension.strength * 2.6;
      const underpaintAlpha = Math.min(0.42, 0.08 + extension.strength * 4.8);
      const underpaintWidth = accentWidth + 1.1 + extension.strength * 4.2;
      let segmentPoints: CartesianPoint[] = [];
      const strokeExtensionSegment = (
        points: readonly CartesianPoint[]
      ): void => {
        context.globalAlpha = underpaintAlpha;
        context.lineWidth = underpaintWidth;
        context.strokeStyle = BASE_WAVE_COLOR;
        context.beginPath();
        traceOpenCurvePath(context, points);
        context.stroke();

        context.globalAlpha = accentAlpha;
        context.lineWidth = accentWidth;
        context.strokeStyle = ACCENT_WAVE_COLOR;
        context.beginPath();
        traceOpenCurvePath(context, points);
        context.stroke();
      };

      context.lineJoin = "round";
      context.lineCap = "round";

      for (const mountainSample of mountainSamples) {
        const angularDistance = Math.abs(
          shortestAngularDistance(mountainSample.angleRad, extension.angleRad)
        );

        if (angularDistance > extensionWindowRad) {
          if (segmentPoints.length >= 2) {
            strokeExtensionSegment(segmentPoints);
          }

          segmentPoints = [];

          continue;
        }

        const crestPoint = polarToCartesian(
          {
            radius: mountainSample.crestRadius,
            angleRad: mountainSample.angleRad,
          },
          viewport.center
        );

        segmentPoints.push({
          x: crestPoint.x,
          y: crestPoint.y,
        });
      }

      if (segmentPoints.length >= 2) {
        strokeExtensionSegment(segmentPoints);
      }
    }

    context.lineJoin = "round";
    context.lineCap = "round";
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
    clusters,
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
  const clusterDescriptors = resolveClusterDescriptors(
    clusters,
    elapsedMs,
    timeMs
  );
  const mountainExtensions = [
    ...activePulseDescriptors.slice(0, MAX_RENDERABLE_PULSE_EXTENSIONS),
    ...clusterDescriptors,
  ].slice(0, MAX_MOUNTAIN_EXTENSION_SOURCES);
  const resolvedEntranceScale = Math.max(0, Math.min(1, entranceScale));
  const samples = createContourSamples(
    viewport,
    elapsedMs,
    timeMs,
    renderablePulses,
    eventAnglesByEventId,
    mountainExtensions,
    theme.divergenceSampleCount,
    resolvedEntranceScale
  );

  drawFlowCircleLanes(
    context,
    viewport,
    samples,
    mountainExtensions,
    elapsedMs
  );
};
