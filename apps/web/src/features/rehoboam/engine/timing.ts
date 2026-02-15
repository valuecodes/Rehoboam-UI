export type MonotonicClock = () => number;

export type RafLoop = Readonly<{
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
}>;

export type CreateRafLoopInput = Readonly<{
  now: MonotonicClock;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
  onFrame: (timeMs: number) => void;
}>;

export const createMonotonicNow = (clock: () => number): MonotonicClock => {
  let lastValue = Number.NEGATIVE_INFINITY;

  return () => {
    const sampledValue = clock();

    if (!Number.isFinite(sampledValue)) {
      if (lastValue === Number.NEGATIVE_INFINITY) {
        lastValue = 0;
      }

      return lastValue;
    }

    if (sampledValue < lastValue) {
      return lastValue;
    }

    lastValue = sampledValue;

    return lastValue;
  };
};

export const createRafLoop = (input: CreateRafLoopInput): RafLoop => {
  let isRunning = false;
  let rafHandle: number | null = null;

  const scheduleNextFrame = () => {
    if (!isRunning) {
      return;
    }

    rafHandle = input.requestAnimationFrame(tick);
  };

  const tick: FrameRequestCallback = () => {
    if (!isRunning) {
      return;
    }

    rafHandle = null;
    input.onFrame(input.now());
    scheduleNextFrame();
  };

  const start = () => {
    if (isRunning) {
      return;
    }

    isRunning = true;
    scheduleNextFrame();
  };

  const stop = () => {
    if (!isRunning) {
      return;
    }

    isRunning = false;

    if (rafHandle !== null) {
      input.cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
  };

  return {
    start,
    stop,
    isRunning: () => isRunning,
  };
};
