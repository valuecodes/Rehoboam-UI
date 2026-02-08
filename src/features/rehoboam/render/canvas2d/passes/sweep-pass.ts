import type {
  InteractionState,
  RehoboamTheme,
  ViewportState,
} from "../../../engine/types";
import {
  cartesianToPolar,
  normalizeAngle,
  polarToCartesian,
} from "../../../layout/polar";

export type SweepPassInput = Readonly<{
  context: CanvasRenderingContext2D;
  viewport: ViewportState;
  theme: RehoboamTheme;
  interaction: InteractionState;
  elapsedMs: number;
}>;

const degreesToRadians = (degrees: number): number => {
  return (degrees * Math.PI) / 180;
};

const getTargetAngle = (
  interaction: InteractionState,
  viewport: ViewportState,
  elapsedMs: number,
  theme: RehoboamTheme
): number => {
  const baseAngle = normalizeAngle(
    (elapsedMs / 1000) * degreesToRadians(theme.sweepSpeedDegPerSecond)
  );

  if (interaction.pointer === null) {
    return baseAngle;
  }

  return cartesianToPolar(interaction.pointer.position, viewport.center)
    .angleRad;
};

export const drawSweepPass = (input: SweepPassInput): void => {
  const { context, viewport, theme, interaction, elapsedMs } = input;
  const angle = getTargetAngle(interaction, viewport, elapsedMs, theme);
  const endpoint = polarToCartesian(
    {
      radius: viewport.outerRadius,
      angleRad: angle,
    },
    viewport.center
  );

  context.save();
  context.strokeStyle = theme.sweepColor;
  context.globalAlpha = 0.42;
  context.lineWidth = 1.4;
  context.beginPath();
  context.moveTo(viewport.center.x, viewport.center.y);
  context.lineTo(endpoint.x, endpoint.y);
  context.stroke();

  context.globalAlpha = 0.3;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(
    viewport.center.x,
    viewport.center.y,
    viewport.outerRadius * 0.985,
    angle - degreesToRadians(2.4),
    angle + degreesToRadians(2.4)
  );
  context.stroke();
  context.restore();
};
