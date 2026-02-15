import type { RehoboamTheme, ViewportState } from "./types";

export const DEFAULT_DPR_CAP = 2;

export const DEFAULT_THEME: RehoboamTheme = {
  backgroundColor: "#efefed",
  backgroundCoreColor: "#fbfbf9",
  ringColor: "#1f1f1f",
  sweepColor: "#303030",
  ringSeed: "rehoboam-v2-rings",
  ringCount: 22,
  divergenceSampleCount: 360,
  sweepSpeedDegPerSecond: 8,
};

export type CreateViewportStateInput = Readonly<{
  width: number;
  height: number;
  dpr: number;
  dprCap?: number;
}>;

const clampPositiveNumber = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
};

export const clampDpr = (dpr: number, dprCap: number): number => {
  const sanitizedCap = Math.max(1, clampPositiveNumber(dprCap));
  const sanitizedDpr = Math.max(1, clampPositiveNumber(dpr));

  return Math.min(sanitizedDpr, sanitizedCap);
};

export const createViewportState = (
  input: CreateViewportStateInput
): ViewportState => {
  const width = clampPositiveNumber(input.width);
  const height = clampPositiveNumber(input.height);
  const dprCap = input.dprCap ?? DEFAULT_DPR_CAP;
  const dpr = clampDpr(input.dpr, dprCap);

  return {
    width,
    height,
    dpr,
    dprCap,
    pixelWidth: Math.round(width * dpr),
    pixelHeight: Math.round(height * dpr),
    center: {
      x: width / 2,
      y: height / 2,
    },
    outerRadius: Math.min(width, height) * 0.46,
  };
};
