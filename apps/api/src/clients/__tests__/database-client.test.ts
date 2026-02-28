import { DatabaseClient } from "../database-client";

const limitMock = vi.fn();
const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
const fromMock = vi.fn().mockReturnValue({ where: whereMock });
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

  it("returns empty array when database has no rows", async () => {
    limitMock.mockResolvedValue([]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.getEvents();

    expect(result).toEqual([]);
    expect(loggerMock.debug).toHaveBeenCalledWith("fetched events from D1", {
      count: 0,
    });
  });

  it("maps event rows to RehoboamEvent format", async () => {
    limitMock.mockResolvedValue([makeEventRow()]);
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
    limitMock.mockResolvedValue([
      makeEventRow({ publishedAt: "2025-12-31T23:59:59.999Z" }),
    ]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.getEvents();

    expect(result[0]?.date).toBe("2025-12-31");
  });

  it("rejects rows with invalid publishedAt values", async () => {
    limitMock.mockResolvedValue([
      makeEventRow({ publishedAt: "invalid-date" }),
    ]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    await expect(client.getEvents()).rejects.toThrow();
  });

  it("uses severity from database row", async () => {
    limitMock.mockResolvedValue([makeEventRow({ severity: "critical" })]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.getEvents();

    expect(result[0]?.severity).toBe("critical");
  });

  it("uses category from database row", async () => {
    limitMock.mockResolvedValue([makeEventRow({ category: "conflict" })]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.getEvents();

    expect(result[0]?.category).toBe("conflict");
  });

  it("rejects rows with invalid category values", async () => {
    limitMock.mockResolvedValue([makeEventRow({ category: "sports" })]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    await expect(client.getEvents()).rejects.toThrow();
  });

  it("falls back to Unknown when locationLabel is null", async () => {
    limitMock.mockResolvedValue([makeEventRow({ locationLabel: null })]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.getEvents();

    expect(result[0]?.location).toBe("Unknown");
  });

  it("enforces max 50 event limit", async () => {
    limitMock.mockResolvedValue([]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    await client.getEvents();

    expect(limitMock).toHaveBeenCalledWith(50);
  });

  it("filters out skipped events", async () => {
    limitMock.mockResolvedValue([]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    await client.getEvents();

    expect(whereMock).toHaveBeenCalledWith(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest matcher
      expect.objectContaining({ eq: expect.anything() })
    );
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
