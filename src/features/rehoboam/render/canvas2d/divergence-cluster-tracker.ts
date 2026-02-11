import { createSeededRng } from "../../../../shared/utils/seeded-rng";
import type { SeededRng, SeedInput } from "../../../../shared/utils/seeded-rng";
import type { WorldEventSeverity } from "../../engine/types";
import { shortestAngularDistance, TAU } from "../../layout/polar";

const DEFAULT_CLUSTER_SEED_PREFIX = "rehoboam-v2-divergence-clusters";
const DEFAULT_MIN_ACTIVE_CLUSTERS = 3;
const DEFAULT_MAX_ACTIVE_CLUSTERS = 4;

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
    widthRadRange: [0.064, 0.112],
    strengthRange: [0.0046, 0.0088],
    attackMsRange: [480, 920],
    holdMsRange: [12_000, 18_500],
    decayMsRange: [4_200, 6_800],
    driftRadPerSecondRange: [-0.006, 0.006],
    spikeCountRange: [2, 5],
    spikeStrengthRange: [1.2, 1.9],
    spikeWidthScaleRange: [0.18, 0.42],
  },
  {
    spawnWeight: 0.34,
    severity: "high",
    widthRadRange: [0.112, 0.172],
    strengthRange: [0.0072, 0.0124],
    attackMsRange: [520, 980],
    holdMsRange: [13_500, 20_500],
    decayMsRange: [4_800, 7_500],
    driftRadPerSecondRange: [-0.0045, 0.0045],
    spikeCountRange: [3, 6],
    spikeStrengthRange: [1.35, 2.3],
    spikeWidthScaleRange: [0.14, 0.34],
  },
  {
    spawnWeight: 0.14,
    severity: "critical",
    widthRadRange: [0.152, 0.262],
    strengthRange: [0.0108, 0.0184],
    attackMsRange: [560, 1_100],
    holdMsRange: [15_000, 23_000],
    decayMsRange: [5_400, 8_800],
    driftRadPerSecondRange: [-0.0038, 0.0038],
    spikeCountRange: [3, 7],
    spikeStrengthRange: [1.6, 2.8],
    spikeWidthScaleRange: [0.11, 0.3],
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

const resolveSpawnAngleRad = (
  random: SeededRng,
  clusters: readonly DivergenceCluster[]
): number => {
  if (clusters.length === 0) {
    return random.nextFloat(0, TAU);
  }

  let bestCandidate = random.nextFloat(0, TAU);
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < 9; index += 1) {
    const candidate = random.nextFloat(0, TAU);
    const nearestClearance = clusters.reduce((nearest, cluster) => {
      const angularDistance = Math.abs(
        shortestAngularDistance(candidate, cluster.centerAngleRad)
      );
      const clearance = angularDistance - cluster.widthRad * 0.72;

      return Math.min(nearest, clearance);
    }, Math.PI);
    const score = nearestClearance + random.nextFloat(-0.008, 0.008);

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
      flickerHz: random.nextFloat(0.12, 0.58),
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
  existingClusters: readonly DivergenceCluster[]
): DivergenceCluster => {
  const archetype = pickClusterArchetype(random);
  const widthRad = randomFromRange(random, archetype.widthRadRange);
  const spikes = createClusterSpikes(random, archetype, widthRad);

  return {
    id: `cluster-${clusterId}`,
    centerAngleRad: resolveSpawnAngleRad(random, existingClusters),
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
    flareSpeedHz: random.nextFloat(0.04, 0.14),
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
  const minDelayMs = 3_400 + density * 2_400;
  const maxDelayMs = 8_500 + density * 5_000;

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
  let nextClusterId = 0;
  let clusters: readonly DivergenceCluster[] = [];
  let nextSpawnAtMs = 0;
  let hasInitialized = false;

  const spawnCluster = (
    timeMs: number,
    existingClusters: readonly DivergenceCluster[]
  ): DivergenceCluster => {
    const cluster = createCluster(
      random,
      nextClusterId,
      timeMs,
      existingClusters
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

      return;
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
    nextClusterId = 0;
    clusters = [];
    nextSpawnAtMs = 0;
    hasInitialized = false;
  };

  return {
    update,
    getActiveClusters,
    reset,
  };
};
