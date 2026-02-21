import type { DivergenceCluster } from "./divergence-cluster-tracker";

export const getClusterEnvelope = (
  cluster: DivergenceCluster,
  timeMs: number
): number => {
  const attackMs = Math.max(0, cluster.attackMs);
  const holdMs = Math.max(0, cluster.holdMs);
  const decayMs = Math.max(0, cluster.decayMs);
  const elapsedMs = timeMs - cluster.startedAtMs;

  if (elapsedMs <= 0) {
    return 0;
  }

  if (attackMs > 0 && elapsedMs <= attackMs) {
    const attackProgress = elapsedMs / attackMs;

    return attackProgress * attackProgress;
  }

  const sustainEndMs = attackMs + holdMs;

  if (elapsedMs <= sustainEndMs) {
    return 1;
  }

  if (decayMs <= 0) {
    return 0;
  }

  const decayProgress = (elapsedMs - sustainEndMs) / decayMs;

  if (decayProgress >= 1) {
    return 0;
  }

  return (1 - decayProgress) ** 2;
};
