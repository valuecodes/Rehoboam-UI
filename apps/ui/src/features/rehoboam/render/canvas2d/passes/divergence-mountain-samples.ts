import type { ViewportState } from "~/features/rehoboam/engine/types";
import { shortestAngularDistance, TAU } from "~/features/rehoboam/layout/polar";

import type { ContourSample } from "./divergence-contour";
import {
  getBottomWaveWeight,
  getExtensionWindowRad,
  getRaisedCosineWindow,
} from "./divergence-descriptors";
import type { ActivePulseDescriptor } from "./divergence-descriptors";
import {
  BASE_WAVE_INTENSITY_SCALE,
  CORE_RING_RADIUS_FACTOR,
} from "./divergence-pass-constants";

const MOUNTAIN_CARRIER_FREQUENCY = 7;

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

type CreateMountainSamplesInput = Readonly<{
  viewport: ViewportState;
  samples: readonly ContourSample[];
  coreContourRadii: readonly number[];
  extensions: readonly ActivePulseDescriptor[];
  layer: MountainWaveLayer;
  sampleCount: number;
  elapsedSeconds: number;
  bodyThicknessIntensity: number;
  bodyThicknessScale: number;
  intensityScale: number;
}>;

const createMountainSamples = (
  input: CreateMountainSamplesInput
): MountainWaveSample[] => {
  const {
    viewport,
    samples,
    coreContourRadii,
    extensions,
    layer,
    sampleCount,
    elapsedSeconds,
    bodyThicknessIntensity,
    bodyThicknessScale,
    intensityScale,
  } = input;

  return Array.from({ length: sampleCount + 1 }, (_, index) => {
    const sample = samples[index];
    const coreRadius =
      coreContourRadii[index] ?? viewport.outerRadius * CORE_RING_RADIUS_FACTOR;
    const layerBaseRadius =
      sample.radius + viewport.outerRadius * layer.baseOffsetFactor;
    const baseRadius =
      coreRadius + (layerBaseRadius - coreRadius) * bodyThicknessIntensity;
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
    const ridgeShape = Math.pow(waveA, 4) * 0.46 + Math.pow(waveB, 8) * 0.24;
    const needleShape =
      Math.pow(Math.max(waveA, waveB), 14) * (0.05 + normalizedExtension * 1.8);
    const jaggedness = ridgeShape + needleShape;
    const basePulseBoost =
      0.58 * bodyThicknessScale * BASE_WAVE_INTENSITY_SCALE;
    const spikePulseBoost =
      Math.pow(sample.pulseInfluence, 0.82) * 2.9 + normalizedExtension * 3.1;
    const crestHeight =
      viewport.outerRadius *
      layer.amplitudeFactor *
      carrierEnvelope *
      jaggedness *
      (basePulseBoost + intensityScale * spikePulseBoost);
    const cappedCrestHeight = Math.min(
      viewport.outerRadius * 0.16 * intensityScale,
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
  });
};

export { createMountainSamples, MOUNTAIN_WAVE_LAYERS };
export type { MountainWaveLayer, MountainWaveSample };
