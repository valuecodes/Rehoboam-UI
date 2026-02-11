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
const BASE_WAVE_COLOR = "#101010";
const ACCENT_WAVE_COLOR = "#040404";
const CLUSTER_MODULATION_SPEED_SCALE = 0.52;
const EXTENSION_INFLUENCE_SCALE = 15;
const EXTENSION_OFFSET_SCALE = 1.05;
const EXTENSION_OFFSET_CAP = 0.066;

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
  const elapsedMs = timeMs - cluster.startedAtMs;

  if (elapsedMs <= 0) {
    return 0;
  }

  if (elapsedMs <= cluster.attackMs) {
    const attackProgress = elapsedMs / cluster.attackMs;

    return attackProgress * attackProgress;
  }

  const sustainEndMs = cluster.attackMs + cluster.holdMs;

  if (elapsedMs <= sustainEndMs) {
    return 1;
  }

  const decayProgress = (elapsedMs - sustainEndMs) / cluster.decayMs;

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
    });

    for (const spike of cluster.spikes.slice(
      0,
      MAX_SPIKE_DESCRIPTORS_PER_CLUSTER
    )) {
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
      });
    }
  }

  return clusterDescriptors;
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
    let extensionInfluenceEnergy = 0;
    const rawExtensionOffset = extensions.reduce((sum, extension) => {
      const angularDistance = Math.abs(
        shortestAngularDistance(angleRad, extension.angleRad)
      );
      const extensionWindowRad = getExtensionWindowRad(extension);
      const angularEnvelope = getRaisedCosineWindow(
        angularDistance,
        extensionWindowRad
      );

      if (angularEnvelope <= 0) {
        return sum;
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

      return sum + extension.strength * influence * shimmer;
    }, 0);
    const extensionOffset =
      viewport.outerRadius *
      Math.min(
        EXTENSION_OFFSET_CAP,
        rawExtensionOffset * EXTENSION_OFFSET_SCALE
      ) *
      entranceScale;
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

  const strokeCoreContour = (
    lineWidth: number,
    alpha: number,
    strokeStyle: string
  ): void => {
    context.globalAlpha = alpha;
    context.strokeStyle = strokeStyle;
    context.lineWidth = lineWidth;
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

  for (const layer of MOUNTAIN_WAVE_LAYERS) {
    const mountainSamples: MountainWaveSample[] = Array.from(
      { length: sampleCount + 1 },
      (_, index) => {
        const sample = samples[index];
        const baseRadius =
          sample.radius + viewport.outerRadius * layer.baseOffsetFactor;
        const carrierEnvelope =
          0.4 +
          ((Math.sin(sample.angleRad * 7.2 + elapsedSeconds * 0.4) + 1) / 2) *
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

    context.fillStyle = BASE_WAVE_COLOR;
    context.globalAlpha = layerFillAlpha;
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

    context.strokeStyle = ACCENT_WAVE_COLOR;
    context.globalAlpha = layerStrokeAlpha;
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

    for (const extension of extensions.slice(0, 4)) {
      const extensionWindowRad = getExtensionWindowRad(extension);
      const accentAlpha = Math.min(0.78, 0.16 + extension.strength * 7.2);
      const accentWidth = layer.lineWidth + 0.12 + extension.strength * 2.6;
      let segmentOpen = false;

      context.globalAlpha = accentAlpha;
      context.lineWidth = accentWidth;
      context.strokeStyle = ACCENT_WAVE_COLOR;
      context.lineJoin = "miter";
      context.miterLimit = 4;
      context.lineCap = "butt";

      for (const mountainSample of mountainSamples) {
        const angularDistance = Math.abs(
          shortestAngularDistance(mountainSample.angleRad, extension.angleRad)
        );

        if (angularDistance > extensionWindowRad) {
          if (segmentOpen) {
            context.stroke();
            segmentOpen = false;
          }

          continue;
        }

        const crestPoint = polarToCartesian(
          {
            radius: mountainSample.crestRadius,
            angleRad: mountainSample.angleRad,
          },
          viewport.center
        );

        if (!segmentOpen) {
          context.beginPath();
          context.moveTo(crestPoint.x, crestPoint.y);
          segmentOpen = true;
        } else {
          context.lineTo(crestPoint.x, crestPoint.y);
        }
      }

      if (segmentOpen) {
        context.stroke();
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
