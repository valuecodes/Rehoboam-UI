import { DatabaseClient } from "../database-client";

const limitMock = vi.fn();
const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
const fromMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
const selectMock = vi.fn().mockReturnValue({ from: fromMock });

vi.mock("drizzle-orm/d1", () => ({
  drizzle: () => ({ select: selectMock }),
}));

vi.mock("drizzle-orm", () => ({
  desc: (col: unknown) => ({ desc: col }),
}));

const loggerMock = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("DatabaseClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when database has no rows", async () => {
    limitMock.mockResolvedValue([]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.getEvents();

    expect(result).toEqual([]);
    expect(loggerMock.debug).toHaveBeenCalledWith(
      "fetched news items from D1",
      {
        count: 0,
      }
    );
  });

  it("maps news item rows to Event format", async () => {
    limitMock.mockResolvedValue([
      {
        id: "abc123",
        title: "Test Article",
        source: "bbc-world",
        publishedAt: "2024-06-15T14:30:00.000Z",
        link: "https://example.com/article",
        description: "A test article",
        createdAt: "2024-06-15T14:30:00.000Z",
        updatedAt: "2024-06-15T14:30:00.000Z",
      },
    ]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.getEvents();

    expect(result).toEqual([
      {
        id: "abc123",
        date: "2024-06-15",
        title: "Test Article",
        location: "bbc-world",
        severity: "medium",
      },
    ]);
  });

  it("truncates publishedAt to date-only format", async () => {
    limitMock.mockResolvedValue([
      {
        id: "date-test",
        title: "Date Test",
        source: "cnn",
        publishedAt: "2025-12-31T23:59:59.999Z",
        link: "https://example.com",
        description: null,
        createdAt: "2025-12-31T23:59:59.999Z",
        updatedAt: "2025-12-31T23:59:59.999Z",
      },
    ]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.getEvents();

    expect(result[0]?.date).toBe("2025-12-31");
  });

  it("sets severity to medium for all items", async () => {
    limitMock.mockResolvedValue([
      {
        id: "sev-test",
        title: "Severity Test",
        source: "bbc-world",
        publishedAt: "2024-01-01T00:00:00.000Z",
        link: "https://example.com",
        description: null,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.getEvents();

    expect(result[0]?.severity).toBe("medium");
  });

  it("enforces max 50 event limit", async () => {
    limitMock.mockResolvedValue([]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    await client.getEvents();

    expect(limitMock).toHaveBeenCalledWith(50);
  });

  it("orders by publishedAt descending", async () => {
    limitMock.mockResolvedValue([]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    await client.getEvents();

    expect(orderByMock).toHaveBeenCalledWith(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest matcher
      expect.objectContaining({ desc: expect.anything() })
    );
  });
});
