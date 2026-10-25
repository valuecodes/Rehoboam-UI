const TAU = Math.PI * 2;

type CartesianCoordinate = Readonly<{
  x: number;
  y: number;
}>;

type PolarCoordinate = Readonly<{
  radius: number;
  angleRad: number;
}>;

const normalizeAngle = (angleRad: number): number => {
  const normalized = angleRad % TAU;

  return normalized >= 0 ? normalized : normalized + TAU;
};

const shortestAngularDistance = (
  fromAngleRad: number,
  toAngleRad: number
): number => {
  const clockwiseDelta = normalizeAngle(toAngleRad - fromAngleRad);

  if (clockwiseDelta > Math.PI) {
    return clockwiseDelta - TAU;
  }

  return clockwiseDelta;
};

const polarToCartesian = (
  polar: PolarCoordinate,
  center: CartesianCoordinate
): CartesianCoordinate => ({
  x: center.x + polar.radius * Math.sin(polar.angleRad),
  y: center.y - polar.radius * Math.cos(polar.angleRad),
});

const cartesianToPolar = (
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

export {
  cartesianToPolar,
  normalizeAngle,
  polarToCartesian,
  shortestAngularDistance,
  TAU,
};
export type { CartesianCoordinate };
