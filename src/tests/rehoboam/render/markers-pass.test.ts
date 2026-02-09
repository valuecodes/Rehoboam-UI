import {
  createViewportState,
  DEFAULT_THEME,
} from "../../../features/rehoboam/engine/defaults";
import { createInitialInteractionState } from "../../../features/rehoboam/engine/input";
import type { WorldEvent } from "../../../features/rehoboam/engine/types";
import { drawMarkersPass } from "../../../features/rehoboam/render/canvas2d/passes/markers-pass";
import { createMockCanvasContext } from "./mock-canvas-context";

const EVENTS: readonly WorldEvent[] = [
  {
    id: "event-1",
    title: "Localized anomaly",
    timestampMs: 1_718_980_000_000,
    severity: "critical",
    category: "security",
  },
  {
    id: "event-2",
    title: "Economic shift",
    timestampMs: 1_718_978_000_000,
    severity: "high",
    category: "economy",
  },
  {
    id: "event-3",
    title: "Atmospheric change",
    timestampMs: 1_718_972_000_000,
    severity: "medium",
    category: "climate",
  },
];

const VIEWPORT = createViewportState({
  width: 480,
  height: 480,
  dpr: 1,
  dprCap: 2,
});

describe("drawMarkersPass", () => {
  it("is deterministic for fixed input", () => {
    const first = createMockCanvasContext();
    const second = createMockCanvasContext();
    const interaction = createInitialInteractionState();

    drawMarkersPass({
      context: first.context,
      viewport: VIEWPORT,
      theme: DEFAULT_THEME,
      interaction,
      events: EVENTS,
      elapsedMs: 1_000,
      entranceScale: 1,
    });

    drawMarkersPass({
      context: second.context,
      viewport: VIEWPORT,
      theme: DEFAULT_THEME,
      interaction,
      events: EVENTS,
      elapsedMs: 1_000,
      entranceScale: 1,
    });

    expect(first.commands).toStrictEqual(second.commands);
  });

  it("changes marker emphasis when an event is selected", () => {
    const normal = createMockCanvasContext();
    const selected = createMockCanvasContext();

    drawMarkersPass({
      context: normal.context,
      viewport: VIEWPORT,
      theme: DEFAULT_THEME,
      interaction: createInitialInteractionState(),
      events: EVENTS,
      elapsedMs: 1_000,
      entranceScale: 1,
    });

    drawMarkersPass({
      context: selected.context,
      viewport: VIEWPORT,
      theme: DEFAULT_THEME,
      interaction: {
        ...createInitialInteractionState(),
        selectedEventId: "event-1",
      },
      events: EVENTS,
      elapsedMs: 1_000,
      entranceScale: 1,
    });

    expect(normal.commands).not.toStrictEqual(selected.commands);
  });
});
