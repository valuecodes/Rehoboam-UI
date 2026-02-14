import type { WorldEvent } from "../engine/types";
import { dedupeEvents } from "./dedupe";
import type { EventPersistenceOptions } from "./persistence";
import { savePersistedEvents } from "./persistence";
import { loadEventsFromSource, runEventPipeline } from "./source";
import type { EventPipelineOptions, RehoboamEventSource } from "./source";

export type RefreshEventsFromSourceOptions = Readonly<{
  existingEvents: readonly WorldEvent[];
  source: RehoboamEventSource;
  pipeline?: EventPipelineOptions;
  persistence?: EventPersistenceOptions;
}>;

const normalizeSnapshot = (
  events: unknown,
  options: EventPipelineOptions = {}
): readonly WorldEvent[] => {
  return runEventPipeline(events, options);
};

export const mergeEventSnapshots = (
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

export const refreshEventsFromSource = async (
  options: RefreshEventsFromSourceOptions
): Promise<readonly WorldEvent[]> => {
  const existingSnapshot = normalizeSnapshot(
    options.existingEvents,
    options.pipeline
  );

  try {
    const refreshedSnapshot = await loadEventsFromSource(
      options.source,
      options.pipeline
    );
    await savePersistedEvents(refreshedSnapshot, {
      ...(options.persistence ?? {}),
      pipeline: options.pipeline,
    });

    return refreshedSnapshot;
  } catch {
    return existingSnapshot;
  }
};
