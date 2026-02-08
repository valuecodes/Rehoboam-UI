import type { WorldEvent } from "../engine/types";
import mockEventsFixture from "../fixtures/mock-events.json";
import { dedupeEvents } from "./dedupe";
import type { DedupeEventsOptions } from "./dedupe";
import { normalizeEvents } from "./normalize";
import type { NormalizeEventOptions } from "./normalize";

export type EventPipelineOptions = Readonly<{
  normalize?: NormalizeEventOptions;
  dedupe?: DedupeEventsOptions;
}>;

export type RehoboamEventSource = Readonly<{
  loadEvents: () => Promise<readonly WorldEvent[]>;
}>;

const toEventList = (input: unknown): readonly unknown[] => {
  return Array.isArray(input) ? input : [];
};

const isWorldEventLike = (value: unknown): value is WorldEvent => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.timestampMs === "number" &&
    Number.isFinite(candidate.timestampMs) &&
    typeof candidate.category === "string" &&
    (candidate.severity === "low" ||
      candidate.severity === "medium" ||
      candidate.severity === "high" ||
      candidate.severity === "critical")
  );
};

export const runEventPipeline = (
  input: unknown,
  options: EventPipelineOptions = {}
): readonly WorldEvent[] => {
  const list = toEventList(input);

  if (list.every((item) => isWorldEventLike(item))) {
    return dedupeEvents(list, options.dedupe);
  }

  const normalized = normalizeEvents(list, options.normalize);

  return dedupeEvents(normalized, options.dedupe);
};

export const getMockFixtureEvents = (
  options: EventPipelineOptions = {}
): readonly WorldEvent[] => {
  return runEventPipeline(mockEventsFixture, options);
};

export const createStaticEventSource = (
  input: unknown,
  options: EventPipelineOptions = {}
): RehoboamEventSource => {
  const snapshot = runEventPipeline(input, options);

  return {
    loadEvents: () => Promise.resolve(snapshot),
  };
};

export const createMockEventSource = (
  options: EventPipelineOptions = {}
): RehoboamEventSource => {
  return createStaticEventSource(mockEventsFixture, options);
};

export const loadEventsFromSource = async (
  source: RehoboamEventSource
): Promise<readonly WorldEvent[]> => {
  return source.loadEvents();
};
