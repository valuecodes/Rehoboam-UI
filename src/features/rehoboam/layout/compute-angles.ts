import type { WorldEvent, WorldEventSeverity } from "../engine/types";
import { normalizeAngle, TAU } from "./polar";

export const DEFAULT_LAYOUT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_MAX_VISIBLE_EVENT_COUNT = 48;
export const DEFAULT_MIN_TIME_SPAN_RATIO_FOR_TIME_MAPPING = 0.35;

export const SEVERITY_MARKER_HEIGHT: Readonly<
  Record<WorldEventSeverity, number>
> = {
  low: 0.01,
  medium: 0.02,
  high: 0.032,
  critical: 0.045,
};

const SEVERITY_RANK: Readonly<Record<WorldEventSeverity, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export type TimeWindowAngleOptions = Readonly<{
  nowMs: number;
  windowMs?: number;
}>;

export type EventAngleDistributionMode =
  | "adaptive"
  | "time-window"
  | "ordered";

export type ComputeAnglesOptions = TimeWindowAngleOptions &
  Readonly<{
    maxVisibleCount?: number;
    distributionMode?: EventAngleDistributionMode;
    minTimeSpanRatioForTimeMapping?: number;
  }>;

export type ComputedEventAngle = Readonly<{
  event: WorldEvent;
  eventIds: readonly string[];
  angleRad: number;
  markerHeight: number;
  clusterSize: number;
  isCluster: boolean;
}>;

type ResolvedEventMarker = Readonly<{
  event: WorldEvent;
  angleRad: number;
  markerHeight: number;
}>;

const compareStrings = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
};

const sanitizeWindowMs = (windowMs: number | undefined): number => {
  return Math.max(1, Math.trunc(windowMs ?? DEFAULT_LAYOUT_WINDOW_MS));
};

const sanitizeMaxVisibleCount = (
  maxVisibleCount: number | undefined
): number => {
  return Math.max(
    1,
    Math.trunc(maxVisibleCount ?? DEFAULT_MAX_VISIBLE_EVENT_COUNT)
  );
};

const sanitizeDistributionMode = (
  distributionMode: EventAngleDistributionMode | undefined
): EventAngleDistributionMode => {
  return distributionMode ?? "adaptive";
};

const sanitizeMinTimeSpanRatio = (
  minTimeSpanRatioForTimeMapping: number | undefined
): number => {
  if (
    minTimeSpanRatioForTimeMapping === undefined ||
    !Number.isFinite(minTimeSpanRatioForTimeMapping)
  ) {
    return DEFAULT_MIN_TIME_SPAN_RATIO_FOR_TIME_MAPPING;
  }

  return Math.min(1, Math.max(0, minTimeSpanRatioForTimeMapping));
};

const compareEventsForLayout = (
  left: WorldEvent,
  right: WorldEvent
): number => {
  if (left.timestampMs !== right.timestampMs) {
    return left.timestampMs - right.timestampMs;
  }

  const idComparison = compareStrings(left.id, right.id);

  if (idComparison !== 0) {
    return idComparison;
  }

  return compareStrings(left.title, right.title);
};

const compareMarkers = (
  left: ResolvedEventMarker,
  right: ResolvedEventMarker
): number => {
  if (left.angleRad !== right.angleRad) {
    return left.angleRad - right.angleRad;
  }

  return compareStrings(left.event.id, right.event.id);
};

const compareForRepresentative = (
  left: ResolvedEventMarker,
  right: ResolvedEventMarker
): number => {
  const severityDelta =
    SEVERITY_RANK[right.event.severity] - SEVERITY_RANK[left.event.severity];

  if (severityDelta !== 0) {
    return severityDelta;
  }

  if (left.event.timestampMs !== right.event.timestampMs) {
    return right.event.timestampMs - left.event.timestampMs;
  }

  return compareStrings(left.event.id, right.event.id);
};

export const getMarkerHeightForSeverity = (
  severity: WorldEventSeverity
): number => {
  return SEVERITY_MARKER_HEIGHT[severity];
};

export const getClusteringThresholdRad = (maxVisibleCount: number): number => {
  const sanitizedMaxVisibleCount = sanitizeMaxVisibleCount(maxVisibleCount);

  return TAU / sanitizedMaxVisibleCount;
};

export const mapTimestampToTimeWindowAngle = (
  timestampMs: number,
  options: TimeWindowAngleOptions
): number => {
  const windowMs = sanitizeWindowMs(options.windowMs);
  const windowStartMs = options.nowMs - windowMs;
  const normalizedTimePosition = (timestampMs - windowStartMs) / windowMs;
  const clampedTimePosition = Math.min(1, Math.max(0, normalizedTimePosition));
  const boundedTimePosition =
    clampedTimePosition >= 1 ? 1 - Number.EPSILON : clampedTimePosition;

  return normalizeAngle(boundedTimePosition * TAU);
};

const getTimestampSpanMs = (events: readonly WorldEvent[]): number => {
  if (events.length <= 1) {
    return 0;
  }

  let minTimestampMs = events[0].timestampMs;
  let maxTimestampMs = events[0].timestampMs;

  for (const event of events) {
    minTimestampMs = Math.min(minTimestampMs, event.timestampMs);
    maxTimestampMs = Math.max(maxTimestampMs, event.timestampMs);
  }

  return maxTimestampMs - minTimestampMs;
};

const resolveDistributionMode = (
  sortedEvents: readonly WorldEvent[],
  options: ComputeAnglesOptions
): Exclude<EventAngleDistributionMode, "adaptive"> => {
  const distributionMode = sanitizeDistributionMode(options.distributionMode);

  if (distributionMode === "ordered" || distributionMode === "time-window") {
    return distributionMode;
  }

  if (sortedEvents.length <= 1) {
    return "time-window";
  }

  const windowMs = sanitizeWindowMs(options.windowMs);
  const timestampSpanMs = getTimestampSpanMs(sortedEvents);
  const timeSpanRatio = timestampSpanMs / windowMs;
  const minimumTimeSpanRatio = sanitizeMinTimeSpanRatio(
    options.minTimeSpanRatioForTimeMapping
  );

  if (timeSpanRatio < minimumTimeSpanRatio) {
    return "ordered";
  }

  return "time-window";
};

const mapOrderedIndexToAngle = (
  index: number,
  totalCount: number,
  nowMs: number
): number => {
  if (totalCount <= 1) {
    return mapTimestampToTimeWindowAngle(nowMs, {
      nowMs,
      windowMs: DEFAULT_LAYOUT_WINDOW_MS,
    });
  }

  const position = index / totalCount;

  return normalizeAngle(position * TAU);
};

const resolveEventMarkers = (
  events: readonly WorldEvent[],
  options: ComputeAnglesOptions
): readonly ResolvedEventMarker[] => {
  const sortedEvents = [...events].sort(compareEventsForLayout);
  const distributionMode = resolveDistributionMode(sortedEvents, options);

  return sortedEvents.map((event, index) => {
    const angleRad =
      distributionMode === "ordered"
        ? mapOrderedIndexToAngle(index, sortedEvents.length, options.nowMs)
        : mapTimestampToTimeWindowAngle(event.timestampMs, options);

    return {
      event,
      angleRad,
      markerHeight: getMarkerHeightForSeverity(event.severity),
    };
  });
};

const toComputedMarker = (marker: ResolvedEventMarker): ComputedEventAngle => {
  return {
    event: marker.event,
    eventIds: [marker.event.id],
    angleRad: marker.angleRad,
    markerHeight: marker.markerHeight,
    clusterSize: 1,
    isCluster: false,
  };
};

const clusterMarkers = (
  markers: readonly ResolvedEventMarker[],
  maxVisibleCount: number
): readonly ComputedEventAngle[] => {
  const thresholdRad = getClusteringThresholdRad(maxVisibleCount);
  const buckets = new Map<number, ResolvedEventMarker[]>();

  for (const marker of markers) {
    const rawIndex = Math.floor(marker.angleRad / thresholdRad);
    const bucketIndex = Math.min(maxVisibleCount - 1, rawIndex);
    const bucket = buckets.get(bucketIndex);

    if (bucket === undefined) {
      buckets.set(bucketIndex, [marker]);
    } else {
      bucket.push(marker);
    }
  }

  const clustered: ComputedEventAngle[] = [];

  for (const [, bucket] of buckets) {
    if (bucket.length === 1) {
      clustered.push(toComputedMarker(bucket[0]));
      continue;
    }

    const sortedBucket = [...bucket].sort(compareForRepresentative);
    const representative = sortedBucket[0];
    const meanAngle =
      bucket.reduce((sum, marker) => sum + marker.angleRad, 0) / bucket.length;
    const markerHeight = bucket.reduce((maxHeight, marker) => {
      return Math.max(maxHeight, marker.markerHeight);
    }, 0);
    const eventIds = [...bucket]
      .map((marker) => marker.event.id)
      .sort(compareStrings);

    clustered.push({
      event: representative.event,
      eventIds,
      angleRad: normalizeAngle(meanAngle),
      markerHeight,
      clusterSize: bucket.length,
      isCluster: true,
    });
  }

  return clustered.sort((left, right) => {
    if (left.angleRad !== right.angleRad) {
      return left.angleRad - right.angleRad;
    }

    return compareStrings(left.event.id, right.event.id);
  });
};

export const computeAngles = (
  events: readonly WorldEvent[],
  options: ComputeAnglesOptions
): readonly ComputedEventAngle[] => {
  const resolvedMarkers = [...resolveEventMarkers(events, options)].sort(
    compareMarkers
  );
  const maxVisibleCount = sanitizeMaxVisibleCount(options.maxVisibleCount);

  if (resolvedMarkers.length <= maxVisibleCount) {
    return resolvedMarkers.map(toComputedMarker);
  }

  return clusterMarkers(resolvedMarkers, maxVisibleCount);
};
