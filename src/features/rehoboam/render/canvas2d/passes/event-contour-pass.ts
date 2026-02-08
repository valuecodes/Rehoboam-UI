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
import {
  polarToCartesian,
  shortestAngularDistance,
  TAU,
} from "../../../layout/polar";

const LEADING_TIME_OFFSET_MS = 45 * 60 * 1000;
const SEVERITY_RANK: Readonly<Record<WorldEvent["severity"], number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export type EventContourPassInput = Readonly<{
  context: CanvasRenderingContext2D;
  viewport: ViewportState;
  theme: RehoboamTheme;
  interaction: InteractionState;
  events: readonly WorldEvent[];
  elapsedMs: number;
}>;

type ContourSample = Readonly<{
  angleRad: number;
  radius: number;
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

const compareEventAnglesByPriority = (
  left: ComputedEventAngle,
  right: ComputedEventAngle
): number => {
  const severityDelta =
    SEVERITY_RANK[right.event.severity] - SEVERITY_RANK[left.event.severity];

  if (severityDelta !== 0) {
    return severityDelta;
  }

  if (left.event.timestampMs !== right.event.timestampMs) {
    return right.event.timestampMs - left.event.timestampMs;
  }

  return left.event.id.localeCompare(right.event.id);
};

const findEventAngleByEventId = (
  eventAngles: readonly ComputedEventAngle[],
  eventId: string
): ComputedEventAngle | null => {
  for (const eventAngle of eventAngles) {
    if (eventAngle.eventIds.includes(eventId)) {
      return eventAngle;
    }
  }

  return null;
};

const resolveActiveEventAngle = (
  eventAngles: readonly ComputedEventAngle[],
  interaction: InteractionState
): ComputedEventAngle | null => {
  for (const eventId of [
    interaction.selectedEventId,
    interaction.hoveredEventId,
    interaction.hoverCandidateEventId,
  ]) {
    if (eventId === null) {
      continue;
    }

    const matched = findEventAngleByEventId(eventAngles, eventId);

    if (matched !== null) {
      return matched;
    }
  }

  return [...eventAngles].sort(compareEventAnglesByPriority)[0] ?? null;
};

const createContourSamples = (
  viewport: ViewportState,
  elapsedMs: number,
  activeEventAngle: ComputedEventAngle | null
): readonly ContourSample[] => {
  const samples = 360;
  const elapsedSeconds = elapsedMs / 1000;
  const baseRadius = viewport.outerRadius * 0.84;

  return Array.from({ length: samples + 1 }, (_, index) => {
    const angleRad = (index / samples) * TAU;
    const baselineOffset =
      Math.sin(angleRad * 17 + elapsedSeconds * 0.6) *
        viewport.outerRadius *
        0.006 +
      Math.sin(angleRad * 41 - elapsedSeconds * 0.28) *
        viewport.outerRadius *
        0.0038;

    const divergenceOffset =
      activeEventAngle === null
        ? 0
        : (() => {
            const distance = Math.abs(
              shortestAngularDistance(angleRad, activeEventAngle.angleRad)
            );
            const windowRad =
              0.065 + Math.min(activeEventAngle.clusterSize, 5) * 0.016;

            if (distance > windowRad) {
              return 0;
            }

            const envelope = (1 - distance / windowRad) ** 2;
            const pulse =
              0.8 + 0.2 * Math.sin(elapsedSeconds * 4.5 + activeEventAngle.angleRad);
            const clusterScale = 1 + Math.min(activeEventAngle.clusterSize, 6) * 0.12;
            const severityScale =
              activeEventAngle.event.severity === "critical"
                ? 2.9
                : activeEventAngle.event.severity === "high"
                  ? 2.0
                  : 1.4;

            return (
              activeEventAngle.markerHeight *
              viewport.outerRadius *
              envelope *
              pulse *
              clusterScale *
              severityScale
            );
          })();
    const primaryLift =
      activeEventAngle === null
        ? 0
        : (() => {
            const primaryDistance = Math.abs(
              shortestAngularDistance(angleRad, activeEventAngle.angleRad)
            );

            if (primaryDistance > 0.22) {
              return 0;
            }

            const envelope = (1 - primaryDistance / 0.22) ** 2;

            return (
              envelope *
              viewport.outerRadius *
              0.018 *
              (0.85 + 0.15 * Math.sin(elapsedSeconds * 2.8))
            );
          })();

    return {
      angleRad,
      radius: baseRadius + baselineOffset + divergenceOffset + primaryLift,
    };
  });
};

const drawContourStroke = (
  context: CanvasRenderingContext2D,
  viewport: ViewportState,
  samples: readonly ContourSample[],
  alpha: number,
  width: number
): void => {
  context.save();
  context.strokeStyle = "#171717";
  context.globalAlpha = alpha;
  context.lineWidth = width;
  context.setLineDash([]);
  context.lineDashOffset = 0;
  context.beginPath();

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const point = polarToCartesian(
      {
        radius: sample.radius,
        angleRad: sample.angleRad,
      },
      viewport.center
    );

    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  }

  context.stroke();
  context.restore();
};

export const drawEventContourPass = (input: EventContourPassInput): void => {
  const { context, viewport, interaction, events, elapsedMs } = input;

  if (events.length === 0) {
    return;
  }

  const eventAngles = computeAngles(events, {
    nowMs: getLayoutNowMs(events),
    windowMs: DEFAULT_LAYOUT_WINDOW_MS,
    maxVisibleCount: DEFAULT_MAX_VISIBLE_EVENT_COUNT,
    distributionMode: "ordered",
  });
  const activeEventAngle = resolveActiveEventAngle(eventAngles, interaction);
  const contourSamples = createContourSamples(viewport, elapsedMs, activeEventAngle);

  drawContourStroke(context, viewport, contourSamples, 0.56, 2.6);
  drawContourStroke(context, viewport, contourSamples, 0.08, 5.6);
};
