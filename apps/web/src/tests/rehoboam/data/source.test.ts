import {
  createStaticEventSource,
  getMockFixtureEvents,
  loadEventsFromSource,
  runEventPipeline,
} from "../../../features/rehoboam/data/source";

describe("data/source pipeline", () => {
  it("normalizes + dedupes raw arrays deterministically", () => {
    const raw = [
      {
        title: "Northern relay fault",
        timestamp: "2026-02-08T08:00:00.000Z",
        severity: "high",
        category: "telecom",
        source: "mock-feed",
      },
      {
        title: "Northern relay fault",
        timestamp: "2026-02-08T08:00:00.000Z",
        severity: "critical",
        category: "telecom",
        source: "mock-feed",
        updatedAt: "2026-02-08T08:05:00.000Z",
      },
      {
        headline: "Harbor lane congestion",
        publishedAt: "2026-02-08T08:20:00.000Z",
        severity: 0.2,
        type: "transport",
      },
    ] as const;

    const first = runEventPipeline(raw);
    const second = runEventPipeline([raw[2], raw[0], raw[1]]);

    expect(first).toStrictEqual(second);
    expect(first).toHaveLength(2);
    expect(first[0].severity).toBe("critical");
  });

  it("loads fixture events through a static source", async () => {
    const fixtureEvents = getMockFixtureEvents();
    const source = createStaticEventSource(fixtureEvents);
    const loaded = await loadEventsFromSource(source);

    expect(loaded).toStrictEqual(fixtureEvents);
    expect(loaded.length).toBeGreaterThan(0);
    expect(loaded.every((event) => event.id.length > 0)).toBe(true);
  });
});
