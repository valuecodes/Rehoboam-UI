import { createSeededRng } from "~/shared/utils/seeded-rng";
import type { SeedInput } from "~/shared/utils/seeded-rng";

import {
  createClusterHotspots,
  resolveNextHotspotRetargetAtMs,
  retargetHotspots,
} from "./divergence-cluster-hotspots";
import { createCluster, resolveSpawnDelayMs } from "./divergence-cluster-spawn";
import type { DivergenceCluster } from "./divergence-cluster-types";

const DEFAULT_CLUSTER_SEED_PREFIX = "rehoboam-v2-divergence-clusters";
const DEFAULT_MIN_ACTIVE_CLUSTERS = 2;
const DEFAULT_MAX_ACTIVE_CLUSTERS = 3;

type DivergenceClusterTracker = Readonly<{
  update: (timeMs: number) => void;
  getActiveClusters: (timeMs: number) => readonly DivergenceCluster[];
  reset: () => void;
}>;

type CreateDivergenceClusterTrackerOptions = Readonly<{
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

const createDefaultClusterSeed = (): SeedInput =>
  `${DEFAULT_CLUSTER_SEED_PREFIX}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;

const getClusterLifetimeMs = (cluster: DivergenceCluster): number =>
  cluster.attackMs + cluster.holdMs + cluster.decayMs;

const isClusterActive = (cluster: DivergenceCluster, timeMs: number): boolean =>
  timeMs - cluster.startedAtMs <= getClusterLifetimeMs(cluster);

const createDivergenceClusterTracker = (
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
        const backfillMs = random.nextFloat(1100, 5800);
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

    clusters = clusters.filter((cluster) => isClusterActive(cluster, timeMs));

    if (!hasInitialized) {
      hasInitialized = true;
      ensureMinimumClusters(timeMs, true);
      scheduleNextSpawn(timeMs + random.nextFloat(1400, 3600));
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

    clusters = clusters.filter((cluster) => isClusterActive(cluster, timeMs));

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

export { createDivergenceClusterTracker };
