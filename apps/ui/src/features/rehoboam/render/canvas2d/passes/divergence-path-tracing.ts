type CartesianPoint = Readonly<{
  x: number;
  y: number;
}>;

const pointsAreEquivalent = (
  left: CartesianPoint,
  right: CartesianPoint
): boolean =>
  Math.abs(left.x - right.x) <= 0.0001 && Math.abs(left.y - right.y) <= 0.0001;

const toClosedLoopPoints = (
  points: readonly CartesianPoint[]
): readonly CartesianPoint[] => {
  if (points.length < 2) {
    return points;
  }

  const firstPoint = points[0];
  const lastPoint = points.at(-1);

  if (lastPoint === undefined || !pointsAreEquivalent(firstPoint, lastPoint)) {
    return points;
  }

  return points.slice(0, points.length - 1);
};

const toMidpoint = (
  left: CartesianPoint,
  right: CartesianPoint
): CartesianPoint => ({
  x: (left.x + right.x) / 2,
  y: (left.y + right.y) / 2,
});

const supportsQuadraticCurveTo = (
  context: CanvasRenderingContext2D
): boolean => {
  const maybeContext = context as CanvasRenderingContext2D & {
    quadraticCurveTo?: CanvasRenderingContext2D["quadraticCurveTo"];
  };

  return typeof maybeContext.quadraticCurveTo === "function";
};

const traceClosedLinearPath = (
  context: CanvasRenderingContext2D,
  sourcePoints: readonly CartesianPoint[]
): void => {
  const points = toClosedLoopPoints(sourcePoints);

  if (points.length === 0) {
    return;
  }

  context.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    context.lineTo(point.x, point.y);
  }

  context.closePath();
};

const traceOpenLinearPath = (
  context: CanvasRenderingContext2D,
  points: readonly CartesianPoint[],
  moveToFirst: boolean
): void => {
  if (points.length === 0) {
    return;
  }

  if (moveToFirst) {
    context.moveTo(points[0].x, points[0].y);
  }

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    context.lineTo(point.x, point.y);
  }
};

const traceClosedCurvePath = (
  context: CanvasRenderingContext2D,
  sourcePoints: readonly CartesianPoint[]
): void => {
  if (!supportsQuadraticCurveTo(context)) {
    traceClosedLinearPath(context, sourcePoints);

    return;
  }

  const points = toClosedLoopPoints(sourcePoints);

  if (points.length === 0) {
    return;
  }

  if (points.length === 1) {
    context.moveTo(points[0].x, points[0].y);

    return;
  }

  if (points.length === 2) {
    context.moveTo(points[0].x, points[0].y);
    context.lineTo(points[1].x, points[1].y);
    context.closePath();

    return;
  }

  const firstMidpoint = toMidpoint(points[0], points[1]);
  context.moveTo(firstMidpoint.x, firstMidpoint.y);

  for (let index = 1; index < points.length; index += 1) {
    const currentPoint = points[index];
    const nextPoint = points[(index + 1) % points.length];
    const midpoint = toMidpoint(currentPoint, nextPoint);

    context.quadraticCurveTo(
      currentPoint.x,
      currentPoint.y,
      midpoint.x,
      midpoint.y
    );
  }

  context.closePath();
};

const traceOpenCurvePath = (
  context: CanvasRenderingContext2D,
  points: readonly CartesianPoint[],
  moveToFirst = true
): void => {
  if (!supportsQuadraticCurveTo(context)) {
    traceOpenLinearPath(context, points, moveToFirst);

    return;
  }

  if (points.length === 0) {
    return;
  }

  if (moveToFirst) {
    context.moveTo(points[0].x, points[0].y);
  }

  if (points.length === 1) {
    return;
  }

  if (points.length === 2) {
    context.lineTo(points[1].x, points[1].y);

    return;
  }

  for (let index = 1; index < points.length - 1; index += 1) {
    const currentPoint = points[index];
    const nextPoint = points[index + 1];
    const midpoint = toMidpoint(currentPoint, nextPoint);

    context.quadraticCurveTo(
      currentPoint.x,
      currentPoint.y,
      midpoint.x,
      midpoint.y
    );
  }

  const lastPoint = points.at(-1);

  if (lastPoint !== undefined) {
    context.lineTo(lastPoint.x, lastPoint.y);
  }
};

const traceBandFillPath = (
  context: CanvasRenderingContext2D,
  crestPoints: readonly CartesianPoint[],
  basePoints: readonly CartesianPoint[]
): void => {
  if (crestPoints.length === 0 || basePoints.length === 0) {
    return;
  }

  context.moveTo(crestPoints[0].x, crestPoints[0].y);
  traceOpenCurvePath(context, crestPoints, false);
  context.lineTo(basePoints[0].x, basePoints[0].y);
  traceOpenCurvePath(context, basePoints, false);
  context.closePath();
};

const traceClosedBandFillPath = (
  context: CanvasRenderingContext2D,
  crestPoints: readonly CartesianPoint[],
  basePoints: readonly CartesianPoint[]
): void => {
  const closedCrestPoints = toClosedLoopPoints(crestPoints);
  const closedBasePoints = toClosedLoopPoints(basePoints);

  if (closedCrestPoints.length < 2 || closedBasePoints.length < 2) {
    return;
  }

  traceClosedCurvePath(context, closedCrestPoints);
  traceClosedCurvePath(context, closedBasePoints);
};

export {
  traceBandFillPath,
  traceClosedBandFillPath,
  traceClosedCurvePath,
  traceOpenCurvePath,
};
export type { CartesianPoint };
