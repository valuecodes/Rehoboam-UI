import type { CartesianCoordinate } from "../layout/polar";
import type { InteractionState } from "./types";

export const DEFAULT_HOVER_DWELL_MS = 120;
export const MIN_MARKER_HIT_RADIUS_PX = 24;

export type PointerInput = Readonly<{
  position: CartesianCoordinate;
  isPrimary: boolean;
}>;

export type MarkerHitTarget = Readonly<{
  eventId: string;
  eventIds: readonly string[];
  position: CartesianCoordinate;
  hitRadiusPx: number;
}>;

export type PointerMoveUpdateInput = Readonly<{
  interaction: InteractionState;
  pointer: PointerInput;
  markerEventId: string | null;
  timeMs: number;
  hoverDwellMs?: number;
}>;

export type HoverDwellTickInput = Readonly<{
  interaction: InteractionState;
  timeMs: number;
  hoverDwellMs?: number;
}>;

export type PointerPressUpdateInput = Readonly<{
  interaction: InteractionState;
  pointer: PointerInput;
}>;

export type PointerClickUpdateInput = Readonly<{
  interaction: InteractionState;
  markerEventId: string | null;
}>;

const getDistance = (
  left: CartesianCoordinate,
  right: CartesianCoordinate
): number => {
  return Math.hypot(left.x - right.x, left.y - right.y);
};

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
): InteractionState => {
  return {
    ...interaction,
    pointer: {
      position: {
        ...pointer.position,
      },
      isPrimary: pointer.isPrimary,
    },
  };
};

export const createInitialInteractionState = (): InteractionState => {
  return {
    pointer: null,
    isPointerDown: false,
    isDragging: false,
    hoverCandidateEventId: null,
    hoveredEventId: null,
    selectedEventId: null,
    hoverStartedAtMs: null,
  };
};

export const cloneInteractionState = (
  interaction: InteractionState
): InteractionState => {
  return {
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
  };
};

export const pickMarkerHitTarget = (
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

export const updateInteractionForPointerMove = (
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

export const applyHoverDwellTick = (
  input: HoverDwellTickInput
): InteractionState => {
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

export const updateInteractionForPointerDown = (
  input: PointerPressUpdateInput
): InteractionState => {
  return {
    ...withPointerState(input.interaction, input.pointer),
    isPointerDown: true,
    isDragging: false,
  };
};

export const updateInteractionForPointerUp = (
  input: PointerPressUpdateInput
): InteractionState => {
  return {
    ...withPointerState(input.interaction, input.pointer),
    isPointerDown: false,
    isDragging: false,
  };
};

export const updateInteractionForPointerLeave = (
  interaction: InteractionState
): InteractionState => {
  return {
    ...interaction,
    pointer: null,
    isPointerDown: false,
    isDragging: false,
    hoverCandidateEventId: null,
    hoveredEventId: null,
    hoverStartedAtMs: null,
  };
};

export const updateInteractionForClick = (
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

export const clearInteractionSelection = (
  interaction: InteractionState
): InteractionState => {
  return {
    ...interaction,
    selectedEventId: null,
    hoverCandidateEventId: null,
    hoveredEventId: null,
    hoverStartedAtMs: null,
  };
};
