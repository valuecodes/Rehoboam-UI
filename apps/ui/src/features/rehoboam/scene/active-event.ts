import type { DivergenceCalloutTarget } from "~/features/rehoboam/engine/types";
import type { ComputedEventAngle } from "~/features/rehoboam/layout/compute-angles";
import type { InstrumentSize } from "~/features/rehoboam/overlay/callout-geometry";

const compareEventAnglesByTimestamp = (
  left: ComputedEventAngle,
  right: ComputedEventAngle
): number => {
  if (left.event.timestampMs !== right.event.timestampMs) {
    return left.event.timestampMs - right.event.timestampMs;
  }

  return left.event.id.localeCompare(right.event.id);
};

const getMarkerAnchorRadius = (instrumentSize: InstrumentSize): number => {
  const outerRadius =
    Math.min(instrumentSize.width, instrumentSize.height) * 0.46;

  return outerRadius * 0.84;
};

// The auto-cycled event id, falling back to the first cycle entry whenever the
// stored id is unset or no longer part of the cycle.
const resolveAutoEventId = (
  autoCycleEventIds: readonly string[],
  autoEventId: string | null
): string | null => {
  if (autoCycleEventIds.length === 0) {
    return null;
  }

  if (autoEventId === null || !autoCycleEventIds.includes(autoEventId)) {
    return autoCycleEventIds[0];
  }

  return autoEventId;
};

// The event the auto cycle advances to after the currently active one.
const getNextAutoEventId = (
  cycleEventIds: readonly string[],
  currentActiveEventId: string | null
): string | null => {
  if (cycleEventIds.length === 0) {
    return null;
  }

  if (currentActiveEventId === null) {
    return cycleEventIds[0];
  }

  const currentIndex = cycleEventIds.indexOf(currentActiveEventId);

  if (currentIndex < 0) {
    return cycleEventIds[0];
  }

  return cycleEventIds[(currentIndex + 1) % cycleEventIds.length];
};

const resolveActiveEventAngle = (
  eventAngles: readonly ComputedEventAngle[],
  activeEventId: string | null
): ComputedEventAngle | null => {
  if (eventAngles.length === 0) {
    return null;
  }

  if (activeEventId !== null) {
    const matchedEventAngle = eventAngles.find((eventAngle) =>
      eventAngle.eventIds.includes(activeEventId)
    );

    if (matchedEventAngle !== undefined) {
      return matchedEventAngle;
    }
  }

  return [...eventAngles].sort(compareEventAnglesByTimestamp)[0] ?? null;
};

const resolveActiveEventId = (
  eventAngles: readonly ComputedEventAngle[],
  autoEventId: string | null
): string | null => {
  if (autoEventId !== null) {
    const hasAutoEvent = eventAngles.some((eventAngle) =>
      eventAngle.eventIds.includes(autoEventId)
    );

    if (hasAutoEvent) {
      return autoEventId;
    }
  }

  return (
    [...eventAngles].sort(compareEventAnglesByTimestamp)[0]?.event.id ?? null
  );
};

const pickRandomClusterTarget = (
  clusterTargets: readonly DivergenceCalloutTarget[],
  previousClusterTargetId: string | null
): DivergenceCalloutTarget | null => {
  if (clusterTargets.length === 0) {
    return null;
  }

  const candidateTargets =
    previousClusterTargetId === null || clusterTargets.length <= 1
      ? clusterTargets
      : clusterTargets.filter(
          (target) => target.id !== previousClusterTargetId
        );
  const randomIndex = Math.floor(Math.random() * candidateTargets.length);

  return candidateTargets[randomIndex] ?? clusterTargets[0];
};

export {
  getMarkerAnchorRadius,
  getNextAutoEventId,
  pickRandomClusterTarget,
  resolveActiveEventAngle,
  resolveActiveEventId,
  resolveAutoEventId,
};
