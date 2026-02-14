import type {
  DivergenceCalloutTarget,
  RehoboamRenderer,
  RehoboamRendererFactoryOptions,
  RehoboamRendererFrame,
  RehoboamRenderSnapshot,
  RehoboamTheme,
} from "../../engine/types";
import { normalizeAngle, TAU } from "../../layout/polar";
import { createDivergenceClusterTracker } from "./divergence-cluster-tracker";
import type { DivergenceCluster } from "./divergence-cluster-tracker";
import { createDivergencePulseTracker } from "./divergence-pulse-tracker";
import { drawBackgroundPass } from "./passes/background-pass";
import type { BackgroundPassInput } from "./passes/background-pass";
import { drawDivergencePass } from "./passes/divergence-pass";
import type { DivergencePassInput } from "./passes/divergence-pass";
import { createRingSpecs, drawRingsPass } from "./passes/rings-pass";
import type { RingsPassInput, RingSpec } from "./passes/rings-pass";
import { drawSweepPass } from "./passes/sweep-pass";
import type { SweepPassInput } from "./passes/sweep-pass";

const CLUSTER_MODULATION_SPEED_SCALE = 0.52;
const EMPTY_DIVERGENCE_CALLOUT_TARGETS = [] as const;

const shouldRebuildRingSpecs = (
  previousTheme: RehoboamTheme,
  nextTheme: RehoboamTheme
): boolean => {
  return (
    previousTheme.ringSeed !== nextTheme.ringSeed ||
    previousTheme.ringCount !== nextTheme.ringCount
  );
};

const buildRingSpecs = (theme: RehoboamTheme): readonly RingSpec[] => {
  return createRingSpecs({
    seed: theme.ringSeed,
    ringCount: theme.ringCount,
  });
};

const getClusterEnvelope = (
  cluster: DivergenceCluster,
  timeMs: number
): number => {
  const elapsedMs = timeMs - cluster.startedAtMs;

  if (elapsedMs <= 0) {
    return 0;
  }

  if (elapsedMs <= cluster.attackMs) {
    const attackProgress = elapsedMs / cluster.attackMs;

    return attackProgress * attackProgress;
  }

  const sustainEndMs = cluster.attackMs + cluster.holdMs;

  if (elapsedMs <= sustainEndMs) {
    return 1;
  }

  const decayProgress = (elapsedMs - sustainEndMs) / cluster.decayMs;

  if (decayProgress >= 1) {
    return 0;
  }

  return (1 - decayProgress) ** 2;
};

const resolveClusterCalloutTargets = (
  clusters: readonly DivergenceCluster[],
  elapsedMs: number,
  timeMs: number
): readonly DivergenceCalloutTarget[] => {
  const elapsedSeconds = elapsedMs / 1000;
  const targets: DivergenceCalloutTarget[] = [];

  for (const cluster of clusters) {
    const clusterEnvelope = getClusterEnvelope(cluster, timeMs);

    if (clusterEnvelope <= 0) {
      continue;
    }

    const ageSeconds = Math.max(0, (timeMs - cluster.startedAtMs) / 1000);
    const angleRad = normalizeAngle(
      cluster.centerAngleRad + cluster.driftRadPerSecond * ageSeconds
    );
    const flareModulation =
      0.78 +
      0.22 *
        Math.sin(
          elapsedSeconds *
            CLUSTER_MODULATION_SPEED_SCALE *
            cluster.flareSpeedHz *
            TAU +
            cluster.flarePhaseOffsetRad
        );
    const strength = cluster.strength * clusterEnvelope * flareModulation;

    if (strength <= 0) {
      continue;
    }

    targets.push({
      id: cluster.id,
      angleRad,
      strength,
    });
  }

  targets.sort((left, right) => {
    if (left.strength !== right.strength) {
      return right.strength - left.strength;
    }

    return left.id.localeCompare(right.id);
  });

  return targets;
};

export const createRenderer2D = (
  options: RehoboamRendererFactoryOptions
): RehoboamRenderer => {
  const { context } = options;
  let theme = options.theme;
  let ringSpecs = buildRingSpecs(theme);
  const divergenceClusterTracker = createDivergenceClusterTracker();
  const divergencePulseTracker = createDivergencePulseTracker();
  let isDestroyed = false;

  const resize: RehoboamRenderer["resize"] = () => {
    // The engine owns viewport updates. No local resize bookkeeping is needed yet.
  };

  const setTheme: RehoboamRenderer["setTheme"] = (nextTheme) => {
    const shouldRebuild = shouldRebuildRingSpecs(theme, nextTheme);
    theme = nextTheme;

    if (shouldRebuild) {
      ringSpecs = buildRingSpecs(nextTheme);
    }
  };

  const render: RehoboamRenderer["render"] = (frame: RehoboamRendererFrame) => {
    if (isDestroyed) {
      return {
        timeMs: frame.timeMs,
        divergenceCalloutTargets: EMPTY_DIVERGENCE_CALLOUT_TARGETS,
      };
    }

    if (shouldRebuildRingSpecs(theme, frame.theme)) {
      ringSpecs = buildRingSpecs(frame.theme);
    }

    theme = frame.theme;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(
      0,
      0,
      frame.viewport.pixelWidth,
      frame.viewport.pixelHeight
    );
    context.setTransform(frame.viewport.dpr, 0, 0, frame.viewport.dpr, 0, 0);

    const backgroundInput: BackgroundPassInput = {
      context,
      viewport: frame.viewport,
      theme,
    };

    const ringsInput: RingsPassInput = {
      context,
      viewport: frame.viewport,
      theme,
      elapsedMs: frame.elapsedMs,
      rings: ringSpecs,
    };

    const sweepInput: SweepPassInput = {
      context,
      viewport: frame.viewport,
      theme,
      interaction: frame.interaction,
      elapsedMs: frame.elapsedMs,
    };

    divergencePulseTracker.updateEvents(frame.events, frame.timeMs);
    const activePulses = divergencePulseTracker.getActivePulses(frame.timeMs);
    divergenceClusterTracker.update(frame.timeMs);
    const activeClusters = divergenceClusterTracker.getActiveClusters(
      frame.timeMs
    );
    const divergenceInput: DivergencePassInput = {
      context,
      viewport: frame.viewport,
      theme,
      interaction: frame.interaction,
      events: frame.events,
      pulses: activePulses,
      clusters: activeClusters,
      elapsedMs: frame.elapsedMs,
      timeMs: frame.timeMs,
      entranceScale: 1,
    };

    drawBackgroundPass(backgroundInput);
    drawRingsPass(ringsInput);
    drawDivergencePass(divergenceInput);
    drawSweepPass(sweepInput);

    const snapshot: RehoboamRenderSnapshot = {
      timeMs: frame.timeMs,
      divergenceCalloutTargets: resolveClusterCalloutTargets(
        activeClusters,
        frame.elapsedMs,
        frame.timeMs
      ),
    };

    return snapshot;
  };

  const destroy: RehoboamRenderer["destroy"] = () => {
    divergenceClusterTracker.reset();
    divergencePulseTracker.reset();
    isDestroyed = true;
  };

  return {
    resize,
    setTheme,
    render,
    destroy,
  };
};
