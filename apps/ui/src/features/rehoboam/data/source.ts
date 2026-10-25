import type { WorldEvent } from "~/features/rehoboam/engine/types";
import mockEventsFixture from "~/features/rehoboam/fixtures/mock-events.json";

import { dedupeEvents } from "./dedupe";
import type { DedupeEventsOptions } from "./dedupe";
import { normalizeEvents } from "./normalize";
import type { NormalizeEventOptions } from "./normalize";

type EventPipelineOptions = Readonly<{
  normalize?: NormalizeEventOptions;
  dedupe?: DedupeEventsOptions;
}>;

type RehoboamEventSource = Readonly<{
  loadEvents: () => Promise<unknown>;
}>;

const toEventList = (input: unknown): readonly unknown[] =>
  Array.isArray(input) ? input : [];

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

const runEventPipeline = (
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

const getMockFixtureEvents = (
  options: EventPipelineOptions = {}
): readonly WorldEvent[] => runEventPipeline(mockEventsFixture, options);

const createStaticEventSource = (
  input: unknown,
  options: EventPipelineOptions = {}
): RehoboamEventSource => {
  const snapshot = runEventPipeline(input, options);

  return {
    loadEvents: () => Promise.resolve(snapshot),
  };
};

const loadEventsFromSource = async (
  source: RehoboamEventSource,
  options: EventPipelineOptions = {}
): Promise<readonly WorldEvent[]> => {
  const payload = await source.loadEvents();

  return runEventPipeline(payload, options);
};

const createApiEventSource = (url: string): RehoboamEventSource => ({
  loadEvents: async () => {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch events: ${response.status} ${response.statusText}`
      );
    }

    return response.json() as Promise<unknown>;
  },
});

export {
  createApiEventSource,
  createStaticEventSource,
  getMockFixtureEvents,
  loadEventsFromSource,
  runEventPipeline,
};
export type { EventPipelineOptions, RehoboamEventSource };
