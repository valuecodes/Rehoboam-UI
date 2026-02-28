import {
  CategorySchema,
  EventPublishedAtSchema,
  EventSchema,
  EventsResponseSchema,
  SeveritySchema,
} from "../rehoboam";

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

describe("CategorySchema", () => {
  it("accepts valid category values", () => {
    expect(CategorySchema.parse("conflict")).toBe("conflict");
    expect(CategorySchema.parse("politics")).toBe("politics");
    expect(CategorySchema.parse("climate")).toBe("climate");
    expect(CategorySchema.parse("health")).toBe("health");
    expect(CategorySchema.parse("economy")).toBe("economy");
    expect(CategorySchema.parse("diplomacy")).toBe("diplomacy");
    expect(CategorySchema.parse("disaster")).toBe("disaster");
    expect(CategorySchema.parse("science")).toBe("science");
    expect(CategorySchema.parse("general")).toBe("general");
  });

  it("rejects invalid category values", () => {
    expect(() => CategorySchema.parse("sports")).toThrow();
  });
});

describe("EventPublishedAtSchema", () => {
  it("normalizes an ISO datetime to date-only format", () => {
    expect(EventPublishedAtSchema.parse("2024-06-15T14:30:00.000Z")).toBe(
      "2024-06-15"
    );
  });

  it("rejects invalid datetime strings", () => {
    expect(() => EventPublishedAtSchema.parse("not-a-datetime")).toThrow();
  });
});

describe("EventSchema", () => {
  const validEvent = {
    id: "test-event",
    date: "2024-01-15",
    title: "Test event",
    location: "Test location",
    severity: "high",
    category: "politics",
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

  it("rejects an event with invalid category", () => {
    expect(() =>
      EventSchema.parse({ ...validEvent, category: "sports" })
    ).toThrow();
  });

  it("rejects an event with empty id", () => {
    expect(() => EventSchema.parse({ ...validEvent, id: "" })).toThrow();
  });

  it("rejects an event with invalid date format", () => {
    expect(() =>
      EventSchema.parse({ ...validEvent, date: "not-a-date" })
    ).toThrow();
  });

  it("rejects an event with empty title", () => {
    expect(() => EventSchema.parse({ ...validEvent, title: "" })).toThrow();
  });

  it("rejects an event with empty location", () => {
    expect(() => EventSchema.parse({ ...validEvent, location: "" })).toThrow();
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
        category: "general",
      },
      {
        id: "evt-2",
        date: "2024-02-01",
        title: "Second",
        location: "B",
        severity: "critical",
        category: "conflict",
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
