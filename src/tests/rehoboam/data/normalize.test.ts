import { normalizeEvent } from "../../../features/rehoboam/data/normalize";

describe("normalizeEvent", () => {
  it("normalizes mixed input shapes into a WorldEvent-safe object", () => {
    const normalized = normalizeEvent({
      headline: "  Grid corridor anomaly  ",
      publishedAt: "2026-02-08T06:30:00.000Z",
      severity: 0.93,
      type: "infrastructure",
      description: "Packet loss spikes above threshold.",
      geo: {
        place: "Paris, FR",
        lat: 48.8566,
        lng: 2.3522,
      },
      source: "mock-feed",
    });

    expect(normalized.title).toBe("Grid corridor anomaly");
    expect(normalized.timestampMs).toBe(Date.parse("2026-02-08T06:30:00.000Z"));
    expect(normalized.severity).toBe("critical");
    expect(normalized.category).toBe("infrastructure");
    expect(normalized.summary).toBe("Packet loss spikes above threshold.");
    expect(normalized.location).toStrictEqual({
      label: "Paris, FR",
      latitude: 48.8566,
      longitude: 2.3522,
    });
    expect(normalized.id.startsWith("evt-")).toBe(true);
  });

  it("stays deterministic for the same input and never throws on invalid payloads", () => {
    const input = {
      title: "Deterministic event",
      timestampMs: 1_770_500_000_000,
      severity: "high",
      category: "system",
      source: "mock-core",
    };

    const first = normalizeEvent(input);
    const second = normalizeEvent({ ...input });

    expect(first.id).toBe(second.id);
    expect(() => normalizeEvent(null)).not.toThrow();
    expect(normalizeEvent({})).toMatchObject({
      title: "Untitled Event",
      timestampMs: 0,
      severity: "low",
      category: "general",
    });
  });

  it("accepts the simplified fixture schema with date + location strings", () => {
    const normalized = normalizeEvent({
      id: "ukraine-war",
      date: "2022-02-24",
      title: "Russia launches full-scale invasion of Ukraine",
      location: "Kyiv, UA",
      severity: "critical",
    });

    expect(normalized.title).toBe(
      "Russia launches full-scale invasion of Ukraine"
    );
    expect(normalized.timestampMs).toBe(Date.parse("2022-02-24"));
    expect(normalized.location).toStrictEqual({
      label: "Kyiv, UA",
    });
    expect(normalized.severity).toBe("critical");
  });
});
