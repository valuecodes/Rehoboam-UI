import { DatabaseClient } from "../clients/database-client";

const onConflictDoUpdateMock = vi.fn().mockResolvedValue(undefined);
const valuesMock = vi
  .fn()
  .mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
const updateWhereMock = vi.fn().mockResolvedValue(undefined);
const setMock = vi.fn().mockReturnValue({ where: updateWhereMock });
const updateMock = vi.fn().mockReturnValue({ set: setMock });
const runMock = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
const whereMock = vi.fn().mockReturnValue({
  orderBy: vi.fn().mockResolvedValue([]),
});
const leftJoinMock = vi.fn().mockReturnValue({ where: whereMock });
const fromMock = vi.fn().mockReturnValue({ leftJoin: leftJoinMock });
const selectMock = vi.fn().mockReturnValue({ from: fromMock });

vi.mock("drizzle-orm/d1", () => ({
  drizzle: () => ({
    insert: insertMock,
    run: runMock,
    select: selectMock,
    update: updateMock,
  }),
}));

vi.mock("drizzle-orm", () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._args: unknown[]) => ({
      strings,
    }),
    {}
  ),
  and: (...conditions: unknown[]) => ({ and: conditions }),
  desc: vi.fn(),
  inArray: (col: unknown, values: unknown[]) => ({ inArray: { col, values } }),
  isNull: vi.fn(),
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

  it("returns 0 and logs debug when items array is empty", async () => {
    const client = new DatabaseClient({} as D1Database, loggerMock as never);
    const result = await client.upsertNewsItems([]);

    expect(result).toBe(0);
    expect(loggerMock.debug).toHaveBeenCalledWith("no news items to upsert");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("upserts items and returns count", async () => {
    const client = new DatabaseClient({} as D1Database, loggerMock as never);
    const items = [
      {
        id: "abc123",
        title: "Test Article",
        source: "test-source",
        publishedAt: "2024-01-01T00:00:00.000Z",
        link: "https://example.com/article",
        description: "A test article",
      },
    ];

    const result = await client.upsertNewsItems(items);

    expect(result).toBe(1);
    expect(insertMock).toHaveBeenCalledOnce();
    expect(valuesMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "abc123",
          title: "Test Article",
          source: "test-source",
        }),
      ])
    );
    expect(onConflictDoUpdateMock).toHaveBeenCalledOnce();
    expect(loggerMock.info).toHaveBeenCalledWith("news items upserted", {
      count: 1,
    });
  });

  it("batches large item sets into chunks of 10", async () => {
    const client = new DatabaseClient({} as D1Database, loggerMock as never);
    const items = Array.from({ length: 25 }, (_, i) => ({
      id: `id-${String(i)}`,
      title: `Article ${String(i)}`,
      source: "test-source",
      publishedAt: "2024-01-01T00:00:00.000Z",
      link: `https://example.com/${String(i)}`,
    }));

    const result = await client.upsertNewsItems(items);

    expect(result).toBe(25);
    expect(insertMock).toHaveBeenCalledTimes(3);
  });

  it("converts undefined description to null", async () => {
    const client = new DatabaseClient({} as D1Database, loggerMock as never);
    const items = [
      {
        id: "abc123",
        title: "No Description",
        source: "test-source",
        publishedAt: "2024-01-01T00:00:00.000Z",
        link: "https://example.com/article",
      },
    ];

    await client.upsertNewsItems(items);

    expect(valuesMock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ description: null })])
    );
  });

  it("deletes old news items beyond the max limit", async () => {
    runMock.mockResolvedValueOnce({ meta: { changes: 5 } });
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.deleteOldNewsItems(200);

    expect(result).toBe(5);
    expect(runMock).toHaveBeenCalledOnce();
    expect(loggerMock.info).toHaveBeenCalledWith("old news items deleted", {
      deletedCount: 5,
      maxItems: 200,
    });
  });

  it("returns 0 when no old items to delete", async () => {
    runMock.mockResolvedValueOnce({ meta: { changes: 0 } });
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.deleteOldNewsItems(200);

    expect(result).toBe(0);
    expect(loggerMock.info).toHaveBeenCalledWith("old news items deleted", {
      deletedCount: 0,
      maxItems: 200,
    });
  });

  it("throws when maxItems is 0", async () => {
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    await expect(client.deleteOldNewsItems(0)).rejects.toThrow(
      "maxItems must be at least 1"
    );
    expect(runMock).not.toHaveBeenCalled();
  });

  it("returns 0 and logs debug when events array is empty", async () => {
    const client = new DatabaseClient({} as D1Database, loggerMock as never);
    const result = await client.upsertEvents([]);

    expect(result).toBe(0);
    expect(loggerMock.debug).toHaveBeenCalledWith("no events to upsert");
  });

  it("upserts events with skipped flag", async () => {
    const client = new DatabaseClient({} as D1Database, loggerMock as never);
    const items = [
      {
        newsItemId: "item-1",
        title: "Short Title",
        category: "politics",
        severity: "medium" as const,
        locationLabel: "London, UK",
        publishedAt: "2024-01-01T00:00:00.000Z",
        skipped: false,
      },
      {
        newsItemId: "item-2",
        title: "Skipped Item",
        category: "general",
        severity: "low" as const,
        locationLabel: null,
        publishedAt: "2024-01-01T00:00:00.000Z",
        skipped: true,
      },
    ];

    const result = await client.upsertEvents(items);

    expect(result).toBe(2);
    expect(insertMock).toHaveBeenCalledOnce();
    expect(valuesMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "item-1",
          newsItemId: "item-1",
          skipped: false,
          locationLabel: "London, UK",
        }),
        expect.objectContaining({
          id: "item-2",
          newsItemId: "item-2",
          skipped: true,
          locationLabel: null,
        }),
      ])
    );
    expect(loggerMock.info).toHaveBeenCalledWith("events upserted", {
      count: 2,
    });
  });

  it("queries unprocessed news items via LEFT JOIN", async () => {
    const mockRows = [
      {
        id: "item-1",
        title: "Unprocessed",
        source: "bbc-world",
        publishedAt: "2024-01-01T00:00:00.000Z",
        link: "https://example.com/1",
        description: null,
      },
    ];

    whereMock.mockReturnValueOnce({
      orderBy: vi.fn().mockResolvedValueOnce(mockRows),
    });

    const client = new DatabaseClient({} as D1Database, loggerMock as never);
    const result = await client.getUnprocessedNewsItems();

    expect(result).toEqual([
      {
        id: "item-1",
        title: "Unprocessed",
        source: "bbc-world",
        publishedAt: "2024-01-01T00:00:00.000Z",
        link: "https://example.com/1",
        description: undefined,
      },
    ]);
    expect(selectMock).toHaveBeenCalledOnce();
    expect(loggerMock.debug).toHaveBeenCalledWith(
      "found unprocessed news items",
      { count: 1 }
    );
  });

  it("returns 0 and logs debug when no news items need AI reservation", async () => {
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.reserveNewsItemsForAi([]);

    expect(result).toBe(0);
    expect(loggerMock.debug).toHaveBeenCalledWith(
      "no news items to reserve for AI"
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("reserves news items before AI processing", async () => {
    const client = new DatabaseClient({} as D1Database, loggerMock as never);

    const result = await client.reserveNewsItemsForAi(["item-1", "item-2"]);
    const setArg = setMock.mock.calls[0]?.[0] as
      | {
          aiReservedAt: string;
          updatedAt: string;
        }
      | undefined;
    const whereArg = updateWhereMock.mock.calls[0]?.[0] as
      | {
          and: unknown[];
        }
      | undefined;

    expect(result).toBe(2);
    expect(updateMock).toHaveBeenCalledWith(expect.anything());
    expect(setArg?.aiReservedAt).toEqual(expect.any(String));
    expect(setArg?.updatedAt).toEqual(expect.any(String));
    expect(whereArg?.and).toHaveLength(2);
    expect(loggerMock.info).toHaveBeenCalledWith("news items reserved for AI", {
      count: 2,
    });
  });
});
