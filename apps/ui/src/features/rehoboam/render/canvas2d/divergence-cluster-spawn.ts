import type { WorldEventSeverity } from "~/features/rehoboam/engine/types";
import { TAU } from "~/features/rehoboam/layout/polar";
import type { SeededRng } from "~/shared/utils/seeded-rng";

import { resolveSpawnAngleRad } from "./divergence-cluster-hotspots";
import type { ClusterHotspot } from "./divergence-cluster-hotspots";
import type {
  DivergenceCluster,
  DivergenceClusterSpike,
} from "./divergence-cluster-types";
import { randomFromRange, randomIntFromRange } from "./divergence-random";

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
    decayMsRange: [6100, 9200],
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
    decayMsRange: [7800, 11_800],
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
    attackMsRange: [560, 1100],
    holdMsRange: [20_000, 31_000],
    decayMsRange: [9600, 14_500],
    driftRadPerSecondRange: [-0.0038, 0.0038],
    spikeCountRange: [4, 8],
    spikeStrengthRange: [2.05, 3.3],
    spikeWidthScaleRange: [0.09, 0.24],
  },
] as const;

const pickClusterArchetype = (random: SeededRng): ClusterArchetype => {
  const totalWeight = CLUSTER_ARCHETYPES.reduce(
    (sum, archetype) => sum + archetype.spawnWeight,
    0
  );
  const pick = random.nextFloat(0, totalWeight);
  let cumulative = 0;

  for (const archetype of CLUSTER_ARCHETYPES) {
    cumulative += archetype.spawnWeight;

    if (pick <= cumulative) {
      return archetype;
    }
  }

  return CLUSTER_ARCHETYPES.at(-1) ?? CLUSTER_ARCHETYPES[0];
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
  }).sort((left, right) => right.strengthScale - left.strengthScale);
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
  const minDelayMs = 2200 + density * 1600;
  const maxDelayMs = 5600 + density * 3800;

  return random.nextFloat(minDelayMs, maxDelayMs);
};

export { createCluster, resolveSpawnDelayMs };
