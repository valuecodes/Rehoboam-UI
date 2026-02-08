import {
  mergeEventSnapshots,
  refreshEventsFromSource,
} from "../../../features/rehoboam/data/bootstrap";
import { loadPersistedEvents } from "../../../features/rehoboam/data/persistence";
import type { EventPersistenceStore } from "../../../features/rehoboam/data/persistence";
import type { RehoboamEventSource } from "../../../features/rehoboam/data/source";
import type { WorldEvent } from "../../../features/rehoboam/engine/types";

const createEvent = (overrides: Partial<WorldEvent>): WorldEvent => {
  return {
    id: "event-default",
    title: "Default event",
    timestampMs: 1_770_500_000_000,
    severity: "low",
    category: "general",
    ...overrides,
  };
};

const createInMemoryEventStore = (
  initialValue: unknown
): EventPersistenceStore => {
  let storedValue = initialValue;

  return {
    read: () => Promise.resolve(storedValue),
    write: (value) => {
      storedValue = value;

      return Promise.resolve();
    },
    clear: () => {
      storedValue = undefined;

      return Promise.resolve();
    },
  };
};

describe("data/bootstrap", () => {
  it("merges new/updated events from refresh and persists merged snapshot", async () => {
    const existingEvents: readonly WorldEvent[] = [
      createEvent({
        id: "event-1",
        title: "Relay incident",
        severity: "medium",
        category: "infrastructure",
        updatedAtMs: 1_770_500_001_000,
      }),
    ];
    const source: RehoboamEventSource = {
      loadEvents: () => {
        return Promise.resolve([
          createEvent({
            id: "event-1",
            title: "Relay incident",
            severity: "critical",
            category: "infrastructure",
            updatedAtMs: 1_770_500_010_000,
          }),
          createEvent({
            id: "event-2",
            title: "Harbor lane congestion",
            severity: "high",
            category: "transport",
            timestampMs: 1_770_500_100_000,
          }),
        ] satisfies readonly WorldEvent[]);
      },
    };
    const store = createInMemoryEventStore(undefined);

    const merged = await refreshEventsFromSource({
      existingEvents,
      source,
      persistence: {
        store,
      },
    });
    const persisted = await loadPersistedEvents({
      store,
    });

    expect(merged).toHaveLength(2);
    expect(merged.find((event) => event.id === "event-1")?.severity).toBe(
      "critical"
    );
    expect(merged.find((event) => event.id === "event-2")).toBeDefined();
    expect(persisted).toStrictEqual(merged);
  });

  it("keeps cached snapshot when refresh source throws", async () => {
    const existingEvents: readonly WorldEvent[] = [
      createEvent({
        id: "event-3",
        title: "Cached fallback",
        severity: "high",
      }),
    ];
    const source: RehoboamEventSource = {
      loadEvents: () => {
        return Promise.reject(new Error("Source unavailable"));
      },
    };

    await expect(
      refreshEventsFromSource({
        existingEvents,
        source,
      })
    ).resolves.toStrictEqual(existingEvents);
  });

  it("normalizes and dedupes merged snapshots deterministically", () => {
    const merged = mergeEventSnapshots(
      [
        {
          headline: "Northern relay fault",
          timestamp: "2026-02-08T08:00:00.000Z",
          severity: "high",
          category: "telecom",
        },
      ],
      [
        {
          headline: "Northern relay fault",
          timestamp: "2026-02-08T08:00:00.000Z",
          severity: "critical",
          category: "telecom",
          updatedAt: "2026-02-08T08:05:00.000Z",
        },
      ]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].severity).toBe("critical");
  });
});
