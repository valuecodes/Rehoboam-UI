import { SEVERITY_RANK } from "~/features/rehoboam/engine/severity";
import type {
  InteractionState,
  WorldEventSeverity,
} from "~/features/rehoboam/engine/types";
import {
  normalizeAngle,
  shortestAngularDistance,
  TAU,
} from "~/features/rehoboam/layout/polar";
import type { DivergenceCluster } from "~/features/rehoboam/render/canvas2d/divergence-cluster-types";
import {
  DIVERGENCE_ATTACK_MS,
  DIVERGENCE_DECAY_MS,
  DIVERGENCE_PULSE_LIFETIME_MS,
} from "~/features/rehoboam/render/canvas2d/divergence-constants";
import type { DivergencePulse } from "~/features/rehoboam/render/canvas2d/divergence-pulse-tracker";
import { getClusterEnvelope } from "~/features/rehoboam/render/canvas2d/divergence-utils";

import { CLUSTER_MODULATION_SPEED_SCALE } from "./divergence-pass-constants";

const MAX_RENDERABLE_PULSES = 14;
const MAX_SPIKE_DESCRIPTORS_PER_CLUSTER = 3;
const BOTTOM_WAVE_DARKEN_WINDOW_RAD = Math.PI * 0.84;

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
const UINT32_RANGE = 0x1_00_00_00_00;
const FNV_OFFSET_BASIS = 0x81_1c_9d_c5;
const FNV_PRIME = 0x01_00_01_93;

type ActivePulseDescriptor = Readonly<{
  angleRad: number;
  strength: number;
  severity: WorldEventSeverity;
  windowScale: number;
  phaseOffsetRad: number;
}>;

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

const resolveStablePhaseOffsetRad = (key: string): number =>
  hashStringToUnitInterval(key) * TAU;

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
    .map((prioritizedPulse) => prioritizedPulse.pulse);
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

export {
  getBottomWaveWeight,
  getExtensionWindowRad,
  getPulseEnvelope,
  getRaisedCosineWindow,
  PULSE_AMPLITUDE_SCALE,
  PULSE_WINDOW_RAD,
  resolveActivePulseDescriptors,
  resolveClusterDescriptors,
  resolveRenderablePulses,
};
export type { ActivePulseDescriptor };
