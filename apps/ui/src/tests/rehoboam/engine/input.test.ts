import {
  applyHoverDwellTick,
  clearInteractionSelection,
  createInitialInteractionState,
  DEFAULT_HOVER_DWELL_MS,
  pickMarkerHitTarget,
  updateInteractionForClick,
  updateInteractionForPointerLeave,
  updateInteractionForPointerMove,
} from "../../../features/rehoboam/engine/input";
import type { MarkerHitTarget } from "../../../features/rehoboam/engine/input";

const MARKERS: readonly MarkerHitTarget[] = [
  {
    eventId: "event-alpha",
    eventIds: ["event-alpha"],
    position: { x: 100, y: 100 },
    hitRadiusPx: 8,
  },
  {
    eventId: "event-beta",
    eventIds: ["event-beta"],
    position: { x: 180, y: 100 },
    hitRadiusPx: 24,
  },
];

describe("interaction input state", () => {
  it("starts with empty hover and selection state", () => {
    expect(createInitialInteractionState()).toStrictEqual({
      pointer: null,
      isPointerDown: false,
      isDragging: false,
      hoverCandidateEventId: null,
      hoveredEventId: null,
      selectedEventId: null,
      hoverStartedAtMs: null,
    });
  });

  it("picks nearest marker and enforces a practical minimum hit radius", () => {
    expect(
      pickMarkerHitTarget(
        {
          x: 120,
          y: 100,
        },
        MARKERS
      )
    ).toMatchObject({
      eventId: "event-alpha",
    });

    expect(
      pickMarkerHitTarget(
        {
          x: 180,
          y: 127,
        },
        MARKERS
      )
    ).toBeNull();
  });

  it("activates hoveredEventId only after dwell threshold", () => {
    const initial = createInitialInteractionState();

    const moved = updateInteractionForPointerMove({
      interaction: initial,
      pointer: {
        position: { x: 100, y: 100 },
        isPrimary: true,
      },
      markerEventId: "event-alpha",
      timeMs: 1_000,
      hoverDwellMs: DEFAULT_HOVER_DWELL_MS,
    });

    expect(moved.hoverCandidateEventId).toBe("event-alpha");
    expect(moved.hoveredEventId).toBeNull();

    const beforeDwell = applyHoverDwellTick({
      interaction: moved,
      timeMs: 1_000 + DEFAULT_HOVER_DWELL_MS - 1,
      hoverDwellMs: DEFAULT_HOVER_DWELL_MS,
    });

    expect(beforeDwell.hoveredEventId).toBeNull();

    const afterDwell = applyHoverDwellTick({
      interaction: moved,
      timeMs: 1_000 + DEFAULT_HOVER_DWELL_MS,
      hoverDwellMs: DEFAULT_HOVER_DWELL_MS,
    });

    expect(afterDwell.hoveredEventId).toBe("event-alpha");
  });

  it("locks selection on click and ignores hover transitions while selected", () => {
    const initial = createInitialInteractionState();

    const selected = updateInteractionForClick({
      interaction: initial,
      markerEventId: "event-alpha",
    });

    expect(selected.selectedEventId).toBe("event-alpha");

    const movedWhileSelected = updateInteractionForPointerMove({
      interaction: selected,
      pointer: {
        position: { x: 180, y: 100 },
        isPrimary: true,
      },
      markerEventId: "event-beta",
      timeMs: 3_000,
      hoverDwellMs: DEFAULT_HOVER_DWELL_MS,
    });

    expect(movedWhileSelected.selectedEventId).toBe("event-alpha");
    expect(movedWhileSelected.hoverCandidateEventId).toBeNull();
    expect(movedWhileSelected.hoveredEventId).toBeNull();

    const afterLeave = updateInteractionForPointerLeave(movedWhileSelected);

    expect(afterLeave.selectedEventId).toBe("event-alpha");
  });

  it("clears locked selection on escape semantics", () => {
    const initial = createInitialInteractionState();
    const selected = updateInteractionForClick({
      interaction: initial,
      markerEventId: "event-alpha",
    });

    const cleared = clearInteractionSelection(selected);

    expect(cleared.selectedEventId).toBeNull();
    expect(cleared.hoverCandidateEventId).toBeNull();
    expect(cleared.hoveredEventId).toBeNull();
  });
});
