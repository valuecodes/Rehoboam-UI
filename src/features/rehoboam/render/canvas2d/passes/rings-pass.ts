import { createSeededRng } from "../../../../../shared/utils/seeded-rng";
import type { SeedInput } from "../../../../../shared/utils/seeded-rng";
import type { RehoboamTheme, ViewportState } from "../../../engine/types";
import { TAU } from "../../../layout/polar";

const LINE_WIDTHS = [0.6, 0.8, 1.2, 1.6, 2.4, 3.2] as const;
const DASH_TEMPLATES = [
  [2, 4],
  [3, 6],
  [4, 8],
  [6, 12],
  [8, 14],
] as const;

export type RingSpec = Readonly<{
  radiusFactor: number;
  lineWidth: number;
  alpha: number;
  dashPattern: readonly number[];
  dashOffset: number;
  rotationSpeedRadPerSecond: number;
  pulsePhaseOffset: number;
}>;

export type CreateRingSpecsInput = Readonly<{
  seed: SeedInput;
  ringCount: number;
}>;

export type RingsPassInput = Readonly<{
  context: CanvasRenderingContext2D;
  viewport: ViewportState;
  theme: RehoboamTheme;
  elapsedMs: number;
  rings: readonly RingSpec[];
}>;

const degreesToRadians = (degrees: number): number => {
  return (degrees * Math.PI) / 180;
};

const pickSpeedRangeByDepth = (
  normalizedRingDepth: number
): readonly [number, number] => {
  if (normalizedRingDepth < 1 / 3) {
    return [2, 6] as const;
  }

  if (normalizedRingDepth < 2 / 3) {
    return [6, 14] as const;
  }

  return [10, 22] as const;
};

export const createRingSpecs = (
  input: CreateRingSpecsInput
): readonly RingSpec[] => {
  const ringCount = Math.max(1, Math.floor(input.ringCount));
  const random = createSeededRng(input.seed);

  return Array.from({ length: ringCount }, (_, index) => {
    const depth = (index + 1) / (ringCount + 1);
    const [speedMin, speedMax] = pickSpeedRangeByDepth(depth);
    const speedDegPerSecond = random.nextFloat(speedMin, speedMax);
    const rotationDirection = random.next() < 0.5 ? -1 : 1;
    const dashTemplate =
      DASH_TEMPLATES[random.nextInt(0, DASH_TEMPLATES.length)];
    const hasDash = random.next() < 0.62;
    const baseRadiusFactor = 0.18 + depth * 0.82;
    const radiusFactor = Math.min(
      1,
      Math.max(0.12, baseRadiusFactor + random.nextFloat(-0.006, 0.006))
    );

    return {
      radiusFactor,
      lineWidth: LINE_WIDTHS[random.nextInt(0, LINE_WIDTHS.length)],
      alpha: random.nextFloat(0.06, 0.3),
      dashPattern: hasDash ? [...dashTemplate] : [],
      dashOffset: random.nextFloat(0, 160),
      rotationSpeedRadPerSecond:
        degreesToRadians(speedDegPerSecond) * rotationDirection,
      pulsePhaseOffset: random.nextFloat(0, TAU),
    };
  });
};

export const drawRingsPass = (input: RingsPassInput): void => {
  const { context, viewport, theme, elapsedMs, rings } = input;
  const elapsedSeconds = elapsedMs / 1000;

  for (const ring of rings) {
    const ringRadius = viewport.outerRadius * ring.radiusFactor;
    const rotationAngle = elapsedSeconds * ring.rotationSpeedRadPerSecond;
    const pulse =
      (Math.sin(elapsedSeconds * 0.8 + ring.pulsePhaseOffset) + 1) / 2;
    const pulseScale = 0.86 + pulse * 0.14;

    context.save();
    context.strokeStyle = theme.ringColor;
    context.lineWidth = ring.lineWidth;
    context.globalAlpha = ring.alpha * pulseScale;
    context.setLineDash([...ring.dashPattern]);
    context.lineDashOffset =
      ring.dashOffset +
      ringRadius * rotationAngle * (ring.dashPattern.length > 0 ? 1 : 0);
    context.beginPath();
    context.arc(
      viewport.center.x,
      viewport.center.y,
      ringRadius,
      rotationAngle,
      rotationAngle + TAU
    );
    context.stroke();
    context.restore();
  }
};
