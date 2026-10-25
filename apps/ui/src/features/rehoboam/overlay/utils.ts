type Point = Readonly<{
  x: number;
  y: number;
}>;

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const toPointList = (points: readonly Point[]): string =>
  points.map((point) => `${point.x} ${point.y}`).join(",");

export { clampNumber, toPointList };
export type { Point };
