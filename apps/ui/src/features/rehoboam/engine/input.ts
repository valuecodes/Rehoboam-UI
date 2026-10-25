import type { CartesianCoordinate } from "~/features/rehoboam/layout/polar";

import type { InteractionState } from "./types";

const DEFAULT_HOVER_DWELL_MS = 120;
const MIN_MARKER_HIT_RADIUS_PX = 24;

type PointerInput = Readonly<{
  position: CartesianCoordinate;
  isPrimary: boolean;
}>;

type MarkerHitTarget = Readonly<{
  eventId: string;
  eventIds: readonly string[];
  position: CartesianCoordinate;
  hitRadiusPx: number;
}>;

type PointerMoveUpdateInput = Readonly<{
  interaction: InteractionState;
  pointer: PointerInput;
  markerEventId: string | null;
  timeMs: number;
  hoverDwellMs?: number;
}>;

type HoverDwellTickInput = Readonly<{
  interaction: InteractionState;
  timeMs: number;
  hoverDwellMs?: number;
}>;

type PointerClickUpdateInput = Readonly<{
  interaction: InteractionState;
  markerEventId: string | null;
}>;

const getDistance = (
  left: CartesianCoordinate,
  right: CartesianCoordinate
): number => Math.hypot(left.x - right.x, left.y - right.y);

const resolveHoverByDwell = (
  interaction: InteractionState,
  timeMs: number,
  hoverDwellMs: number
): Pick<
  InteractionState,
  "hoverCandidateEventId" | "hoverStartedAtMs" | "hoveredEventId"
> => {
  const candidateEventId = interaction.hoverCandidateEventId;
  const hoverStartedAtMs = interaction.hoverStartedAtMs;

  if (
    candidateEventId === null ||
    hoverStartedAtMs === null ||
    interaction.selectedEventId !== null
  ) {
    return {
      hoverCandidateEventId: null,
      hoverStartedAtMs: null,
      hoveredEventId: null,
    };
  }

  const dwellElapsedMs = timeMs - hoverStartedAtMs;

  if (dwellElapsedMs < hoverDwellMs) {
    return {
      hoverCandidateEventId: candidateEventId,
      hoverStartedAtMs,
      hoveredEventId: interaction.hoveredEventId,
    };
  }

  return {
    hoverCandidateEventId: candidateEventId,
    hoverStartedAtMs,
    hoveredEventId: candidateEventId,
  };
};

const withPointerState = (
  interaction: InteractionState,
  pointer: PointerInput
): InteractionState => ({
  ...interaction,
  pointer: {
    position: {
      ...pointer.position,
    },
    isPrimary: pointer.isPrimary,
  },
});

const createInitialInteractionState = (): InteractionState => ({
  pointer: null,
  isPointerDown: false,
  isDragging: false,
  hoverCandidateEventId: null,
  hoveredEventId: null,
  selectedEventId: null,
  hoverStartedAtMs: null,
});

const cloneInteractionState = (
  interaction: InteractionState
): InteractionState => ({
  ...interaction,
  pointer:
    interaction.pointer === null
      ? null
      : {
          ...interaction.pointer,
          position: {
            ...interaction.pointer.position,
          },
        },
});

const pickMarkerHitTarget = (
  pointerPosition: CartesianCoordinate,
  markers: readonly MarkerHitTarget[]
): MarkerHitTarget | null => {
  let nearestTarget: MarkerHitTarget | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const marker of markers) {
    const hitRadiusPx = Math.max(marker.hitRadiusPx, MIN_MARKER_HIT_RADIUS_PX);
    const distance = getDistance(pointerPosition, marker.position);

    if (distance > hitRadiusPx || distance >= nearestDistance) {
      continue;
    }

    nearestDistance = distance;
    nearestTarget = marker;
  }

  return nearestTarget;
};

const updateInteractionForPointerMove = (
  input: PointerMoveUpdateInput
): InteractionState => {
  const hoverDwellMs = Math.max(
    1,
    Math.trunc(input.hoverDwellMs ?? DEFAULT_HOVER_DWELL_MS)
  );
  const nextInteraction = withPointerState(input.interaction, input.pointer);

  if (nextInteraction.selectedEventId !== null) {
    return {
      ...nextInteraction,
      hoverCandidateEventId: null,
      hoveredEventId: null,
      hoverStartedAtMs: null,
    };
  }

  if (input.markerEventId === null) {
    return {
      ...nextInteraction,
      hoverCandidateEventId: null,
      hoveredEventId: null,
      hoverStartedAtMs: null,
    };
  }

  if (input.markerEventId !== nextInteraction.hoverCandidateEventId) {
    return {
      ...nextInteraction,
      hoverCandidateEventId: input.markerEventId,
      hoveredEventId: null,
      hoverStartedAtMs: input.timeMs,
    };
  }

  const hoverState = resolveHoverByDwell(
    nextInteraction,
    input.timeMs,
    hoverDwellMs
  );

  return {
    ...nextInteraction,
    ...hoverState,
  };
};

const applyHoverDwellTick = (input: HoverDwellTickInput): InteractionState => {
  const hoverDwellMs = Math.max(
    1,
    Math.trunc(input.hoverDwellMs ?? DEFAULT_HOVER_DWELL_MS)
  );
  const hoverState = resolveHoverByDwell(
    input.interaction,
    input.timeMs,
    hoverDwellMs
  );

  return {
    ...input.interaction,
    ...hoverState,
  };
};

const updateInteractionForPointerLeave = (
  interaction: InteractionState
): InteractionState => ({
  ...interaction,
  pointer: null,
  isPointerDown: false,
  isDragging: false,
  hoverCandidateEventId: null,
  hoveredEventId: null,
  hoverStartedAtMs: null,
});

const updateInteractionForClick = (
  input: PointerClickUpdateInput
): InteractionState => {
  if (input.markerEventId === null) {
    return input.interaction;
  }

  return {
    ...input.interaction,
    selectedEventId: input.markerEventId,
    hoverCandidateEventId: null,
    hoveredEventId: null,
    hoverStartedAtMs: null,
  };
};

const clearInteractionSelection = (
  interaction: InteractionState
): InteractionState => ({
  ...interaction,
  selectedEventId: null,
  hoverCandidateEventId: null,
  hoveredEventId: null,
  hoverStartedAtMs: null,
});

export {
  applyHoverDwellTick,
  clearInteractionSelection,
  cloneInteractionState,
  createInitialInteractionState,
  DEFAULT_HOVER_DWELL_MS,
  pickMarkerHitTarget,
  updateInteractionForClick,
  updateInteractionForPointerLeave,
  updateInteractionForPointerMove,
};
export type { MarkerHitTarget };
