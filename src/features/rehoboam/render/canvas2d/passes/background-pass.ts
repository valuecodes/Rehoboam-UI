import type { RehoboamTheme, ViewportState } from "../../../engine/types";
import { TAU } from "../../../layout/polar";

export type BackgroundPassInput = Readonly<{
  context: CanvasRenderingContext2D;
  viewport: ViewportState;
  theme: RehoboamTheme;
}>;

export const drawBackgroundPass = (input: BackgroundPassInput): void => {
  const { context, viewport, theme } = input;

  context.save();
  context.globalAlpha = 1;
  context.fillStyle = theme.backgroundColor;
  context.fillRect(0, 0, viewport.width, viewport.height);

  context.globalAlpha = 0.06;
  context.fillStyle = "#151515";
  context.beginPath();
  context.arc(
    viewport.center.x,
    viewport.center.y,
    viewport.outerRadius * 0.87,
    0,
    TAU
  );
  context.strokeStyle = "#151515";
  context.lineWidth = viewport.outerRadius * 0.015;
  context.stroke();

  context.globalAlpha = 0.04;
  context.fillStyle = theme.backgroundCoreColor;
  context.fillRect(0, 0, viewport.width, viewport.height);
  context.restore();
};
