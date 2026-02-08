import type { WorldEvent, WorldEventSeverity } from "../engine/types";
import { sortWorldEvents } from "./normalize";

const HALF_HOUR_MS = 30 * 60 * 1000;

const SEVERITY_RANK: Readonly<Record<WorldEventSeverity, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export type DedupeEventsOptions = Readonly<{
  timeBucketMs?: number;
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

const normalizeForKey = (value: string): string => {
  return value.trim().toLowerCase().replace(/\s+/gu, " ");
};

const getRevisionMs = (event: WorldEvent): number => {
  return event.updatedAtMs ?? event.createdAtMs ?? event.timestampMs;
};

const minDefined = (
  left: number | undefined,
  right: number | undefined
): number | undefined => {
  if (left === undefined) {
    return right;
  }

  if (right === undefined) {
    return left;
  }

  return Math.min(left, right);
};

const maxDefined = (
  left: number | undefined,
  right: number | undefined
): number | undefined => {
  if (left === undefined) {
    return right;
  }

  if (right === undefined) {
    return left;
  }

  return Math.max(left, right);
};

const choosePreferredEvent = (
  left: WorldEvent,
  right: WorldEvent
): WorldEvent => {
  const leftRevisionMs = getRevisionMs(left);
  const rightRevisionMs = getRevisionMs(right);

  if (leftRevisionMs !== rightRevisionMs) {
    return rightRevisionMs > leftRevisionMs ? right : left;
  }

  const leftSeverityRank = SEVERITY_RANK[left.severity];
  const rightSeverityRank = SEVERITY_RANK[right.severity];

  if (leftSeverityRank !== rightSeverityRank) {
    return rightSeverityRank > leftSeverityRank ? right : left;
  }

  if (left.timestampMs !== right.timestampMs) {
    return right.timestampMs > left.timestampMs ? right : left;
  }

  return compareStrings(left.id, right.id) <= 0 ? left : right;
};

const mergeEvents = (left: WorldEvent, right: WorldEvent): WorldEvent => {
  const preferred = choosePreferredEvent(left, right);
  const fallback = preferred === left ? right : left;
  const createdAtMs = minDefined(left.createdAtMs, right.createdAtMs);
  const updatedAtMs = maxDefined(left.updatedAtMs, right.updatedAtMs);
  const canonicalId =
    compareStrings(left.id, right.id) <= 0 ? left.id : right.id;

  return {
    id: canonicalId,
    title: preferred.title,
    timestampMs: preferred.timestampMs,
    severity: preferred.severity,
    category: preferred.category,
    summary: preferred.summary ?? fallback.summary,
    location: preferred.location ?? fallback.location,
    createdAtMs,
    updatedAtMs,
  };
};

const getSemanticKey = (event: WorldEvent, timeBucketMs: number): string => {
  const timeBucket = Math.floor(event.timestampMs / timeBucketMs);

  return [
    normalizeForKey(event.title),
    normalizeForKey(event.category),
    `${timeBucket}`,
  ].join("|");
};

const dedupeById = (events: readonly WorldEvent[]): readonly WorldEvent[] => {
  const byId = new Map<string, WorldEvent>();

  for (const event of sortWorldEvents(events)) {
    const existing = byId.get(event.id);
    byId.set(
      event.id,
      existing === undefined ? event : mergeEvents(existing, event)
    );
  }

  return sortWorldEvents([...byId.values()]);
};

const dedupeBySemanticKey = (
  events: readonly WorldEvent[],
  timeBucketMs: number
): readonly WorldEvent[] => {
  const byKey = new Map<string, WorldEvent>();

  for (const event of sortWorldEvents(events)) {
    const semanticKey = getSemanticKey(event, timeBucketMs);
    const existing = byKey.get(semanticKey);
    byKey.set(
      semanticKey,
      existing === undefined ? event : mergeEvents(existing, event)
    );
  }

  return sortWorldEvents([...byKey.values()]);
};

export const dedupeEvents = (
  events: readonly WorldEvent[],
  options: DedupeEventsOptions = {}
): readonly WorldEvent[] => {
  const timeBucketMs = Math.max(
    1,
    Math.trunc(options.timeBucketMs ?? HALF_HOUR_MS)
  );
  const dedupedById = dedupeById(events);

  return dedupeBySemanticKey(dedupedById, timeBucketMs);
};
