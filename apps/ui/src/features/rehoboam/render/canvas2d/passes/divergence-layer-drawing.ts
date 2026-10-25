import type { ViewportState } from "~/features/rehoboam/engine/types";
import {
  polarToCartesian,
  shortestAngularDistance,
} from "~/features/rehoboam/layout/polar";

import { getExtensionWindowRad } from "./divergence-descriptors";
import type { ActivePulseDescriptor } from "./divergence-descriptors";
import type {
  MountainWaveLayer,
  MountainWaveSample,
} from "./divergence-mountain-samples";
import {
  ACCENT_WAVE_COLOR,
  BASE_WAVE_COLOR,
  CORE_RING_RADIUS_FACTOR,
} from "./divergence-pass-constants";
import {
  traceBandFillPath,
  traceClosedBandFillPath,
  traceOpenCurvePath,
} from "./divergence-path-tracing";
import type { CartesianPoint } from "./divergence-path-tracing";

const SEAM_UNDERPAINT_MIN_WIDTH_FACTOR = 0.004;
const SEAM_UNDERPAINT_BASE_OUTER_FACTOR = 0.0065;
const SEAM_UNDERPAINT_EXTENSION_GAIN_FACTOR = 0.008;
const SEAM_UNDERPAINT_EXTENSION_CAP_FACTOR = 0.015;
const SEAM_UNDERPAINT_CREST_GAIN = 0.18;
const SEAM_UNDERPAINT_CREST_CAP_FACTOR = 0.012;
const SEAM_UNDERPAINT_GRADIENT_INNER_OFFSET_FACTOR = 0.013;
const SEAM_UNDERPAINT_GRADIENT_OUTER_OFFSET_FACTOR = 0.056;
const BOTTOM_WAVE_DARKEN_THRESHOLD = 0.18;

type CoreSeamUnderpaintInput = Readonly<{
  context: CanvasRenderingContext2D;
  viewport: ViewportState;
  contourPoints: readonly CartesianPoint[];
  coreContourRadii: readonly number[];
  mountainSamples: readonly MountainWaveSample[];
  intensity: number;
}>;

const drawCoreSeamUnderpaint = (input: CoreSeamUnderpaintInput): void => {
  const {
    context,
    viewport,
    contourPoints,
    coreContourRadii,
    mountainSamples,
    intensity,
  } = input;

  if (mountainSamples.length === 0 || contourPoints.length <= 1) {
    return;
  }

  const seamOuterPoints = mountainSamples.map((mountainSample, index) => {
    const coreContourRadius =
      coreContourRadii[index] ?? viewport.outerRadius * CORE_RING_RADIUS_FACTOR;
    const extensionLift = Math.min(
      viewport.outerRadius * SEAM_UNDERPAINT_EXTENSION_CAP_FACTOR,
      mountainSample.extensionInfluence *
        viewport.outerRadius *
        SEAM_UNDERPAINT_EXTENSION_GAIN_FACTOR *
        intensity
    );
    const crestLift = Math.min(
      viewport.outerRadius * SEAM_UNDERPAINT_CREST_CAP_FACTOR,
      mountainSample.crestHeight * SEAM_UNDERPAINT_CREST_GAIN * intensity
    );
    const targetOuterRadius =
      mountainSample.baseRadius +
      viewport.outerRadius * SEAM_UNDERPAINT_BASE_OUTER_FACTOR * intensity +
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

const drawBottomSegment = (
  context: CanvasRenderingContext2D,
  viewport: ViewportState,
  layer: MountainWaveLayer,
  bottomSegment: readonly MountainWaveSample[]
): void => {
  if (bottomSegment.length < 2) {
    return;
  }

  const averageBottomWeight =
    bottomSegment.reduce((sum, sample) => sum + sample.bottomWeight, 0) /
    bottomSegment.length;
  const peakBottomExtension = bottomSegment.reduce(
    (peak, sample) =>
      Math.max(peak, sample.extensionInfluence * sample.bottomWeight),
    0
  );
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
};

const drawBottomWaveSegments = (
  context: CanvasRenderingContext2D,
  viewport: ViewportState,
  layer: MountainWaveLayer,
  mountainSamples: readonly MountainWaveSample[]
): void => {
  let bottomSegment: MountainWaveSample[] = [];

  for (const mountainSample of mountainSamples) {
    if (mountainSample.bottomWeight >= BOTTOM_WAVE_DARKEN_THRESHOLD) {
      bottomSegment.push(mountainSample);

      continue;
    }

    drawBottomSegment(context, viewport, layer, bottomSegment);
    bottomSegment = [];
  }

  drawBottomSegment(context, viewport, layer, bottomSegment);
};

type ExtensionSegmentStyle = Readonly<{
  accentAlpha: number;
  accentWidth: number;
  underpaintAlpha: number;
  underpaintWidth: number;
}>;

const strokeExtensionSegment = (
  context: CanvasRenderingContext2D,
  points: readonly CartesianPoint[],
  style: ExtensionSegmentStyle
): void => {
  context.globalAlpha = style.underpaintAlpha;
  context.lineWidth = style.underpaintWidth;
  context.strokeStyle = BASE_WAVE_COLOR;
  context.beginPath();
  traceOpenCurvePath(context, points);
  context.stroke();

  context.globalAlpha = style.accentAlpha;
  context.lineWidth = style.accentWidth;
  context.strokeStyle = ACCENT_WAVE_COLOR;
  context.beginPath();
  traceOpenCurvePath(context, points);
  context.stroke();
};

const drawExtensionAccents = (
  context: CanvasRenderingContext2D,
  viewport: ViewportState,
  layer: MountainWaveLayer,
  mountainSamples: readonly MountainWaveSample[],
  extensions: readonly ActivePulseDescriptor[]
): void => {
  for (const extension of extensions.slice(0, 4)) {
    const extensionWindowRad = getExtensionWindowRad(extension);
    const accentAlpha = Math.min(0.78, 0.16 + extension.strength * 7.2);
    const accentWidth = layer.lineWidth + 0.12 + extension.strength * 2.6;
    const underpaintAlpha = Math.min(0.42, 0.08 + extension.strength * 4.8);
    const underpaintWidth = accentWidth + 1.1 + extension.strength * 4.2;
    const style: ExtensionSegmentStyle = {
      accentAlpha,
      accentWidth,
      underpaintAlpha,
      underpaintWidth,
    };
    let segmentPoints: CartesianPoint[] = [];

    context.lineJoin = "round";
    context.lineCap = "round";

    for (const mountainSample of mountainSamples) {
      const angularDistance = Math.abs(
        shortestAngularDistance(mountainSample.angleRad, extension.angleRad)
      );

      if (angularDistance > extensionWindowRad) {
        if (segmentPoints.length >= 2) {
          strokeExtensionSegment(context, segmentPoints, style);
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
      strokeExtensionSegment(context, segmentPoints, style);
    }
  }
};

export { drawBottomWaveSegments, drawCoreSeamUnderpaint, drawExtensionAccents };
