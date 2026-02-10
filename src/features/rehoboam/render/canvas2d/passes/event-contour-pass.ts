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
const MAX_CONTOUR_TARGETS = 12;
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
  entranceScale: number;
}>;

type ContourSample = Readonly<{
  angleRad: number;
  radius: number;
}>;

type ContourTarget = Readonly<{
  eventAngle: ComputedEventAngle;
  rank: number;
  weight: number;
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

const getInteractionWeight = (
  eventAngle: ComputedEventAngle,
  interaction: InteractionState
): number => {
  if (
    interaction.selectedEventId !== null &&
    eventAngle.eventIds.includes(interaction.selectedEventId)
  ) {
    return 1.55;
  }

  if (
    interaction.hoveredEventId !== null &&
    eventAngle.eventIds.includes(interaction.hoveredEventId)
  ) {
    return 1.36;
  }

  if (
    interaction.hoverCandidateEventId !== null &&
    eventAngle.eventIds.includes(interaction.hoverCandidateEventId)
  ) {
    return 1.2;
  }

  return 1;
};

const resolveContourTargets = (
  eventAngles: readonly ComputedEventAngle[],
  interaction: InteractionState
): readonly ContourTarget[] => {
  return [...eventAngles]
    .sort(compareEventAnglesByPriority)
    .slice(0, MAX_CONTOUR_TARGETS)
    .map((eventAngle, rank) => {
      const rankWeight = Math.max(0.34, 1 - rank * 0.1);

      return {
        eventAngle,
        rank,
        weight: rankWeight * getInteractionWeight(eventAngle, interaction),
      };
    });
};

const getSeverityScale = (eventAngle: ComputedEventAngle): number => {
  const { severity } = eventAngle.event;

  if (severity === "critical") {
    return 2.85;
  }

  if (severity === "high") {
    return 2.2;
  }

  if (severity === "medium") {
    return 1.68;
  }

  return 1.32;
};

const createContourSamples = (
  viewport: ViewportState,
  elapsedMs: number,
  contourTargets: readonly ContourTarget[],
  entranceScale: number
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

    const divergenceOffset = contourTargets.reduce((sum, target) => {
      const distance = Math.abs(
        shortestAngularDistance(angleRad, target.eventAngle.angleRad)
      );
      const windowRad =
        0.053 +
        Math.min(target.eventAngle.clusterSize, 6) * 0.014 +
        target.weight * 0.009;

      if (distance > windowRad) {
        return sum;
      }

      const envelope = (1 - distance / windowRad) ** 2;
      const pulse =
        0.78 +
        0.22 *
          Math.sin(
            elapsedSeconds * (4.2 + target.rank * 0.2) +
              target.eventAngle.angleRad * 1.4 +
              target.rank * 0.36
          );
      const clusterScale = 1 + Math.min(target.eventAngle.clusterSize, 6) * 0.12;
      const amplitude =
        target.eventAngle.markerHeight *
        viewport.outerRadius *
        0.66 *
        target.weight *
        getSeverityScale(target.eventAngle);

      return sum + amplitude * envelope * pulse * clusterScale * entranceScale;
    }, 0);
    const distributedLift = contourTargets.reduce((sum, target) => {
      const distance = Math.abs(
        shortestAngularDistance(angleRad, target.eventAngle.angleRad)
      );

      if (distance > 0.2) {
        return sum;
      }

      const envelope = (1 - distance / 0.2) ** 2;
      const pulse =
        0.82 +
        0.18 *
          Math.sin(
            elapsedSeconds * (2.6 + target.rank * 0.08) -
              target.eventAngle.angleRad * 0.7
          );

      return (
        sum +
        envelope *
          viewport.outerRadius *
          0.009 *
          target.weight *
          pulse *
          entranceScale
      );
    }, 0);

    return {
      angleRad,
      radius: baseRadius + baselineOffset + divergenceOffset + distributedLift,
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
  const { context, viewport, interaction, events, elapsedMs, entranceScale } =
    input;

  if (events.length === 0) {
    return;
  }

  const eventAngles = computeAngles(events, {
    nowMs: getLayoutNowMs(events),
    windowMs: DEFAULT_LAYOUT_WINDOW_MS,
    maxVisibleCount: DEFAULT_MAX_VISIBLE_EVENT_COUNT,
    distributionMode: "ordered",
  });
  const contourTargets = resolveContourTargets(eventAngles, interaction);

  if (contourTargets.length === 0) {
    return;
  }

  const resolvedEntranceScale = Math.max(0, Math.min(1, entranceScale));
  const contourSamples = createContourSamples(
    viewport,
    elapsedMs,
    contourTargets,
    resolvedEntranceScale
  );

  drawContourStroke(context, viewport, contourSamples, 0.56, 2.6);
  drawContourStroke(context, viewport, contourSamples, 0.08, 5.6);
};
