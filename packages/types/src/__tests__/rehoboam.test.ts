import { EventSchema, EventsResponseSchema, SeveritySchema } from "../rehoboam";

describe("SeveritySchema", () => {
  it("accepts valid severity values", () => {
    expect(SeveritySchema.parse("low")).toBe("low");
    expect(SeveritySchema.parse("medium")).toBe("medium");
    expect(SeveritySchema.parse("high")).toBe("high");
    expect(SeveritySchema.parse("critical")).toBe("critical");
  });

  it("rejects invalid severity values", () => {
    expect(() => SeveritySchema.parse("unknown")).toThrow();
  });
});

describe("EventSchema", () => {
  const validEvent = {
    id: "test-event",
    date: "2024-01-15",
    title: "Test event",
    location: "Test location",
    severity: "high",
  };

  it("accepts a valid event object", () => {
    const result = EventSchema.parse(validEvent);
    expect(result).toEqual(validEvent);
  });

  it("rejects an event missing required fields", () => {
    expect(() => EventSchema.parse({ id: "incomplete" })).toThrow();
  });

  it("rejects an event with invalid severity", () => {
    expect(() =>
      EventSchema.parse({ ...validEvent, severity: "extreme" })
    ).toThrow();
  });
});

describe("EventsResponseSchema", () => {
  it("accepts an array of valid events", () => {
    const events = [
      {
        id: "evt-1",
        date: "2024-01-15",
        title: "First",
        location: "A",
        severity: "low",
      },
      {
        id: "evt-2",
        date: "2024-02-01",
        title: "Second",
        location: "B",
        severity: "critical",
      },
    ];

    const result = EventsResponseSchema.parse(events);
    expect(result).toHaveLength(2);
  });

  it("accepts an empty array", () => {
    const result = EventsResponseSchema.parse([]);
    expect(result).toHaveLength(0);
  });

  it("rejects an array with invalid entries", () => {
    expect(() => EventsResponseSchema.parse([{ id: "incomplete" }])).toThrow();
  });
});
