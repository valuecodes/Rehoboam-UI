import type { ViewportState } from "~/features/rehoboam/engine/types";
import { shortestAngularDistance, TAU } from "~/features/rehoboam/layout/polar";
import type { DivergencePulse } from "~/features/rehoboam/render/canvas2d/divergence-pulse-tracker";

import {
  getExtensionWindowRad,
  getPulseEnvelope,
  getRaisedCosineWindow,
  PULSE_AMPLITUDE_SCALE,
  PULSE_WINDOW_RAD,
} from "./divergence-descriptors";
import type { ActivePulseDescriptor } from "./divergence-descriptors";
import {
  BASE_WAVE_INTENSITY_SCALE,
  CLUSTER_MODULATION_SPEED_SCALE,
  CORE_RING_RADIUS_FACTOR,
} from "./divergence-pass-constants";

const EXTENSION_INFLUENCE_SCALE = 15;
const EXTENSION_OFFSET_SCALE = 1.05;
const EXTENSION_OUTWARD_OFFSET_CAP = 0.043;
const EXTENSION_INWARD_OFFSET_CAP = 0.04;
const BASELINE_WAVE_FREQUENCIES = [5, 9, 14] as const;
const CORE_CONTOUR_OUTWARD_DELTA_GAIN = 0.18;
const CORE_CONTOUR_OUTWARD_PULSE_DELTA_GAIN = 0.1;
const CORE_CONTOUR_INWARD_DELTA_GAIN = 0.8;
const CORE_CONTOUR_INWARD_PULSE_DELTA_GAIN = 0.32;
const CORE_CONTOUR_MAX_OUTWARD_FACTOR = 0.0065;
const CORE_CONTOUR_MAX_INWARD_FACTOR = 0.03;

type ContourSample = Readonly<{
  angleRad: number;
  radius: number;
  pulseInfluence: number;
}>;

type ExtensionOffsetResolution = Readonly<{
  offset: number;
  influenceEnergy: number;
}>;

const sanitizeSampleCount = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 360;
  }

  return Math.max(96, Math.min(720, Math.trunc(value)));
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
  entranceScale: number,
  intensityScale: number
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
        0.0039 *
        intensityScale *
        BASE_WAVE_INTENSITY_SCALE +
      Math.sin(
        angleRad * BASELINE_WAVE_FREQUENCIES[1] + elapsedSeconds * 0.74
      ) *
        viewport.outerRadius *
        0.0028 *
        intensityScale *
        BASE_WAVE_INTENSITY_SCALE +
      Math.sin(
        angleRad * BASELINE_WAVE_FREQUENCIES[2] - elapsedSeconds * 1.05
      ) *
        viewport.outerRadius *
        0.0017 *
        intensityScale *
        BASE_WAVE_INTENSITY_SCALE;

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

export { createContourSamples, resolveCoreContourRadius };
export type { ContourSample };
