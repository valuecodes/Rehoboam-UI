import { createSeededRng } from "../../../../shared/utils/seeded-rng";
import type { SeededRng, SeedInput } from "../../../../shared/utils/seeded-rng";
import type { WorldEventSeverity } from "../../engine/types";
import {
  normalizeAngle,
  shortestAngularDistance,
  TAU,
} from "../../layout/polar";

const DEFAULT_CLUSTER_SEED_PREFIX = "rehoboam-v2-divergence-clusters";
const DEFAULT_MIN_ACTIVE_CLUSTERS = 2;
const DEFAULT_MAX_ACTIVE_CLUSTERS = 3;
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
  8_500, 14_000,
];
const HOTSPOT_WEIGHT_JITTER_RANGE: readonly [number, number] = [-0.18, 0.18];

type ClusterArchetype = Readonly<{
  spawnWeight: number;
  severity: WorldEventSeverity;
  widthRadRange: readonly [number, number];
  strengthRange: readonly [number, number];
  attackMsRange: readonly [number, number];
  holdMsRange: readonly [number, number];
  decayMsRange: readonly [number, number];
  driftRadPerSecondRange: readonly [number, number];
  spikeCountRange: readonly [number, number];
  spikeStrengthRange: readonly [number, number];
  spikeWidthScaleRange: readonly [number, number];
}>;

const CLUSTER_ARCHETYPES: readonly ClusterArchetype[] = [
  {
    spawnWeight: 0.52,
    severity: "medium",
    widthRadRange: [0.078, 0.136],
    strengthRange: [0.0061, 0.0112],
    attackMsRange: [480, 920],
    holdMsRange: [14_500, 22_000],
    decayMsRange: [6_100, 9_200],
    driftRadPerSecondRange: [-0.006, 0.006],
    spikeCountRange: [3, 6],
    spikeStrengthRange: [1.28, 2.05],
    spikeWidthScaleRange: [0.17, 0.4],
  },
  {
    spawnWeight: 0.34,
    severity: "high",
    widthRadRange: [0.142, 0.216],
    strengthRange: [0.0108, 0.0178],
    attackMsRange: [520, 980],
    holdMsRange: [17_500, 26_000],
    decayMsRange: [7_800, 11_800],
    driftRadPerSecondRange: [-0.0045, 0.0045],
    spikeCountRange: [4, 7],
    spikeStrengthRange: [1.7, 2.7],
    spikeWidthScaleRange: [0.11, 0.3],
  },
  {
    spawnWeight: 0.14,
    severity: "critical",
    widthRadRange: [0.194, 0.33],
    strengthRange: [0.0168, 0.0282],
    attackMsRange: [560, 1_100],
    holdMsRange: [20_000, 31_000],
    decayMsRange: [9_600, 14_500],
    driftRadPerSecondRange: [-0.0038, 0.0038],
    spikeCountRange: [4, 8],
    spikeStrengthRange: [2.05, 3.3],
    spikeWidthScaleRange: [0.09, 0.24],
  },
] as const;

export type DivergenceClusterSpike = Readonly<{
  angleOffsetRad: number;
  widthRad: number;
  strengthScale: number;
  flickerHz: number;
  phaseOffsetRad: number;
}>;

export type DivergenceCluster = Readonly<{
  id: string;
  centerAngleRad: number;
  widthRad: number;
  strength: number;
  severity: WorldEventSeverity;
  startedAtMs: number;
  attackMs: number;
  holdMs: number;
  decayMs: number;
  driftRadPerSecond: number;
  flareSpeedHz: number;
  flarePhaseOffsetRad: number;
  spikes: readonly DivergenceClusterSpike[];
}>;

type ClusterHotspot = Readonly<{
  anchorAngleRad: number;
  driftRadPerSecond: number;
  wobbleAmplitudeRad: number;
  wobbleHz: number;
  phaseOffsetRad: number;
  spawnWeight: number;
}>;

export type DivergenceClusterTracker = Readonly<{
  update: (timeMs: number) => void;
  getActiveClusters: (timeMs: number) => readonly DivergenceCluster[];
  reset: () => void;
}>;

export type CreateDivergenceClusterTrackerOptions = Readonly<{
  seed?: SeedInput;
  minActiveClusters?: number;
  maxActiveClusters?: number;
}>;

const clampPositiveInt = (
  value: number | undefined,
  fallback: number
): number => {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.trunc(value));
};

const createDefaultClusterSeed = (): SeedInput => {
  return `${DEFAULT_CLUSTER_SEED_PREFIX}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
};

const randomFromRange = (
  random: SeededRng,
  range: readonly [number, number]
): number => {
  return random.nextFloat(range[0], range[1]);
};

const randomIntFromRange = (
  random: SeededRng,
  range: readonly [number, number]
): number => {
  return random.nextInt(range[0], range[1]);
};

const getClusterLifetimeMs = (cluster: DivergenceCluster): number => {
  return cluster.attackMs + cluster.holdMs + cluster.decayMs;
};

const isClusterActive = (
  cluster: DivergenceCluster,
  timeMs: number
): boolean => {
  return timeMs - cluster.startedAtMs <= getClusterLifetimeMs(cluster);
};

const pickClusterArchetype = (random: SeededRng): ClusterArchetype => {
  const totalWeight = CLUSTER_ARCHETYPES.reduce((sum, archetype) => {
    return sum + archetype.spawnWeight;
  }, 0);
  const pick = random.nextFloat(0, totalWeight);
  let cumulative = 0;

  for (const archetype of CLUSTER_ARCHETYPES) {
    cumulative += archetype.spawnWeight;

    if (pick <= cumulative) {
      return archetype;
    }
  }

  return CLUSTER_ARCHETYPES[CLUSTER_ARCHETYPES.length - 1];
};

const normalizeSpawnWeights = (
  hotspots: readonly ClusterHotspot[]
): readonly ClusterHotspot[] => {
  const totalWeight = hotspots.reduce((sum, hotspot) => {
    return sum + hotspot.spawnWeight;
  }, 0);

  if (totalWeight <= 0) {
    return hotspots.map((hotspot) => {
      return {
        ...hotspot,
        spawnWeight: 1 / hotspots.length,
      };
    });
  }

  return hotspots.map((hotspot) => {
    return {
      ...hotspot,
      spawnWeight: hotspot.spawnWeight / totalWeight,
    };
  });
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
): number => {
  return timeMs + randomFromRange(random, HOTSPOT_RETARGET_DELAY_RANGE_MS);
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

  return hotspots[hotspots.length - 1];
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

const createClusterSpikes = (
  random: SeededRng,
  archetype: ClusterArchetype,
  widthRad: number
): readonly DivergenceClusterSpike[] => {
  const spikeCount = randomIntFromRange(random, archetype.spikeCountRange);
  const maxOffsetRad = widthRad * 1.25;

  return Array.from({ length: spikeCount }, () => {
    const widthScale = randomFromRange(random, archetype.spikeWidthScaleRange);

    return {
      angleOffsetRad: random.nextFloat(-maxOffsetRad, maxOffsetRad),
      widthRad: Math.max(0.03, Math.min(0.24, widthRad * widthScale)),
      strengthScale: randomFromRange(random, archetype.spikeStrengthRange),
      flickerHz: random.nextFloat(0.24, 0.92),
      phaseOffsetRad: random.nextFloat(0, TAU),
    };
  }).sort((left, right) => {
    return right.strengthScale - left.strengthScale;
  });
};

const createCluster = (
  random: SeededRng,
  clusterId: number,
  timeMs: number,
  existingClusters: readonly DivergenceCluster[],
  hotspots: readonly ClusterHotspot[]
): DivergenceCluster => {
  const archetype = pickClusterArchetype(random);
  const widthRad = randomFromRange(random, archetype.widthRadRange);
  const spikes = createClusterSpikes(random, archetype, widthRad);

  return {
    id: `cluster-${clusterId}`,
    centerAngleRad: resolveSpawnAngleRad(
      random,
      existingClusters,
      hotspots,
      timeMs
    ),
    widthRad,
    strength: randomFromRange(random, archetype.strengthRange),
    severity: archetype.severity,
    startedAtMs: timeMs,
    attackMs: Math.trunc(randomFromRange(random, archetype.attackMsRange)),
    holdMs: Math.trunc(randomFromRange(random, archetype.holdMsRange)),
    decayMs: Math.trunc(randomFromRange(random, archetype.decayMsRange)),
    driftRadPerSecond: randomFromRange(
      random,
      archetype.driftRadPerSecondRange
    ),
    flareSpeedHz: random.nextFloat(0.08, 0.22),
    flarePhaseOffsetRad: random.nextFloat(0, TAU),
    spikes,
  };
};

const resolveSpawnDelayMs = (
  random: SeededRng,
  activeClusterCount: number,
  minActiveClusters: number,
  maxActiveClusters: number
): number => {
  const span = Math.max(1, maxActiveClusters - minActiveClusters);
  const density = Math.min(
    1,
    Math.max(0, (activeClusterCount - minActiveClusters) / span)
  );
  const minDelayMs = 2_200 + density * 1_600;
  const maxDelayMs = 5_600 + density * 3_800;

  return random.nextFloat(minDelayMs, maxDelayMs);
};

export const createDivergenceClusterTracker = (
  options: CreateDivergenceClusterTrackerOptions = {}
): DivergenceClusterTracker => {
  const seed = options.seed ?? createDefaultClusterSeed();
  const maxActiveClusters = clampPositiveInt(
    options.maxActiveClusters,
    DEFAULT_MAX_ACTIVE_CLUSTERS
  );
  const minActiveClusters = Math.min(
    clampPositiveInt(options.minActiveClusters, DEFAULT_MIN_ACTIVE_CLUSTERS),
    maxActiveClusters
  );

  let random = createSeededRng(seed);
  let hotspots = createClusterHotspots(random);
  let nextClusterId = 0;
  let clusters: readonly DivergenceCluster[] = [];
  let nextSpawnAtMs = 0;
  let nextHotspotRetargetAtMs = 0;
  let hasInitialized = false;

  const spawnCluster = (
    timeMs: number,
    existingClusters: readonly DivergenceCluster[]
  ): DivergenceCluster => {
    const cluster = createCluster(
      random,
      nextClusterId,
      timeMs,
      existingClusters,
      hotspots
    );
    nextClusterId += 1;

    return cluster;
  };

  const ensureMinimumClusters = (
    timeMs: number,
    allowBackfill: boolean
  ): void => {
    if (clusters.length >= minActiveClusters) {
      return;
    }

    const nextClusters = [...clusters];

    while (nextClusters.length < minActiveClusters) {
      if (allowBackfill) {
        // Backfilled starts prevent seeded clusters from peaking in sync at boot.
        const backfillMs = random.nextFloat(1_100, 5_800);
        nextClusters.push(spawnCluster(timeMs - backfillMs, nextClusters));
        continue;
      }

      nextClusters.push(spawnCluster(timeMs, nextClusters));
    }

    clusters = nextClusters;
  };

  const scheduleNextSpawn = (timeMs: number): void => {
    nextSpawnAtMs =
      timeMs +
      resolveSpawnDelayMs(
        random,
        clusters.length,
        minActiveClusters,
        maxActiveClusters
      );
  };

  const update: DivergenceClusterTracker["update"] = (timeMs) => {
    if (!Number.isFinite(timeMs)) {
      return;
    }

    clusters = clusters.filter((cluster) => {
      return isClusterActive(cluster, timeMs);
    });

    if (!hasInitialized) {
      hasInitialized = true;
      ensureMinimumClusters(timeMs, true);
      scheduleNextSpawn(timeMs + random.nextFloat(1_400, 3_600));
      nextHotspotRetargetAtMs = resolveNextHotspotRetargetAtMs(random, timeMs);

      return;
    }

    if (timeMs >= nextHotspotRetargetAtMs) {
      hotspots = retargetHotspots(random, hotspots, timeMs);
      nextHotspotRetargetAtMs = resolveNextHotspotRetargetAtMs(random, timeMs);
      nextSpawnAtMs = Math.min(
        nextSpawnAtMs,
        timeMs + random.nextFloat(700, 1800)
      );
    }

    ensureMinimumClusters(timeMs, false);

    if (clusters.length < maxActiveClusters && timeMs >= nextSpawnAtMs) {
      clusters = [...clusters, spawnCluster(timeMs, clusters)];
      scheduleNextSpawn(timeMs);
    }
  };

  const getActiveClusters: DivergenceClusterTracker["getActiveClusters"] = (
    timeMs
  ) => {
    if (!Number.isFinite(timeMs)) {
      return [...clusters];
    }

    clusters = clusters.filter((cluster) => {
      return isClusterActive(cluster, timeMs);
    });

    return [...clusters];
  };

  const reset: DivergenceClusterTracker["reset"] = () => {
    random = createSeededRng(seed);
    hotspots = createClusterHotspots(random);
    nextClusterId = 0;
    clusters = [];
    nextSpawnAtMs = 0;
    nextHotspotRetargetAtMs = 0;
    hasInitialized = false;
  };

  return {
    update,
    getActiveClusters,
    reset,
  };
};
