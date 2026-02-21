import {
  createViewportState,
  DEFAULT_THEME,
} from "../../../features/rehoboam/engine/defaults";
import { createInitialInteractionState } from "../../../features/rehoboam/engine/input";
import type { RehoboamRendererFrame } from "../../../features/rehoboam/engine/types";
import { createRenderer2D } from "../../../features/rehoboam/render/canvas2d/renderer-2d";
import { createMockCanvasContext } from "./mock-canvas-context";

const createFrame = (elapsedMs: number): RehoboamRendererFrame => {
  const viewport = createViewportState({
    width: 420,
    height: 420,
    dpr: 1,
    dprCap: 2,
  });

  return {
    viewport,
    events: [],
    interaction: createInitialInteractionState(),
    theme: {
      ...DEFAULT_THEME,
      ringSeed: "deterministic-seed",
      ringCount: 8,
    },
    elapsedMs,
    timeMs: elapsedMs,
    deltaMs: elapsedMs,
  };
};

describe("createRenderer2D", () => {
  it("produces deterministic draw commands for fixed seed and time", () => {
    const frame = createFrame(1_000);

    const first = createMockCanvasContext();
    const second = createMockCanvasContext();

    const firstRenderer = createRenderer2D({
      context: first.context,
      viewport: frame.viewport,
      theme: frame.theme,
    });

    const secondRenderer = createRenderer2D({
      context: second.context,
      viewport: frame.viewport,
      theme: frame.theme,
    });

    firstRenderer.render(frame);
    secondRenderer.render(frame);

    expect(first.commands).toStrictEqual(second.commands);
  });

  it("animates ring dash offsets over time", () => {
    const initialFrame = createFrame(0);
    const laterFrame = createFrame(1_200);
    const mock = createMockCanvasContext();

    const renderer = createRenderer2D({
      context: mock.context,
      viewport: initialFrame.viewport,
      theme: initialFrame.theme,
    });

    renderer.render(initialFrame);
    const firstDashOffsets = mock.commands.filter((command) => {
      return command.startsWith("lineDashOffset(");
    });

    mock.commands.length = 0;

    renderer.render(laterFrame);
    const secondDashOffsets = mock.commands.filter((command) => {
      return command.startsWith("lineDashOffset(");
    });

    expect(
      mock.commands.some((command) => command.startsWith("setLineDash("))
    ).toBe(true);
    expect(firstDashOffsets).not.toStrictEqual(secondDashOffsets);
  });
});
