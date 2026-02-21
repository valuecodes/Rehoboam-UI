import type {
  InteractionState,
  RehoboamTheme,
  ViewportState,
} from "../../../engine/types";
import { cartesianToPolar, normalizeAngle } from "../../../layout/polar";

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

  context.save();
  context.strokeStyle = theme.sweepColor;
  context.globalAlpha = 0.06;
  context.lineWidth = 0.9;
  context.beginPath();
  context.arc(
    viewport.center.x,
    viewport.center.y,
    viewport.outerRadius * 0.87,
    angle - degreesToRadians(3),
    angle + degreesToRadians(3)
  );
  context.stroke();
  context.restore();
};
