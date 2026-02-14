import { createSeededRng } from "../../../shared/utils/seeded-rng";
import type { ComputedEventAngle } from "../layout/compute-angles";

const compareEventAnglesByTimestamp = (
  left: ComputedEventAngle,
  right: ComputedEventAngle
): number => {
  if (left.event.timestampMs !== right.event.timestampMs) {
    return left.event.timestampMs - right.event.timestampMs;
  }

  return left.event.id.localeCompare(right.event.id);
};

export const getChronologicalCycleIds = (
  eventAngles: readonly ComputedEventAngle[]
): readonly string[] => {
  return [...eventAngles]
    .sort(compareEventAnglesByTimestamp)
    .map((eventAngle) => eventAngle.event.id);
};

const compareEventAnglesForCycle = (
  left: ComputedEventAngle,
  right: ComputedEventAngle
): number => {
  if (left.angleRad !== right.angleRad) {
    return left.angleRad - right.angleRad;
  }

  return left.event.id.localeCompare(right.event.id);
};

const QUADRANT_COUNT = 4;
const QUADRANT_ARC_RAD = (Math.PI * 2) / QUADRANT_COUNT;
const CALL_OUT_CYCLE_SEED_PREFIX = "rehoboam-callout-cycle";

const getQuadrantIndexForAngle = (angleRad: number): number => {
  const boundedAngle = Math.max(
    0,
    Math.min(Math.PI * 2 - Number.EPSILON, angleRad)
  );

  return Math.trunc(boundedAngle / QUADRANT_ARC_RAD);
};

const shuffleInPlace = (items: unknown[], seed: string): void => {
  const random = createSeededRng(seed);

  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = random.nextInt(0, index + 1);
    const swapValue = items[index];
    items[index] = items[swapIndex];
    items[swapIndex] = swapValue;
  }
};

const getCycleSeed = (eventAngles: readonly ComputedEventAngle[]): string => {
  return eventAngles
    .map((eventAngle) => {
      return `${eventAngle.event.id}:${eventAngle.angleRad.toFixed(6)}`;
    })
    .join("|");
};

export const getRandomizedQuadrantCycleIds = (
  eventAngles: readonly ComputedEventAngle[]
): readonly string[] => {
  const sortedEventAngles = [...eventAngles].sort(compareEventAnglesForCycle);
  const cycleSeed = getCycleSeed(sortedEventAngles);
  const quadrantBuckets = Array.from({ length: QUADRANT_COUNT }, () => {
    return [] as string[];
  });

  for (const eventAngle of sortedEventAngles) {
    const quadrantIndex = getQuadrantIndexForAngle(eventAngle.angleRad);
    quadrantBuckets[quadrantIndex].push(eventAngle.event.id);
  }

  for (
    let quadrantIndex = 0;
    quadrantIndex < quadrantBuckets.length;
    quadrantIndex += 1
  ) {
    shuffleInPlace(
      quadrantBuckets[quadrantIndex],
      `${CALL_OUT_CYCLE_SEED_PREFIX}:${cycleSeed}:bucket:${quadrantIndex}`
    );
  }

  const cycleEventIds: string[] = [];

  while (quadrantBuckets.some((bucket) => bucket.length > 0)) {
    const roundQuadrants: number[] = [];

    for (
      let quadrantIndex = 0;
      quadrantIndex < quadrantBuckets.length;
      quadrantIndex += 1
    ) {
      if (quadrantBuckets[quadrantIndex].length > 0) {
        roundQuadrants.push(quadrantIndex);
      }
    }

    shuffleInPlace(
      roundQuadrants,
      `${CALL_OUT_CYCLE_SEED_PREFIX}:${cycleSeed}:round:${cycleEventIds.length}`
    );

    for (const quadrantIndex of roundQuadrants) {
      const eventId = quadrantBuckets[quadrantIndex].shift();

      if (eventId !== undefined) {
        cycleEventIds.push(eventId);
      }
    }
  }

  return cycleEventIds;
};
