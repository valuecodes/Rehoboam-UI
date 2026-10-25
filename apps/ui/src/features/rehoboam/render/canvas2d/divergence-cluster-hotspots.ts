import {
  normalizeAngle,
  shortestAngularDistance,
  TAU,
} from "~/features/rehoboam/layout/polar";
import type { SeededRng } from "~/shared/utils/seeded-rng";

import type { DivergenceCluster } from "./divergence-cluster-types";
import { randomFromRange } from "./divergence-random";

const DEFAULT_HOTSPOT_MIN_COUNT = 1;
const DEFAULT_HOTSPOT_MAX_COUNT = 2;
const HOTSPOT_CANDIDATE_COUNT = 10;
const HOTSPOT_EXPLORATION_CANDIDATE_COUNT = 6;
const HOTSPOT_SPAWN_SPREAD_RANGE_RAD: readonly [number, number] = [0.04, 0.26];
const HOTSPOT_SPAWN_BIAS_WEIGHT = 1.04;
const HOTSPOT_FREE_SPAWN_PROBABILITY = 0.16;
const HOTSPOT_DRIFT_RANGE_RAD_PER_SECOND: readonly [number, number] = [
  -0.018, 0.018,
];
const HOTSPOT_WOBBLE_AMPLITUDE_RANGE_RAD: readonly [number, number] = [
  0.03, 0.11,
];
const HOTSPOT_WOBBLE_HZ_RANGE: readonly [number, number] = [0.03, 0.12];
const HOTSPOT_RETARGET_OFFSET_RANGE_RAD: readonly [number, number] = [
  0.42, 1.4,
];
const HOTSPOT_RETARGET_DELAY_RANGE_MS: readonly [number, number] = [
  8500, 14_000,
];
const HOTSPOT_WEIGHT_JITTER_RANGE: readonly [number, number] = [-0.18, 0.18];

type ClusterHotspot = Readonly<{
  anchorAngleRad: number;
  driftRadPerSecond: number;
  wobbleAmplitudeRad: number;
  wobbleHz: number;
  phaseOffsetRad: number;
  spawnWeight: number;
}>;

const normalizeSpawnWeights = (
  hotspots: readonly ClusterHotspot[]
): readonly ClusterHotspot[] => {
  const totalWeight = hotspots.reduce(
    (sum, hotspot) => sum + hotspot.spawnWeight,
    0
  );

  if (totalWeight <= 0) {
    return hotspots.map((hotspot) => ({
      ...hotspot,
      spawnWeight: 1 / hotspots.length,
    }));
  }

  return hotspots.map((hotspot) => ({
    ...hotspot,
    spawnWeight: hotspot.spawnWeight / totalWeight,
  }));
};

const createClusterHotspots = (
  random: SeededRng
): readonly ClusterHotspot[] => {
  const hotspotCount = random.nextInt(
    DEFAULT_HOTSPOT_MIN_COUNT,
    DEFAULT_HOTSPOT_MAX_COUNT + 1
  );
  const primaryAnchor = random.nextFloat(0, TAU);
  const anchorAngles: number[] = [primaryAnchor];

  if (hotspotCount > 1) {
    anchorAngles.push(
      normalizeAngle(primaryAnchor + random.nextFloat(1.05, 2.25))
    );
  }

  const hotspots = anchorAngles.map((anchorAngleRad, index) => {
    const rawWeight =
      index === 0 ? random.nextFloat(0.58, 0.82) : random.nextFloat(0.32, 0.56);

    return {
      anchorAngleRad,
      driftRadPerSecond: randomFromRange(
        random,
        HOTSPOT_DRIFT_RANGE_RAD_PER_SECOND
      ),
      wobbleAmplitudeRad: randomFromRange(
        random,
        HOTSPOT_WOBBLE_AMPLITUDE_RANGE_RAD
      ),
      wobbleHz: randomFromRange(random, HOTSPOT_WOBBLE_HZ_RANGE),
      phaseOffsetRad: random.nextFloat(0, TAU),
      spawnWeight: rawWeight,
    };
  });

  return normalizeSpawnWeights(hotspots);
};

const resolveNextHotspotRetargetAtMs = (
  random: SeededRng,
  timeMs: number
): number => timeMs + randomFromRange(random, HOTSPOT_RETARGET_DELAY_RANGE_MS);

const resolveHotspotAngleRad = (
  hotspot: ClusterHotspot,
  timeMs: number
): number => {
  const elapsedSeconds = timeMs / 1000;
  const wobbleOffset =
    Math.sin(elapsedSeconds * hotspot.wobbleHz * TAU + hotspot.phaseOffsetRad) *
    hotspot.wobbleAmplitudeRad;

  return normalizeAngle(
    hotspot.anchorAngleRad +
      hotspot.driftRadPerSecond * elapsedSeconds +
      wobbleOffset
  );
};

const retargetHotspots = (
  random: SeededRng,
  hotspots: readonly ClusterHotspot[],
  timeMs: number
): readonly ClusterHotspot[] => {
  const nextHotspots = hotspots.map((hotspot) => {
    const currentAngleRad = resolveHotspotAngleRad(hotspot, timeMs);
    const offsetDirection = random.next() < 0.5 ? -1 : 1;
    const angleOffset =
      offsetDirection *
      randomFromRange(random, HOTSPOT_RETARGET_OFFSET_RANGE_RAD);
    const nextWeight = Math.max(
      0.12,
      hotspot.spawnWeight + randomFromRange(random, HOTSPOT_WEIGHT_JITTER_RANGE)
    );

    return {
      anchorAngleRad: normalizeAngle(currentAngleRad + angleOffset),
      driftRadPerSecond: randomFromRange(
        random,
        HOTSPOT_DRIFT_RANGE_RAD_PER_SECOND
      ),
      wobbleAmplitudeRad: randomFromRange(
        random,
        HOTSPOT_WOBBLE_AMPLITUDE_RANGE_RAD
      ),
      wobbleHz: randomFromRange(random, HOTSPOT_WOBBLE_HZ_RANGE),
      phaseOffsetRad: random.nextFloat(0, TAU),
      spawnWeight: nextWeight,
    };
  });

  return normalizeSpawnWeights(nextHotspots);
};

const pickHotspot = (
  random: SeededRng,
  hotspots: readonly ClusterHotspot[]
): ClusterHotspot => {
  const pick = random.nextFloat(0, 1);
  let cumulative = 0;

  for (const hotspot of hotspots) {
    cumulative += hotspot.spawnWeight;

    if (pick <= cumulative) {
      return hotspot;
    }
  }

  return hotspots.at(-1) ?? hotspots[0];
};

const getNearestClusterClearanceRad = (
  angleRad: number,
  clusters: readonly DivergenceCluster[]
): number => {
  if (clusters.length === 0) {
    return Math.PI;
  }

  return clusters.reduce((nearest, cluster) => {
    const angularDistance = Math.abs(
      shortestAngularDistance(angleRad, cluster.centerAngleRad)
    );
    const clearance = angularDistance - cluster.widthRad * 0.72;

    return Math.min(nearest, clearance);
  }, Math.PI);
};

const getNearestHotspotDistanceRad = (
  angleRad: number,
  hotspots: readonly ClusterHotspot[],
  timeMs: number
): number => {
  if (hotspots.length === 0) {
    return Math.PI;
  }

  return hotspots.reduce((nearestDistance, hotspot) => {
    const hotspotAngleRad = resolveHotspotAngleRad(hotspot, timeMs);
    const angularDistance = Math.abs(
      shortestAngularDistance(angleRad, hotspotAngleRad)
    );

    return Math.min(nearestDistance, angularDistance);
  }, Math.PI);
};

const createHotspotCandidateAngleRad = (
  random: SeededRng,
  hotspots: readonly ClusterHotspot[],
  timeMs: number
): number => {
  if (random.next() < HOTSPOT_FREE_SPAWN_PROBABILITY) {
    return random.nextFloat(0, TAU);
  }

  const hotspot = pickHotspot(random, hotspots);
  const hotspotAngleRad = resolveHotspotAngleRad(hotspot, timeMs);
  const spreadRad = randomFromRange(random, HOTSPOT_SPAWN_SPREAD_RANGE_RAD);
  const centeredJitter =
    (random.nextFloat(-1, 1) + random.nextFloat(-1, 1)) * 0.5;

  return normalizeAngle(hotspotAngleRad + centeredJitter * spreadRad);
};

const resolveSpawnAngleRad = (
  random: SeededRng,
  clusters: readonly DivergenceCluster[],
  hotspots: readonly ClusterHotspot[],
  timeMs: number
): number => {
  if (hotspots.length === 0) {
    return random.nextFloat(0, TAU);
  }

  let bestCandidate = createHotspotCandidateAngleRad(random, hotspots, timeMs);
  let bestScore = Number.NEGATIVE_INFINITY;

  for (
    let index = 0;
    index < HOTSPOT_CANDIDATE_COUNT + HOTSPOT_EXPLORATION_CANDIDATE_COUNT;
    index += 1
  ) {
    const useExplorationCandidate = index >= HOTSPOT_CANDIDATE_COUNT;
    const candidate = useExplorationCandidate
      ? random.nextFloat(0, TAU)
      : createHotspotCandidateAngleRad(random, hotspots, timeMs);
    const nearestClearance = getNearestClusterClearanceRad(candidate, clusters);
    const nearestHotspotDistance = getNearestHotspotDistanceRad(
      candidate,
      hotspots,
      timeMs
    );
    const hotspotAffinity =
      1 - Math.min(1, nearestHotspotDistance / Math.max(0.14, Math.PI * 0.23));
    const overlapPenalty =
      nearestClearance >= -0.02 ? 0 : Math.abs(nearestClearance) * 2.4;
    const score =
      hotspotAffinity * HOTSPOT_SPAWN_BIAS_WEIGHT +
      nearestClearance * 0.34 -
      overlapPenalty +
      random.nextFloat(-0.012, 0.012);

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
};

export {
  createClusterHotspots,
  resolveNextHotspotRetargetAtMs,
  resolveSpawnAngleRad,
  retargetHotspots,
};
export type { ClusterHotspot };
