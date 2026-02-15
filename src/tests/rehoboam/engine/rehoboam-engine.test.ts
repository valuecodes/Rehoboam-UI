import { DEFAULT_THEME } from "../../../features/rehoboam/engine/defaults";
import { createInitialInteractionState } from "../../../features/rehoboam/engine/input";
import { createRehoboamEngine } from "../../../features/rehoboam/engine/rehoboam-engine";
import type {
  RehoboamRenderer,
  RehoboamRendererFrame,
  RehoboamRendererFactory,
  WorldEvent,
} from "../../../features/rehoboam/engine/types";
import { createMockCanvasContext } from "../render/mock-canvas-context";

const createRafHarness = () => {
  let nextHandle = 1;
  const pendingFrames = new Map<number, FrameRequestCallback>();

  const requestAnimationFrame = vi.fn(
    (callback: FrameRequestCallback): number => {
      const handle = nextHandle;
      nextHandle += 1;
      pendingFrames.set(handle, callback);

      return handle;
    }
  );

  const cancelAnimationFrame = vi.fn((handle: number): void => {
    pendingFrames.delete(handle);
  });

  const runSingleFrame = (timestampMs: number): void => {
    const iteratorResult = pendingFrames.entries().next();

    if (iteratorResult.done) {
      return;
    }

    const [handle, callback] = iteratorResult.value;
    pendingFrames.delete(handle);
    callback(timestampMs);
  };

  return {
    requestAnimationFrame,
    cancelAnimationFrame,
    runSingleFrame,
    pendingCount: () => pendingFrames.size,
  };
};

const createTestCanvas = (
  context: CanvasRenderingContext2D
): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  vi.spyOn(canvas, "getContext").mockReturnValue(context);
  Object.defineProperty(canvas, "clientWidth", {
    value: 320,
    configurable: true,
  });
  Object.defineProperty(canvas, "clientHeight", {
    value: 320,
    configurable: true,
  });

  return canvas;
};

const createFrameCaptureRendererFactory = (
  capturedFrames: RehoboamRendererFrame[]
): RehoboamRendererFactory => {
  return (): RehoboamRenderer => {
    return {
      resize: vi.fn(),
      setTheme: vi.fn(),
      render: (frame) => {
        capturedFrames.push(frame);

        return {
          timeMs: frame.timeMs,
          divergenceCalloutTargets: [],
        };
      },
      destroy: vi.fn(),
    };
  };
};

describe("createRehoboamEngine", () => {
  it("starts and stops a single RAF loop without leaks", () => {
    const raf = createRafHarness();
    const mockContext = createMockCanvasContext();
    const canvas = createTestCanvas(mockContext.context);
    let nowMs = 0;

    const engine = createRehoboamEngine({
      canvas,
      now: () => {
        nowMs += 16;

        return nowMs;
      },
      requestAnimationFrame: raf.requestAnimationFrame,
      cancelAnimationFrame: raf.cancelAnimationFrame,
    });

    engine.resize({ width: 320, height: 320, dpr: 1 });

    expect(raf.pendingCount()).toBe(0);

    engine.start();
    engine.start();

    expect(raf.pendingCount()).toBe(1);
    expect(raf.requestAnimationFrame).toHaveBeenCalledTimes(1);

    raf.runSingleFrame(16);

    expect(raf.pendingCount()).toBe(1);
    expect(raf.requestAnimationFrame).toHaveBeenCalledTimes(2);

    engine.stop();

    expect(raf.pendingCount()).toBe(0);
    expect(raf.cancelAnimationFrame).toHaveBeenCalledTimes(1);

    raf.runSingleFrame(32);

    expect(raf.pendingCount()).toBe(0);
    expect(mockContext.commands.length).toBeGreaterThan(0);

    engine.destroy();
  });

  it("applies DPR capping on resize and accepts state updates", () => {
    const raf = createRafHarness();
    const mockContext = createMockCanvasContext();
    const canvas = createTestCanvas(mockContext.context);

    const engine = createRehoboamEngine({
      canvas,
      dprCap: 2,
      now: () => 100,
      requestAnimationFrame: raf.requestAnimationFrame,
      cancelAnimationFrame: raf.cancelAnimationFrame,
    });

    engine.resize({
      width: 333.25,
      height: 222.75,
      dpr: 4,
    });

    expect(canvas.width).toBe(Math.round(333.25 * 2));
    expect(canvas.height).toBe(Math.round(222.75 * 2));
    expect(canvas.style.width).toBe("333.25px");
    expect(canvas.style.height).toBe("222.75px");

    const events: readonly WorldEvent[] = [
      {
        id: "event-1",
        title: "Deterministic event",
        timestampMs: 1_718_980_000_000,
        severity: "high",
        category: "system",
      },
    ];

    engine.setEvents(events);
    engine.setInteraction({
      ...createInitialInteractionState(),
      hoveredEventId: "event-1",
    });
    engine.setTheme({
      ...DEFAULT_THEME,
      ringCount: 6,
      ringSeed: "custom-seed",
    });

    expect(
      mockContext.commands.some((command) =>
        command.startsWith("setTransform(")
      )
    ).toBe(true);

    engine.destroy();

    expect(() => {
      engine.setEvents(events);
      engine.stop();
      engine.start();
      engine.resize({ width: 100, height: 100, dpr: 1 });
      engine.destroy();
    }).not.toThrow();
  });

  it("clamps large frame deltas to prevent animation jumps", () => {
    const raf = createRafHarness();
    const mockContext = createMockCanvasContext();
    const canvas = createTestCanvas(mockContext.context);
    const capturedFrames: RehoboamRendererFrame[] = [];
    const nowSequence = [0, 1_000];
    let nowIndex = 0;

    const engine = createRehoboamEngine({
      canvas,
      now: () => {
        const sampledNowMs =
          nowSequence[nowIndex] ?? nowSequence[nowSequence.length - 1];
        nowIndex += 1;

        return sampledNowMs;
      },
      requestAnimationFrame: raf.requestAnimationFrame,
      cancelAnimationFrame: raf.cancelAnimationFrame,
      rendererFactory: createFrameCaptureRendererFactory(capturedFrames),
    });

    engine.start();
    raf.runSingleFrame(0);
    raf.runSingleFrame(16);

    expect(capturedFrames).toHaveLength(2);
    expect(capturedFrames[0].deltaMs).toBe(0);
    expect(capturedFrames[1].deltaMs).toBe(100);
  });

  it("renders stopped snapshots as still frames", () => {
    const raf = createRafHarness();
    const mockContext = createMockCanvasContext();
    const canvas = createTestCanvas(mockContext.context);
    const capturedFrames: RehoboamRendererFrame[] = [];
    const nowSequence = [10, 20_000];
    let nowIndex = 0;

    const engine = createRehoboamEngine({
      canvas,
      now: () => {
        const sampledNowMs =
          nowSequence[nowIndex] ?? nowSequence[nowSequence.length - 1];
        nowIndex += 1;

        return sampledNowMs;
      },
      requestAnimationFrame: raf.requestAnimationFrame,
      cancelAnimationFrame: raf.cancelAnimationFrame,
      rendererFactory: createFrameCaptureRendererFactory(capturedFrames),
    });

    engine.start();
    raf.runSingleFrame(16);
    engine.stop();

    const frameCountBeforeSnapshot = capturedFrames.length;

    engine.setTheme({
      ...DEFAULT_THEME,
      ringCount: DEFAULT_THEME.ringCount + 1,
    });

    expect(capturedFrames).toHaveLength(frameCountBeforeSnapshot + 1);

    const latestFrame = capturedFrames[capturedFrames.length - 1];
    const firstFrame = capturedFrames[0];

    expect(latestFrame.timeMs).toBe(firstFrame.timeMs);
    expect(latestFrame.elapsedMs).toBe(firstFrame.elapsedMs);
    expect(latestFrame.deltaMs).toBe(0);
  });
});
