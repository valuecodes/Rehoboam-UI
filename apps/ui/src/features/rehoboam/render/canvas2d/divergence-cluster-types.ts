import type { WorldEventSeverity } from "~/features/rehoboam/engine/types";

type DivergenceClusterSpike = Readonly<{
  angleOffsetRad: number;
  widthRad: number;
  strengthScale: number;
  flickerHz: number;
  phaseOffsetRad: number;
}>;

type DivergenceCluster = Readonly<{
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

export type { DivergenceCluster, DivergenceClusterSpike };
