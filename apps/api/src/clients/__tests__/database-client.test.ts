import { DatabaseClient } from "../database-client";

const eventLimitMock = vi.fn();
const eventOrderByMock = vi.fn().mockReturnValue({ limit: eventLimitMock });
const whereMock = vi.fn().mockReturnValue({ orderBy: eventOrderByMock });
const newsLimitMock = vi.fn();
const newsOrderByMock = vi.fn().mockReturnValue({ limit: newsLimitMock });
const fromMock = vi.fn().mockReturnValue({
  where: whereMock,
  orderBy: newsOrderByMock,
});
const selectMock = vi.fn().mockReturnValue({ from: fromMock });

vi.mock("drizzle-orm/d1", () => ({
  drizzle: () => ({ select: selectMock }),
}));

vi.mock("drizzle-orm", () => ({
  desc: (col: unknown) => ({ desc: col }),
  eq: (col: unknown, val: unknown) => ({ eq: { col, val } }),
}));

const loggerMock = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const makeEventRow = (overrides: Record<string, unknown> = {}) => ({
  id: "abc123",
  newsItemId: "abc123",
  title: "Test Event",
  category: "politics",
  severity: "medium",
  locationLabel: "London, UK",
  publishedAt: "2024-06-15T14:30:00.000Z",
  skipped: false,
  createdAt: "2024-06-15T14:30:00.000Z",
  updatedAt: "2024-06-15T14:30:00.000Z",
  ...overrides,
});

describe("DatabaseClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when both events and fallback news items are empty", async () => {
    eventLimitMock.mockResolvedValue([]);
    newsLimitMock.mockResolvedValue([]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.getEvents();

    expect(result).toEqual([]);
    expect(loggerMock.debug).toHaveBeenCalledWith("fetched events from D1", {
      count: 0,
    });
    expect(loggerMock.debug).toHaveBeenCalledWith(
      "falling back to news items from D1",
      { count: 0 }
    );
  });

  it("maps event rows to RehoboamEvent format", async () => {
    eventLimitMock.mockResolvedValue([makeEventRow()]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.getEvents();

    expect(result).toEqual([
      {
        id: "abc123",
        date: "2024-06-15",
        title: "Test Event",
        location: "London, UK",
        severity: "medium",
        category: "politics",
      },
    ]);
  });

  it("truncates publishedAt to date-only format", async () => {
    eventLimitMock.mockResolvedValue([
      makeEventRow({ publishedAt: "2025-12-31T23:59:59.999Z" }),
    ]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.getEvents();

    expect(result[0]?.date).toBe("2025-12-31");
  });

  it("rejects rows with invalid publishedAt values", async () => {
    eventLimitMock.mockResolvedValue([
      makeEventRow({ publishedAt: "invalid-date" }),
    ]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    await expect(client.getEvents()).rejects.toThrow();
  });

  it("uses severity from database row", async () => {
    eventLimitMock.mockResolvedValue([makeEventRow({ severity: "critical" })]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.getEvents();

    expect(result[0]?.severity).toBe("critical");
  });

  it("uses category from database row", async () => {
    eventLimitMock.mockResolvedValue([makeEventRow({ category: "conflict" })]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.getEvents();

    expect(result[0]?.category).toBe("conflict");
  });

  it("rejects rows with invalid category values", async () => {
    eventLimitMock.mockResolvedValue([makeEventRow({ category: "sports" })]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    await expect(client.getEvents()).rejects.toThrow();
  });

  it("falls back to Unknown when locationLabel is null", async () => {
    eventLimitMock.mockResolvedValue([makeEventRow({ locationLabel: null })]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.getEvents();

    expect(result[0]?.location).toBe("Unknown");
  });

  it("enforces max 50 event limit", async () => {
    eventLimitMock.mockResolvedValue([]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    await client.getEvents();

    expect(eventLimitMock).toHaveBeenCalledWith(50);
  });

  it("filters out skipped events", async () => {
    eventLimitMock.mockResolvedValue([]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    await client.getEvents();

    expect(whereMock).toHaveBeenCalledWith(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest matcher
      expect.objectContaining({ eq: expect.anything() })
    );
  });

  it("orders by publishedAt descending", async () => {
    eventLimitMock.mockResolvedValue([]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    await client.getEvents();

    expect(eventOrderByMock).toHaveBeenCalledWith(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest matcher
      expect.objectContaining({ desc: expect.anything() })
    );
  });

  it("falls back to news items when there are no processed events", async () => {
    eventLimitMock.mockResolvedValue([]);
    newsLimitMock.mockResolvedValue([
      {
        id: "news-1",
        title: "Fallback Headline",
        publishedAt: "2024-06-15T14:30:00.000Z",
      },
    ]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.getEvents();

    expect(result).toEqual([
      {
        id: "news-1",
        date: "2024-06-15",
        title: "Fallback Headline",
        location: "Unknown",
        severity: "medium",
        category: "general",
      },
    ]);
    expect(newsLimitMock).toHaveBeenCalledWith(50);
    expect(loggerMock.debug).toHaveBeenCalledWith(
      "falling back to news items from D1",
      { count: 1 }
    );
  });
});
