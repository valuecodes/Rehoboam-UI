import { DatabaseClient } from "../clients/database-client";

const onConflictDoUpdateMock = vi.fn().mockResolvedValue(undefined);
const valuesMock = vi
  .fn()
  .mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
const insertMock = vi.fn().mockReturnValue({ values: valuesMock });

vi.mock("drizzle-orm/d1", () => ({
  drizzle: () => ({ insert: insertMock }),
}));

vi.mock("drizzle-orm", () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._args: unknown[]) => ({
      strings,
    }),
    {}
  ),
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
});
