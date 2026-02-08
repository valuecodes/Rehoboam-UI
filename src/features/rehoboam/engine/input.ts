import type { InteractionState } from "./types";

export const createInitialInteractionState = (): InteractionState => {
  return {
    pointer: null,
    isPointerDown: false,
    isDragging: false,
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
