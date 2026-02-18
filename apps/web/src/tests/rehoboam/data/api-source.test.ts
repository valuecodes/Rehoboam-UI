import {
  createApiEventSource,
  loadEventsFromSource,
} from "../../../features/rehoboam/data/source";

const mockEvents = [
  {
    id: "test-event-1",
    date: "2024-01-15",
    title: "Test event one",
    location: "London",
    severity: "high",
  },
  {
    id: "test-event-2",
    date: "2024-06-01",
    title: "Test event two",
    location: "Tokyo",
    severity: "critical",
  },
];

describe("createApiEventSource", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches events from the given URL and returns raw JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      })
    );

    const source = createApiEventSource("/api/events");
    const result = await source.loadEvents();

    expect(fetch).toHaveBeenCalledWith("/api/events");
    expect(result).toStrictEqual(mockEvents);
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      })
    );

    const source = createApiEventSource("/api/events");

    await expect(source.loadEvents()).rejects.toThrow(
      "Failed to fetch events: 500 Internal Server Error"
    );
  });

  it("propagates network errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    );

    const source = createApiEventSource("/api/events");

    await expect(source.loadEvents()).rejects.toThrow("Failed to fetch");
  });

  it("normalizes API response through the event pipeline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      })
    );

    const source = createApiEventSource("/api/events");
    const events = await loadEventsFromSource(source);

    expect(events).toHaveLength(2);
    expect(events.every((e) => typeof e.timestampMs === "number")).toBe(true);
    expect(events.every((e) => e.id.length > 0)).toBe(true);
    expect(
      events.every(
        (e) => e.location !== undefined && e.location.label.length > 0
      )
    ).toBe(true);
  });
});
