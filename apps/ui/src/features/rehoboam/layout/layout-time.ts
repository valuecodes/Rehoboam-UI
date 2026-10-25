import type { WorldEvent } from "~/features/rehoboam/engine/types";

const LEADING_TIME_OFFSET_MS = 45 * 60 * 1000;

export const getLayoutNowMs = (events: readonly WorldEvent[]): number => {
  if (events.length === 0) {
    return 0;
  }

  const latestTimestampMs = events.reduce(
    (latest, event) => Math.max(latest, event.timestampMs),
    0
  );

  return latestTimestampMs + LEADING_TIME_OFFSET_MS;
};
