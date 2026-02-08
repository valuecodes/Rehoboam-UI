import {
  clearPersistedEvents,
  loadPersistedEvents,
  savePersistedEvents,
} from "../../../features/rehoboam/data/persistence";
import type { EventPersistenceStore } from "../../../features/rehoboam/data/persistence";
import type { WorldEvent } from "../../../features/rehoboam/engine/types";

type InMemoryEventStoreHarness = Readonly<{
  store: EventPersistenceStore;
  readRawValue: () => unknown;
}>;

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
): InMemoryEventStoreHarness => {
  let storedValue = initialValue;

  return {
    store: {
      read: () => Promise.resolve(storedValue),
      write: (value) => {
        storedValue = value;

        return Promise.resolve();
      },
      clear: () => {
        storedValue = undefined;

        return Promise.resolve();
      },
    },
    readRawValue: () => storedValue,
  };
};

describe("data/persistence", () => {
  it("round-trips persisted events through save/load helpers", async () => {
    const storeHarness = createInMemoryEventStore(undefined);
    const duplicateOlder = createEvent({
      id: "event-1",
      title: "Relay incident",
      severity: "medium",
      updatedAtMs: 1_770_500_001_000,
    });
    const duplicateNewer = createEvent({
      id: "event-1",
      title: "Relay incident",
      severity: "critical",
      updatedAtMs: 1_770_500_002_000,
    });

    await savePersistedEvents([duplicateOlder, duplicateNewer], {
      store: storeHarness.store,
      now: () => 1_770_600_000_000,
    });

    const loaded = await loadPersistedEvents({
      store: storeHarness.store,
    });

    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      id: "event-1",
      severity: "critical",
    });
    expect(storeHarness.readRawValue()).toMatchObject({
      version: 1,
      savedAtMs: 1_770_600_000_000,
    });
  });

  it("handles malformed persisted payloads without throwing", async () => {
    const malformedStore = createInMemoryEventStore({
      version: 1,
      savedAtMs: 1_770_600_000_000,
      events: [
        null,
        {
          headline: "Grid corridor anomaly",
          publishedAt: "2026-02-08T06:30:00.000Z",
          severity: 0.9,
          type: "infrastructure",
        },
      ],
    });

    await expect(
      loadPersistedEvents({
        store: malformedStore.store,
      })
    ).resolves.toHaveLength(1);

    const invalidStore = createInMemoryEventStore("broken-payload");

    await expect(
      loadPersistedEvents({
        store: invalidStore.store,
      })
    ).resolves.toStrictEqual([]);
  });

  it("clears persisted events", async () => {
    const storeHarness = createInMemoryEventStore({
      version: 1,
      savedAtMs: 1_770_600_000_000,
      events: [createEvent({ id: "event-9" })],
    });

    await clearPersistedEvents({
      store: storeHarness.store,
    });

    await expect(
      loadPersistedEvents({
        store: storeHarness.store,
      })
    ).resolves.toStrictEqual([]);
  });
});
