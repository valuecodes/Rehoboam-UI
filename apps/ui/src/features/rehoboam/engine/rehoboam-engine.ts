import { createRenderer2D } from "../render/canvas2d/renderer-2d";
import {
  createViewportState,
  DEFAULT_DPR_CAP,
  DEFAULT_THEME,
} from "./defaults";
import { cloneInteractionState, createInitialInteractionState } from "./input";
import { createMonotonicNow, createRafLoop } from "./timing";
import type {
  EngineResizeInput,
  InteractionState,
  RehoboamEngine,
  RehoboamEngineOptions,
  RehoboamRenderer,
  RehoboamTheme,
  WorldEvent,
} from "./types";

const MAX_FRAME_DELTA_MS = 100;

const getDefaultNow = (): number => {
  if (typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
};

const getDefaultRaf = (): ((callback: FrameRequestCallback) => number) => {
  if (typeof window.requestAnimationFrame !== "function") {
    throw new Error("requestAnimationFrame is unavailable in this environment");
  }

  return window.requestAnimationFrame.bind(window);
};

const getDefaultCancelRaf = (): ((handle: number) => void) => {
  if (typeof window.cancelAnimationFrame !== "function") {
    throw new Error("cancelAnimationFrame is unavailable in this environment");
  }

  return window.cancelAnimationFrame.bind(window);
};

const cloneTheme = (theme: RehoboamTheme): RehoboamTheme => {
  return {
    ...theme,
  };
};

const clampFrameDeltaMs = (deltaMs: number): number => {
  return Math.max(0, Math.min(MAX_FRAME_DELTA_MS, deltaMs));
};

const applyCanvasDimensions = (
  canvas: HTMLCanvasElement,
  size: EngineResizeInput,
  dprCap: number,
  renderer: RehoboamRenderer
): ReturnType<typeof createViewportState> => {
  const viewport = createViewportState({
    width: size.width,
    height: size.height,
    dpr: size.dpr,
    dprCap,
  });

  canvas.width = viewport.pixelWidth;
  canvas.height = viewport.pixelHeight;
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  renderer.resize(viewport);

  return viewport;
};

export const createRehoboamEngine = (
  options: RehoboamEngineOptions
): RehoboamEngine => {
  const context = options.canvas.getContext("2d");

  if (context === null) {
    throw new Error(
      "Could not initialize RehoboamEngine: 2D context unavailable"
    );
  }

  const dprCap = options.dprCap ?? DEFAULT_DPR_CAP;
  const now = createMonotonicNow(options.now ?? getDefaultNow);
  const requestAnimationFrame =
    options.requestAnimationFrame ?? getDefaultRaf();
  const cancelAnimationFrame =
    options.cancelAnimationFrame ?? getDefaultCancelRaf();
  const rendererFactory = options.rendererFactory ?? createRenderer2D;

  let events: readonly WorldEvent[] = [];
  let interaction = createInitialInteractionState();
  let theme = cloneTheme(DEFAULT_THEME);
  let isDestroyed = false;
  let startedAtMs: number | null = null;
  let previousFrameAtMs: number | null = null;

  let viewport = createViewportState({
    width: options.canvas.clientWidth,
    height: options.canvas.clientHeight,
    dpr: window.devicePixelRatio,
    dprCap,
  });

  const renderer = rendererFactory({
    context,
    viewport,
    theme,
  });

  const renderCurrentFrame = (
    timeMs: number,
    frameOptions: Readonly<{ freezeDelta?: boolean }> = {}
  ) => {
    if (isDestroyed) {
      return;
    }

    startedAtMs ??= timeMs;

    const elapsedMs = timeMs - startedAtMs;
    const rawDeltaMs =
      previousFrameAtMs === null ? 0 : timeMs - previousFrameAtMs;
    const deltaMs = frameOptions.freezeDelta
      ? 0
      : clampFrameDeltaMs(rawDeltaMs);
    previousFrameAtMs = timeMs;

    const snapshot = renderer.render({
      viewport,
      events,
      interaction,
      theme,
      elapsedMs,
      timeMs,
      deltaMs,
    });
    options.onRenderSnapshot?.(snapshot);
  };

  const rafLoop = createRafLoop({
    now,
    requestAnimationFrame,
    cancelAnimationFrame,
    onFrame: renderCurrentFrame,
  });

  const renderSnapshot = () => {
    if (rafLoop.isRunning()) {
      return;
    }

    const snapshotTimeMs = previousFrameAtMs ?? now();
    renderCurrentFrame(snapshotTimeMs, { freezeDelta: true });
  };

  const start: RehoboamEngine["start"] = () => {
    if (isDestroyed || rafLoop.isRunning()) {
      return;
    }

    startedAtMs = null;
    previousFrameAtMs = null;
    rafLoop.start();
  };

  const stop: RehoboamEngine["stop"] = () => {
    if (isDestroyed) {
      return;
    }

    rafLoop.stop();
  };

  const resize: RehoboamEngine["resize"] = (size) => {
    if (isDestroyed) {
      return;
    }

    viewport = applyCanvasDimensions(options.canvas, size, dprCap, renderer);
    renderSnapshot();
  };

  const setEvents: RehoboamEngine["setEvents"] = (nextEvents) => {
    if (isDestroyed) {
      return;
    }

    events = [...nextEvents];
    renderSnapshot();
  };

  const setInteraction: RehoboamEngine["setInteraction"] = (
    nextInteraction: InteractionState
  ) => {
    if (isDestroyed) {
      return;
    }

    interaction = cloneInteractionState(nextInteraction);
    renderSnapshot();
  };

  const setTheme: RehoboamEngine["setTheme"] = (nextTheme) => {
    if (isDestroyed) {
      return;
    }

    theme = cloneTheme(nextTheme);
    renderer.setTheme(theme);
    renderSnapshot();
  };

  const destroy: RehoboamEngine["destroy"] = () => {
    if (isDestroyed) {
      return;
    }

    rafLoop.stop();
    renderer.destroy();
    isDestroyed = true;
  };

  return {
    start,
    stop,
    resize,
    setEvents,
    setInteraction,
    setTheme,
    destroy,
  };
};
