export const TAU = Math.PI * 2;

export type CartesianCoordinate = Readonly<{
  x: number;
  y: number;
}>;

export type PolarCoordinate = Readonly<{
  radius: number;
  angleRad: number;
}>;

export const normalizeAngle = (angleRad: number): number => {
  const normalized = angleRad % TAU;

  return normalized >= 0 ? normalized : normalized + TAU;
};

export const shortestAngularDistance = (
  fromAngleRad: number,
  toAngleRad: number
): number => {
  const clockwiseDelta = normalizeAngle(toAngleRad - fromAngleRad);

  if (clockwiseDelta > Math.PI) {
    return clockwiseDelta - TAU;
  }

  return clockwiseDelta;
};

export const polarToCartesian = (
  polar: PolarCoordinate,
  center: CartesianCoordinate
): CartesianCoordinate => {
  return {
    x: center.x + polar.radius * Math.sin(polar.angleRad),
    y: center.y - polar.radius * Math.cos(polar.angleRad),
  };
};

export const cartesianToPolar = (
  point: CartesianCoordinate,
  center: CartesianCoordinate
): PolarCoordinate => {
  const deltaX = point.x - center.x;
  const deltaY = point.y - center.y;

  return {
    radius: Math.hypot(deltaX, deltaY),
    angleRad: normalizeAngle(Math.atan2(deltaX, -deltaY)),
  };
};
