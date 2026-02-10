import type {
  InteractionState,
  RehoboamTheme,
  ViewportState,
  WorldEvent,
} from "../../../engine/types";
import {
  computeAngles,
  DEFAULT_LAYOUT_WINDOW_MS,
  DEFAULT_MAX_VISIBLE_EVENT_COUNT,
} from "../../../layout/compute-angles";
import type { ComputedEventAngle } from "../../../layout/compute-angles";
import { normalizeAngle, polarToCartesian, TAU } from "../../../layout/polar";

const LEADING_TIME_OFFSET_MS = 45 * 60 * 1000;
const SEVERITY_RANK: Readonly<Record<WorldEvent["severity"], number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export type MarkersPassInput = Readonly<{
  context: CanvasRenderingContext2D;
  viewport: ViewportState;
  theme: RehoboamTheme;
  interaction: InteractionState;
  events: readonly WorldEvent[];
  elapsedMs: number;
  entranceScale: number;
}>;

type RankedEventAngle = Readonly<{
  eventAngle: ComputedEventAngle;
  rank: number;
}>;

const getLayoutNowMs = (events: readonly WorldEvent[]): number => {
  if (events.length === 0) {
    return 0;
  }

  const latestTimestampMs = events.reduce((latest, event) => {
    return Math.max(latest, event.timestampMs);
  }, 0);

  return latestTimestampMs + LEADING_TIME_OFFSET_MS;
};

const rankEventAngles = (
  eventAngles: readonly ComputedEventAngle[]
): readonly RankedEventAngle[] => {
  return [...eventAngles]
    .sort((left, right) => {
      const severityDelta =
        SEVERITY_RANK[right.event.severity] -
        SEVERITY_RANK[left.event.severity];

      if (severityDelta !== 0) {
        return severityDelta;
      }

      if (left.event.timestampMs !== right.event.timestampMs) {
        return right.event.timestampMs - left.event.timestampMs;
      }

      return left.event.id.localeCompare(right.event.id);
    })
    .map((eventAngle, rank) => {
      return { eventAngle, rank };
    });
};

const isMarkerSelected = (
  eventAngle: ComputedEventAngle,
  selectedEventId: string | null
): boolean => {
  if (selectedEventId === null) {
    return false;
  }

  return eventAngle.eventIds.includes(selectedEventId);
};

const isMarkerHovered = (
  eventAngle: ComputedEventAngle,
  selectedEventId: string | null,
  hoveredEventId: string | null,
  hoverCandidateEventId: string | null
): boolean => {
  if (selectedEventId !== null) {
    return false;
  }

  const resolvedHoveredEventId = hoveredEventId ?? hoverCandidateEventId;

  if (resolvedHoveredEventId === null) {
    return false;
  }

  return eventAngle.eventIds.includes(resolvedHoveredEventId);
};

const drawMarkerShape = (
  context: CanvasRenderingContext2D,
  viewport: ViewportState,
  theme: RehoboamTheme,
  ranked: RankedEventAngle,
  elapsedMs: number,
  isSelected: boolean,
  isHovered: boolean,
  entranceScale: number
): void => {
  const { eventAngle } = ranked;
  const elapsedSeconds = elapsedMs / 1000;
  const baseRadius = viewport.outerRadius * 0.84;
  const pulse =
    0.9 +
    0.1 *
      Math.sin(
        elapsedSeconds * 5.1 + eventAngle.angleRad + (isSelected ? 0.6 : 0)
      );
  const interactionScale = isSelected ? 1.45 : isHovered ? 1.25 : 1;
  const rankScale =
    ranked.rank === 0 ? 1.26 : ranked.rank < 3 ? 1.15 : ranked.rank < 7 ? 1.06 : 1;
  const visibilityScale = Math.max(0.44, 1 - ranked.rank * 0.03);
  const clusterScale = 1 + Math.min(eventAngle.clusterSize, 6) * 0.08;
  const spikeHeight =
    eventAngle.markerHeight *
    viewport.outerRadius *
    clusterScale *
    interactionScale *
    rankScale *
    visibilityScale *
    entranceScale;
  const widthRad =
    (0.0065 + Math.min(eventAngle.clusterSize, 6) * 0.0023) *
    interactionScale *
    (0.82 + visibilityScale * 0.18) *
    entranceScale;
  const tipRadius = baseRadius + spikeHeight * pulse;
  const leftPoint = polarToCartesian(
    {
      radius: baseRadius,
      angleRad: normalizeAngle(eventAngle.angleRad - widthRad),
    },
    viewport.center
  );
  const rightPoint = polarToCartesian(
    {
      radius: baseRadius,
      angleRad: normalizeAngle(eventAngle.angleRad + widthRad),
    },
    viewport.center
  );
  const leftShoulder = polarToCartesian(
    {
      radius: baseRadius + spikeHeight * 0.46,
      angleRad: normalizeAngle(eventAngle.angleRad - widthRad * 0.34),
    },
    viewport.center
  );
  const rightShoulder = polarToCartesian(
    {
      radius: baseRadius + spikeHeight * 0.46,
      angleRad: normalizeAngle(eventAngle.angleRad + widthRad * 0.34),
    },
    viewport.center
  );
  const tipPoint = polarToCartesian(
    {
      radius: tipRadius,
      angleRad: eventAngle.angleRad,
    },
    viewport.center
  );

  context.save();
  context.fillStyle = theme.ringColor;
  context.globalAlpha =
    (isSelected ? 0.7 : isHovered ? 0.54 : 0.19 + visibilityScale * 0.13) *
    entranceScale;
  context.beginPath();
  context.moveTo(leftPoint.x, leftPoint.y);
  context.lineTo(leftShoulder.x, leftShoulder.y);
  context.lineTo(tipPoint.x, tipPoint.y);
  context.lineTo(rightShoulder.x, rightShoulder.y);
  context.lineTo(rightPoint.x, rightPoint.y);
  context.lineTo(leftPoint.x, leftPoint.y);
  context.fill();
  context.strokeStyle = theme.ringColor;
  context.globalAlpha =
    (isSelected ? 0.42 : isHovered ? 0.3 : 0.09 + visibilityScale * 0.1) *
    entranceScale;
  context.lineWidth = isSelected ? 1.5 : isHovered ? 1.05 : 0.82;
  context.stroke();
  context.restore();
};

const drawAnchorNode = (
  context: CanvasRenderingContext2D,
  viewport: ViewportState,
  theme: RehoboamTheme,
  eventAngle: ComputedEventAngle,
  isSelected: boolean,
  isHovered: boolean,
  entranceScale: number
): void => {
  const baseRadius = viewport.outerRadius * 0.84;
  const nodePoint = polarToCartesian(
    {
      radius: baseRadius,
      angleRad: eventAngle.angleRad,
    },
    viewport.center
  );

  context.save();
  context.fillStyle = theme.ringColor;
  context.globalAlpha =
    (isSelected ? 0.58 : isHovered ? 0.34 : 0.13) * entranceScale;
  context.beginPath();
  context.arc(
    nodePoint.x,
    nodePoint.y,
    (isSelected ? 4.4 : isHovered ? 3.2 : 2) * entranceScale,
    0,
    TAU
  );
  context.fill();
  context.restore();
};

const getMarkerDrawPriority = (isSelected: boolean, isHovered: boolean): number => {
  if (isSelected) {
    return 2;
  }

  if (isHovered) {
    return 1;
  }

  return 0;
};

export const drawMarkersPass = (input: MarkersPassInput): void => {
  const {
    context,
    viewport,
    theme,
    interaction,
    events,
    elapsedMs,
    entranceScale,
  } = input;

  if (events.length === 0) {
    return;
  }

  const eventAngles = computeAngles(events, {
    nowMs: getLayoutNowMs(events),
    windowMs: DEFAULT_LAYOUT_WINDOW_MS,
    maxVisibleCount: DEFAULT_MAX_VISIBLE_EVENT_COUNT,
    distributionMode: "ordered",
  });
  const rankedEventAngles = rankEventAngles(eventAngles);
  if (rankedEventAngles.length === 0) {
    return;
  }

  const resolvedEntranceScale = Math.max(0, Math.min(1, entranceScale));
  const drawQueue = [...rankedEventAngles].sort((left, right) => {
    const leftIsSelected = isMarkerSelected(
      left.eventAngle,
      interaction.selectedEventId
    );
    const leftIsHovered = isMarkerHovered(
      left.eventAngle,
      interaction.selectedEventId,
      interaction.hoveredEventId,
      interaction.hoverCandidateEventId
    );
    const rightIsSelected = isMarkerSelected(
      right.eventAngle,
      interaction.selectedEventId
    );
    const rightIsHovered = isMarkerHovered(
      right.eventAngle,
      interaction.selectedEventId,
      interaction.hoveredEventId,
      interaction.hoverCandidateEventId
    );
    const priorityDelta =
      getMarkerDrawPriority(leftIsSelected, leftIsHovered) -
      getMarkerDrawPriority(rightIsSelected, rightIsHovered);

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return left.rank - right.rank;
  });

  for (const rankedEvent of drawQueue) {
    const isSelected = isMarkerSelected(
      rankedEvent.eventAngle,
      interaction.selectedEventId
    );
    const isHovered = isMarkerHovered(
      rankedEvent.eventAngle,
      interaction.selectedEventId,
      interaction.hoveredEventId,
      interaction.hoverCandidateEventId
    );

    drawMarkerShape(
      context,
      viewport,
      theme,
      rankedEvent,
      elapsedMs,
      isSelected,
      isHovered,
      resolvedEntranceScale
    );
    drawAnchorNode(
      context,
      viewport,
      theme,
      rankedEvent.eventAngle,
      isSelected,
      isHovered,
      resolvedEntranceScale
    );
  }
};
