import { DatabaseClient } from "../database-client";

const eventLimitMock = vi.fn();
const eventOrderByMock = vi.fn().mockReturnValue({ limit: eventLimitMock });
const whereMock = vi.fn().mockReturnValue({ orderBy: eventOrderByMock });
const existenceLimitMock = vi.fn();
const newsLimitMock = vi.fn();
const newsOrderByMock = vi.fn().mockReturnValue({ limit: newsLimitMock });
const fromMock = vi.fn().mockReturnValue({
  where: whereMock,
  limit: existenceLimitMock,
  orderBy: newsOrderByMock,
});
const selectMock = vi.fn().mockReturnValue({ from: fromMock });

vi.mock("drizzle-orm/d1", () => ({
  drizzle: () => ({ select: selectMock }),
}));

vi.mock("drizzle-orm", () => ({
  count: () => ({ count: true }),
  desc: (col: unknown) => ({ desc: col }),
  eq: (col: unknown, val: unknown) => ({ eq: { col, val } }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings.join("?"),
      values,
    }),
    { join: () => ({ sql: "joined" }) }
  ),
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
    existenceLimitMock.mockResolvedValue([]);
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
    existenceLimitMock.mockResolvedValue([]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    await client.getEvents();

    expect(eventLimitMock).toHaveBeenCalledWith(50);
  });

  it("filters out skipped events", async () => {
    eventLimitMock.mockResolvedValue([]);
    existenceLimitMock.mockResolvedValue([]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    await client.getEvents();

    expect(whereMock).toHaveBeenCalledWith(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest matcher
      expect.objectContaining({ eq: expect.anything() })
    );
  });

  it("orders by publishedAt descending", async () => {
    eventLimitMock.mockResolvedValue([]);
    existenceLimitMock.mockResolvedValue([]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    await client.getEvents();

    expect(eventOrderByMock).toHaveBeenCalledWith(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest matcher
      expect.objectContaining({ desc: expect.anything() })
    );
  });

  it("falls back to news items when there are no processed events", async () => {
    eventLimitMock.mockResolvedValue([]);
    existenceLimitMock.mockResolvedValue([]);
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

  it("does not fall back when only skipped events exist", async () => {
    eventLimitMock.mockResolvedValue([]);
    existenceLimitMock.mockResolvedValue([makeEventRow({ skipped: true })]);
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.getEvents();

    expect(result).toEqual([]);
    expect(newsLimitMock).not.toHaveBeenCalled();
    expect(loggerMock.debug).toHaveBeenCalledWith(
      "processed events exist but none are displayable",
      { count: 1 }
    );
  });
});

describe("DatabaseClient.getStats", () => {
  // Helpers to build per-query mock chains for the four sequential select() calls.
  // Query 1 (total):      select -> from -> where  -> resolves [{ total }]
  // Query 2 (category):   select -> from -> where -> groupBy -> resolves [{ category, total }]
  // Query 3 (severity):   select -> from -> where -> groupBy -> resolves [{ severity, total }]
  // Query 4 (activity):   select -> from -> where -> groupBy -> orderBy -> resolves [{ date, total }]

  // Build a thenable object that also exposes the next builder methods.
  // This allows both `await chain.where(...)` and `chain.where(...).groupBy(...)`.
  const makeThenable = (
    resolved: unknown,
    methods: Record<string, unknown> = {}
  ) => {
    const obj: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve(resolved).then(resolve),
      catch: (reject: (e: unknown) => unknown) =>
        Promise.resolve(resolved).catch(reject),
      ...methods,
    };
    return obj;
  };

  const makeChain = (resolved: unknown) => {
    const orderBy = vi.fn().mockReturnValue(makeThenable(resolved));
    const groupBy = vi
      .fn()
      .mockReturnValue(makeThenable(resolved, { orderBy }));
    const where = vi.fn().mockReturnValue(makeThenable(resolved, { groupBy }));
    const from = vi.fn().mockReturnValue({ where });
    return { from };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zeroed totals and full keys when DB is empty", async () => {
    const chain1 = makeChain([{ total: 0 }]);
    const chain2 = makeChain([]);
    const chain3 = makeChain([]);
    const chain4 = makeChain([]);

    selectMock
      .mockReturnValueOnce({ from: chain1.from })
      .mockReturnValueOnce({ from: chain2.from })
      .mockReturnValueOnce({ from: chain3.from })
      .mockReturnValueOnce({ from: chain4.from });

    const client = new DatabaseClient({} as D1Database, loggerMock as never);
    const result = await client.getStats();

    expect(result.totals.events).toBe(0);
    expect(Object.keys(result.byCategory)).toHaveLength(9);
    expect(Object.values(result.byCategory).every((v) => v === 0)).toBe(true);
    expect(Object.keys(result.bySeverity)).toHaveLength(4);
    expect(Object.values(result.bySeverity).every((v) => v === 0)).toBe(true);
    expect(result.recentActivity).toHaveLength(7);
    expect(result.recentActivity.every((a) => a.count === 0)).toBe(true);
  });

  it("aggregates category counts correctly and zero-fills missing categories", async () => {
    const chain1 = makeChain([{ total: 3 }]);
    const chain2 = makeChain([
      { category: "conflict", total: 2 },
      { category: "politics", total: 1 },
    ]);
    const chain3 = makeChain([]);
    const chain4 = makeChain([]);

    selectMock
      .mockReturnValueOnce({ from: chain1.from })
      .mockReturnValueOnce({ from: chain2.from })
      .mockReturnValueOnce({ from: chain3.from })
      .mockReturnValueOnce({ from: chain4.from });

    const client = new DatabaseClient({} as D1Database, loggerMock as never);
    const result = await client.getStats();

    expect(result.byCategory.conflict).toBe(2);
    expect(result.byCategory.politics).toBe(1);
    expect(result.byCategory.climate).toBe(0);
  });

  it("aggregates severity counts correctly and zero-fills missing severities", async () => {
    const chain1 = makeChain([{ total: 5 }]);
    const chain2 = makeChain([]);
    const chain3 = makeChain([{ severity: "high", total: 5 }]);
    const chain4 = makeChain([]);

    selectMock
      .mockReturnValueOnce({ from: chain1.from })
      .mockReturnValueOnce({ from: chain2.from })
      .mockReturnValueOnce({ from: chain3.from })
      .mockReturnValueOnce({ from: chain4.from });

    const client = new DatabaseClient({} as D1Database, loggerMock as never);
    const result = await client.getStats();

    expect(result.bySeverity.high).toBe(5);
    expect(result.bySeverity.low).toBe(0);
  });

  it("returns exactly 7 recentActivity entries sorted oldest-to-newest", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const chain1 = makeChain([{ total: 10 }]);
    const chain2 = makeChain([]);
    const chain3 = makeChain([]);
    const chain4 = makeChain([{ date: today, total: 3 }]);

    selectMock
      .mockReturnValueOnce({ from: chain1.from })
      .mockReturnValueOnce({ from: chain2.from })
      .mockReturnValueOnce({ from: chain3.from })
      .mockReturnValueOnce({ from: chain4.from });

    const client = new DatabaseClient({} as D1Database, loggerMock as never);
    const result = await client.getStats();

    expect(result.recentActivity).toHaveLength(7);
    // entries should be sorted oldest first
    const dates = result.recentActivity.map((a) => a.date);
    expect(dates).toEqual([...dates].sort());
  });

  it("zero-fills activity days with no events", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const chain1 = makeChain([{ total: 3 }]);
    const chain2 = makeChain([]);
    const chain3 = makeChain([]);
    const chain4 = makeChain([{ date: today, total: 3 }]);

    selectMock
      .mockReturnValueOnce({ from: chain1.from })
      .mockReturnValueOnce({ from: chain2.from })
      .mockReturnValueOnce({ from: chain3.from })
      .mockReturnValueOnce({ from: chain4.from });

    const client = new DatabaseClient({} as D1Database, loggerMock as never);
    const result = await client.getStats();

    const todayEntry = result.recentActivity.find((a) => a.date === today);
    expect(todayEntry?.count).toBe(3);
    const otherEntries = result.recentActivity.filter((a) => a.date !== today);
    expect(otherEntries.every((a) => a.count === 0)).toBe(true);
  });

  it("ignores unknown category values from the database", async () => {
    const chain1 = makeChain([{ total: 1 }]);
    const chain2 = makeChain([{ category: "sports", total: 10 }]);
    const chain3 = makeChain([]);
    const chain4 = makeChain([]);

    selectMock
      .mockReturnValueOnce({ from: chain1.from })
      .mockReturnValueOnce({ from: chain2.from })
      .mockReturnValueOnce({ from: chain3.from })
      .mockReturnValueOnce({ from: chain4.from });

    const client = new DatabaseClient({} as D1Database, loggerMock as never);
    const result = await client.getStats();

    expect(Object.values(result.byCategory).every((v) => v === 0)).toBe(true);
  });

  it("logs debug with fetched stats from D1", async () => {
    const chain1 = makeChain([{ total: 7 }]);
    const chain2 = makeChain([]);
    const chain3 = makeChain([]);
    const chain4 = makeChain([]);

    selectMock
      .mockReturnValueOnce({ from: chain1.from })
      .mockReturnValueOnce({ from: chain2.from })
      .mockReturnValueOnce({ from: chain3.from })
      .mockReturnValueOnce({ from: chain4.from });

    const client = new DatabaseClient({} as D1Database, loggerMock as never);
    await client.getStats();

    expect(loggerMock.debug).toHaveBeenCalledWith("fetched stats from D1", {
      total: 7,
    });
  });
});
