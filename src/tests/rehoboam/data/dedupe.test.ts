import { dedupeEvents } from "../../../features/rehoboam/data/dedupe";
import type { WorldEvent } from "../../../features/rehoboam/engine/types";

const createEvent = (overrides: Partial<WorldEvent>): WorldEvent => {
  return {
    id: "event-default",
    title: "Default title",
    timestampMs: 1_770_500_000_000,
    severity: "low",
    category: "general",
    ...overrides,
  };
};

describe("dedupeEvents", () => {
  it("merges duplicates by id and keeps newest update fields", () => {
    const older = createEvent({
      id: "event-1",
      title: "Orbital launch update",
      severity: "medium",
      summary: "Initial report.",
      createdAtMs: 1_770_500_100_000,
      updatedAtMs: 1_770_500_120_000,
    });
    const newer = createEvent({
      id: "event-1",
      title: "Orbital launch update",
      severity: "critical",
      summary: "Telemetry window now red.",
      createdAtMs: 1_770_500_100_000,
      updatedAtMs: 1_770_500_180_000,
    });

    const deduped = dedupeEvents([older, newer]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]).toMatchObject({
      id: "event-1",
      title: "Orbital launch update",
      severity: "critical",
      summary: "Telemetry window now red.",
      createdAtMs: 1_770_500_100_000,
      updatedAtMs: 1_770_500_180_000,
    });
  });

  it("merges semantic duplicates with different ids inside the same time bucket", () => {
    const left = createEvent({
      id: "event-b",
      title: "Grid pressure anomaly",
      category: "infrastructure",
      timestampMs: 1_770_500_000_000,
      severity: "high",
    });
    const right = createEvent({
      id: "event-a",
      title: "Grid pressure anomaly",
      category: "infrastructure",
      timestampMs: 1_770_500_000_100,
      severity: "critical",
      updatedAtMs: 1_770_500_060_000,
    });

    const deduped = dedupeEvents([left, right]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe("event-a");
    expect(deduped[0].severity).toBe("critical");
  });

  it("returns deterministic output regardless of input ordering", () => {
    const events = [
      createEvent({
        id: "event-c",
        title: "Event C",
        timestampMs: 1_770_500_020_000,
        severity: "low",
      }),
      createEvent({
        id: "event-a",
        title: "Event A",
        timestampMs: 1_770_500_010_000,
        severity: "critical",
      }),
      createEvent({
        id: "event-b",
        title: "Event B",
        timestampMs: 1_770_500_010_000,
        severity: "medium",
      }),
    ] satisfies readonly WorldEvent[];

    const first = dedupeEvents(events);
    const second = dedupeEvents([events[2], events[0], events[1]]);

    expect(first).toStrictEqual(second);
  });
});
