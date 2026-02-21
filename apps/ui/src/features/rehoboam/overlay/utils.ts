export type Point = Readonly<{
  x: number;
  y: number;
}>;

export const clampNumber = (
  value: number,
  min: number,
  max: number
): number => {
  return Math.min(max, Math.max(min, value));
};

export const toPointList = (points: readonly Point[]): string => {
  return points
    .map((point) => {
      return `${point.x} ${point.y}`;
    })
    .join(",");
};
