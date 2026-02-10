import type {
  RehoboamRenderer,
  RehoboamRendererFactoryOptions,
  RehoboamRendererFrame,
  RehoboamTheme,
} from "../../engine/types";
import { createDivergencePulseTracker } from "./divergence-pulse-tracker";
import { drawBackgroundPass } from "./passes/background-pass";
import type { BackgroundPassInput } from "./passes/background-pass";
import { drawDivergencePass } from "./passes/divergence-pass";
import type { DivergencePassInput } from "./passes/divergence-pass";
import { drawEventContourPass } from "./passes/event-contour-pass";
import type { EventContourPassInput } from "./passes/event-contour-pass";
import { createRingSpecs, drawRingsPass } from "./passes/rings-pass";
import type { RingsPassInput, RingSpec } from "./passes/rings-pass";
import { drawSweepPass } from "./passes/sweep-pass";
import type { SweepPassInput } from "./passes/sweep-pass";

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

export const createRenderer2D = (
  options: RehoboamRendererFactoryOptions
): RehoboamRenderer => {
  const { context } = options;
  let theme = options.theme;
  let ringSpecs = buildRingSpecs(theme);
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
      return;
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
    const eventContourInput: EventContourPassInput = {
      context,
      viewport: frame.viewport,
      theme,
      interaction: frame.interaction,
      events: frame.events,
      elapsedMs: frame.elapsedMs,
      entranceScale: 1,
    };
    const divergenceInput: DivergencePassInput = {
      context,
      viewport: frame.viewport,
      theme,
      interaction: frame.interaction,
      events: frame.events,
      pulses: activePulses,
      elapsedMs: frame.elapsedMs,
      timeMs: frame.timeMs,
      entranceScale: 1,
    };

    drawBackgroundPass(backgroundInput);
    drawRingsPass(ringsInput);
    drawEventContourPass(eventContourInput);
    drawDivergencePass(divergenceInput);
    drawSweepPass(sweepInput);
  };

  const destroy: RehoboamRenderer["destroy"] = () => {
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
