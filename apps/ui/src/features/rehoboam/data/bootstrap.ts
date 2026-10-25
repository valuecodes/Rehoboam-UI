import type { WorldEvent } from "~/features/rehoboam/engine/types";

import { dedupeEvents } from "./dedupe";
import { loadEventsFromSource, runEventPipeline } from "./source";
import type { EventPipelineOptions, RehoboamEventSource } from "./source";

type RefreshEventsFromSourceOptions = Readonly<{
  existingEvents: readonly WorldEvent[];
  source: RehoboamEventSource;
  pipeline?: EventPipelineOptions;
}>;

type RefreshEventsFromSourceResult = Readonly<{
  events: readonly WorldEvent[];
  status: "success" | "fallback";
}>;

const normalizeSnapshot = (
  events: unknown,
  options: EventPipelineOptions = {}
): readonly WorldEvent[] => runEventPipeline(events, options);

const mergeEventSnapshots = (
  existingEvents: unknown,
  refreshedEvents: unknown,
  options: EventPipelineOptions = {}
): readonly WorldEvent[] => {
  const existingSnapshot = normalizeSnapshot(existingEvents, options);
  const refreshedSnapshot = normalizeSnapshot(refreshedEvents, options);

  return dedupeEvents(
    [...existingSnapshot, ...refreshedSnapshot],
    options.dedupe
  );
};

const refreshEventsFromSourceWithStatus = async (
  options: RefreshEventsFromSourceOptions
): Promise<RefreshEventsFromSourceResult> => {
  const existingSnapshot = normalizeSnapshot(
    options.existingEvents,
    options.pipeline
  );

  try {
    const refreshedSnapshot = await loadEventsFromSource(
      options.source,
      options.pipeline
    );

    return {
      events: refreshedSnapshot,
      status: "success",
    };
  } catch {
    return {
      events: existingSnapshot,
      status: "fallback",
    };
  }
};

const refreshEventsFromSource = async (
  options: RefreshEventsFromSourceOptions
): Promise<readonly WorldEvent[]> => {
  const result = await refreshEventsFromSourceWithStatus(options);

  return result.events;
};

export {
  mergeEventSnapshots,
  refreshEventsFromSource,
  refreshEventsFromSourceWithStatus,
};
