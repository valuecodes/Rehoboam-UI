import type { WorldEvent } from "../../../features/rehoboam/engine/types";
import { DIVERGENCE_PULSE_LIFETIME_MS } from "../../../features/rehoboam/render/canvas2d/divergence-constants";
import { createDivergencePulseTracker } from "../../../features/rehoboam/render/canvas2d/divergence-pulse-tracker";

const BASE_EVENT: WorldEvent = {
  id: "event-1",
  title: "System anomaly",
  timestampMs: 1_700_000_000_000,
  severity: "high",
  category: "system",
};

describe("createDivergencePulseTracker", () => {
  it("suppresses pulses for the first loaded snapshot and emits afterwards", () => {
    const tracker = createDivergencePulseTracker();

    tracker.updateEvents([BASE_EVENT], 1_000);

    expect(tracker.getActivePulses(1_000)).toStrictEqual([]);

    tracker.updateEvents([BASE_EVENT], 1_100);

    expect(tracker.getActivePulses(1_100)).toHaveLength(0);

    tracker.updateEvents(
      [
        BASE_EVENT,
        {
          ...BASE_EVENT,
          id: "event-2",
          title: "New anomaly",
          severity: "medium",
        },
      ],
      1_200
    );

    expect(tracker.getActivePulses(1_200)).toStrictEqual([
      {
        eventId: "event-2",
        startedAtMs: 1_200,
        severity: "medium",
      },
    ]);

    tracker.updateEvents(
      [
        {
          ...BASE_EVENT,
          updatedAtMs: BASE_EVENT.timestampMs + 500,
          severity: "critical",
        },
      ],
      1_300
    );

    expect(tracker.getActivePulses(1_300)).toStrictEqual([
      {
        eventId: "event-2",
        startedAtMs: 1_200,
        severity: "medium",
      },
      {
        eventId: "event-1",
        startedAtMs: 1_300,
        severity: "critical",
      },
    ]);
  });

  it("can emit initial pulses when explicitly enabled", () => {
    const tracker = createDivergencePulseTracker({
      emitInitialPulses: true,
    });

    tracker.updateEvents([BASE_EVENT], 2_000);

    expect(tracker.getActivePulses(2_000)).toStrictEqual([
      {
        eventId: "event-1",
        startedAtMs: 2_000,
        severity: "high",
      },
    ]);
  });

  it("expires pulses after the configured lifetime", () => {
    const tracker = createDivergencePulseTracker({
      emitInitialPulses: true,
    });

    tracker.updateEvents([BASE_EVENT], 2_000);

    expect(
      tracker.getActivePulses(2_000 + DIVERGENCE_PULSE_LIFETIME_MS + 1)
    ).toHaveLength(0);
  });
});
