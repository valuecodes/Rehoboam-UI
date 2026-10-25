import type {
  InteractionState,
  RehoboamTheme,
  ViewportState,
  WorldEvent,
} from "~/features/rehoboam/engine/types";
import { polarToCartesian } from "~/features/rehoboam/layout/polar";
import type { DivergenceCluster } from "~/features/rehoboam/render/canvas2d/divergence-cluster-types";
import type { DivergencePulse } from "~/features/rehoboam/render/canvas2d/divergence-pulse-tracker";

import {
  createContourSamples,
  resolveCoreContourRadius,
} from "./divergence-contour";
import type { ContourSample } from "./divergence-contour";
import {
  resolveActivePulseDescriptors,
  resolveClusterDescriptors,
  resolveRenderablePulses,
} from "./divergence-descriptors";
import type { ActivePulseDescriptor } from "./divergence-descriptors";
import {
  drawBottomWaveSegments,
  drawCoreSeamUnderpaint,
  drawExtensionAccents,
} from "./divergence-layer-drawing";
import {
  createMountainSamples,
  MOUNTAIN_WAVE_LAYERS,
} from "./divergence-mountain-samples";
import {
  ACCENT_WAVE_COLOR,
  BASE_WAVE_COLOR,
} from "./divergence-pass-constants";
import {
  traceClosedBandFillPath,
  traceClosedCurvePath,
} from "./divergence-path-tracing";

const MAX_MOUNTAIN_EXTENSION_SOURCES = 16;
const MAX_RENDERABLE_PULSE_EXTENSIONS = 4;
const BODY_THICKNESS_INTENSITY_SCALE = 0.7;

type DivergencePassInput = Readonly<{
  context: CanvasRenderingContext2D;
  viewport: ViewportState;
  theme: RehoboamTheme;
  interaction: InteractionState;
  events: readonly WorldEvent[];
  eventAnglesByEventId: ReadonlyMap<string, number>;
  pulses: readonly DivergencePulse[];
  clusters: readonly DivergenceCluster[];
  elapsedMs: number;
  timeMs: number;
  entranceScale: number;
}>;

const resolveTrimmedIntensity = (
  intensity: number,
  scaleAboveBaseline: number
): number => {
  if (intensity <= 1) {
    return intensity;
  }

  return 1 + (intensity - 1) * scaleAboveBaseline;
};

const drawFlowCircleLanes = (
  context: CanvasRenderingContext2D,
  viewport: ViewportState,
  samples: readonly ContourSample[],
  extensions: readonly ActivePulseDescriptor[],
  elapsedMs: number,
  intensity: number,
  intensityScale: number
): void => {
  const sampleCount = samples.length - 1;

  if (sampleCount <= 0) {
    return;
  }

  const elapsedSeconds = elapsedMs / 1000;
  const bodyThicknessIntensity = resolveTrimmedIntensity(
    intensity,
    BODY_THICKNESS_INTENSITY_SCALE
  );
  const bodyThicknessScale = 0.1 + 0.9 * bodyThicknessIntensity;

  context.save();
  context.globalCompositeOperation = "multiply";
  context.fillStyle = BASE_WAVE_COLOR;
  context.strokeStyle = BASE_WAVE_COLOR;
  context.setLineDash([]);
  context.lineDashOffset = 0;
  context.lineJoin = "round";
  context.lineCap = "round";
  const coreContourRadii = samples.map((sample) =>
    resolveCoreContourRadius(sample, viewport)
  );
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
    const mountainSamples = createMountainSamples({
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
    });
    const peakExtensionInfluence = mountainSamples.reduce(
      (peak, mountainSample) =>
        Math.max(peak, mountainSample.extensionInfluence),
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
      drawCoreSeamUnderpaint({
        context,
        viewport,
        contourPoints,
        coreContourRadii,
        mountainSamples,
        intensity,
      });
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

    drawBottomWaveSegments(context, viewport, layer, mountainSamples);
    drawExtensionAccents(context, viewport, layer, mountainSamples, extensions);

    context.lineJoin = "round";
    context.lineCap = "round";
  }

  context.restore();
};

const drawDivergencePass = (input: DivergencePassInput): void => {
  const {
    context,
    viewport,
    theme,
    interaction,
    eventAnglesByEventId,
    pulses,
    clusters,
    elapsedMs,
    timeMs,
    entranceScale,
  } = input;

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
  const intensity = Math.max(0, Math.min(2, theme.divergenceIntensity));
  const intensityScale = 0.1 + 0.9 * intensity;
  const samples = createContourSamples(
    viewport,
    elapsedMs,
    timeMs,
    renderablePulses,
    eventAnglesByEventId,
    mountainExtensions,
    theme.divergenceSampleCount,
    resolvedEntranceScale,
    intensityScale
  );

  drawFlowCircleLanes(
    context,
    viewport,
    samples,
    mountainExtensions,
    elapsedMs,
    intensity,
    intensityScale
  );
};

export { drawDivergencePass };
export type { DivergencePassInput };
