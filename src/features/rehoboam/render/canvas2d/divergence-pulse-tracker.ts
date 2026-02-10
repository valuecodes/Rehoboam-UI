import type { WorldEvent, WorldEventSeverity } from "../../engine/types";
import {
  DIVERGENCE_MAX_ACTIVE_PULSES,
  DIVERGENCE_PULSE_LIFETIME_MS,
} from "./divergence-constants";

export type DivergencePulse = Readonly<{
  eventId: string;
  startedAtMs: number;
  severity: WorldEventSeverity;
}>;

export type DivergencePulseTracker = Readonly<{
  updateEvents: (events: readonly WorldEvent[], timeMs: number) => void;
  getActivePulses: (timeMs: number) => readonly DivergencePulse[];
  reset: () => void;
}>;

export type CreateDivergencePulseTrackerOptions = Readonly<{
  maxActivePulses?: number;
  pulseLifetimeMs?: number;
  emitInitialPulses?: boolean;
}>;

const getEventRevisionSignature = (event: WorldEvent): string => {
  const revisionMs =
    event.updatedAtMs ?? event.createdAtMs ?? event.timestampMs;

  return [
    `${revisionMs}`,
    `${event.timestampMs}`,
    event.severity,
    event.title,
    event.category,
  ].join("|");
};

const pruneExpiredPulses = (
  pulses: readonly DivergencePulse[],
  timeMs: number,
  pulseLifetimeMs: number
): readonly DivergencePulse[] => {
  return pulses.filter((pulse) => {
    return timeMs - pulse.startedAtMs <= pulseLifetimeMs;
  });
};

const clampPositiveInt = (
  value: number | undefined,
  fallback: number
): number => {
  return Math.max(1, Math.trunc(value ?? fallback));
};

export const createDivergencePulseTracker = (
  options: CreateDivergencePulseTrackerOptions = {}
): DivergencePulseTracker => {
  const maxActivePulses = clampPositiveInt(
    options.maxActivePulses,
    DIVERGENCE_MAX_ACTIVE_PULSES
  );
  const pulseLifetimeMs = clampPositiveInt(
    options.pulseLifetimeMs,
    DIVERGENCE_PULSE_LIFETIME_MS
  );
  const emitInitialPulses = options.emitInitialPulses === true;

  let knownRevisionByEventId = new Map<string, string>();
  let pulses: readonly DivergencePulse[] = [];
  let hasInitializedWithEvents = false;

  const updateEvents: DivergencePulseTracker["updateEvents"] = (
    events,
    timeMs
  ) => {
    const nextKnownRevisionByEventId = new Map<string, string>();
    const sortedEvents = [...events].sort((left, right) => {
      return left.id.localeCompare(right.id);
    });
    const shouldSuppressInitialPulses =
      !emitInitialPulses && !hasInitializedWithEvents && sortedEvents.length > 0;
    const nextPulses: DivergencePulse[] = [];

    for (const event of sortedEvents) {
      const revisionSignature = getEventRevisionSignature(event);
      const previousRevisionSignature = knownRevisionByEventId.get(event.id);

      nextKnownRevisionByEventId.set(event.id, revisionSignature);

      if (shouldSuppressInitialPulses) {
        continue;
      }

      if (
        previousRevisionSignature === undefined ||
        previousRevisionSignature !== revisionSignature
      ) {
        nextPulses.push({
          eventId: event.id,
          startedAtMs: timeMs,
          severity: event.severity,
        });
      }
    }

    knownRevisionByEventId = nextKnownRevisionByEventId;
    if (sortedEvents.length > 0) {
      hasInitializedWithEvents = true;
    }

    const mergedPulses = [...pulses, ...nextPulses];
    const activePulses = pruneExpiredPulses(
      mergedPulses,
      timeMs,
      pulseLifetimeMs
    );

    pulses =
      activePulses.length <= maxActivePulses
        ? activePulses
        : activePulses.slice(activePulses.length - maxActivePulses);
  };

  const getActivePulses: DivergencePulseTracker["getActivePulses"] = (
    timeMs
  ) => {
    pulses = pruneExpiredPulses(pulses, timeMs, pulseLifetimeMs);

    return [...pulses];
  };

  const reset: DivergencePulseTracker["reset"] = () => {
    knownRevisionByEventId = new Map<string, string>();
    pulses = [];
    hasInitializedWithEvents = false;
  };

  return {
    updateEvents,
    getActivePulses,
    reset,
  };
};
