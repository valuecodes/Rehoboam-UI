import { NewsJob } from "../jobs/news-job";

const fetchMock = vi.hoisted(() => vi.fn());

const { MockService } = await vi.hoisted(async () => {
  const { NewsService } = await import("../jobs/news/services/news-service");

  class MockServiceClass extends NewsService {
    readonly slug = "test-feed";
    readonly url = "https://example.com/rss.xml";

    protected async parse(): Promise<
      {
        id: string;
        title: string;
        source: string;
        publishedAt: string;
        link: string;
        description: string;
      }[]
    > {
      return [
        {
          id: await this.hashId("mock-1"),
          title: "Mock Article",
          source: this.slug,
          publishedAt: "2024-01-01T12:00:00.000Z",
          link: "https://example.com/1",
          description: "A mock article",
        },
      ];
    }
  }

  return { MockService: MockServiceClass };
});

vi.mock("../jobs/news/services/bbc-service", () => ({
  BbcNewsService: MockService,
}));

const loggerMock = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const dbMock = {
  upsertNewsItems: vi.fn().mockResolvedValue(0),
  deleteOldNewsItems: vi.fn().mockResolvedValue(0),
  getUnprocessedNewsItems: vi.fn().mockResolvedValue([]),
  reserveNewsItemsForAi: vi.fn().mockResolvedValue([]),
  upsertEvents: vi.fn().mockResolvedValue(0),
};

const aiMock = {
  processNewsItems: vi.fn().mockResolvedValue({ events: [], failed: 0 }),
};

describe("NewsJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and aggregates items from all services", async () => {
    fetchMock.mockImplementation(() => new Response("<rss/>", { status: 200 }));

    const job = new NewsJob(
      loggerMock as never,
      dbMock as never,
      aiMock as never
    );
    await job.run();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(dbMock.upsertNewsItems).toHaveBeenCalledOnce();
    expect(dbMock.deleteOldNewsItems).toHaveBeenCalledWith(200);
    expect(loggerMock.info).toHaveBeenCalledWith(
      "news job completed",
      expect.objectContaining({
        totalItems: 1,
        deletedCount: 0,
        failed: 0,
        services: 1,
      })
    );
  });

  it("runs AI processing after news upsert", async () => {
    fetchMock.mockImplementation(() => new Response("<rss/>", { status: 200 }));
    const unprocessedItems = [
      {
        id: "item-1",
        title: "Test",
        source: "test",
        publishedAt: "2024-01-01T00:00:00.000Z",
        link: "https://example.com",
      },
    ];
    dbMock.getUnprocessedNewsItems.mockResolvedValueOnce(unprocessedItems);
    dbMock.reserveNewsItemsForAi.mockResolvedValueOnce(["item-1"]);
    aiMock.processNewsItems.mockResolvedValueOnce({
      events: [
        {
          newsItemId: "item-1",
          title: "Short Title",
          category: "politics",
          severity: "medium",
          locationLabel: "London, UK",
          publishedAt: "2024-01-01T00:00:00.000Z",
          skipped: false,
        },
      ],
      failed: 0,
    });

    const job = new NewsJob(
      loggerMock as never,
      dbMock as never,
      aiMock as never
    );
    await job.run();

    expect(dbMock.getUnprocessedNewsItems).toHaveBeenCalledOnce();
    expect(dbMock.reserveNewsItemsForAi).toHaveBeenCalledWith(["item-1"]);
    expect(aiMock.processNewsItems).toHaveBeenCalledWith(unprocessedItems);
    expect(
      dbMock.reserveNewsItemsForAi.mock.invocationCallOrder[0]
    ).toBeLessThan(aiMock.processNewsItems.mock.invocationCallOrder[0] ?? 0);
    expect(dbMock.upsertEvents).toHaveBeenCalledOnce();
    expect(loggerMock.info).toHaveBeenCalledWith(
      "news job completed",
      expect.objectContaining({
        unprocessedItems: 1,
        reservedForAi: 1,
        aiProcessed: 1,
        eventsUpserted: expect.any(Number) as number,
      })
    );
  });

  it("skips AI work for items this run did not reserve", async () => {
    fetchMock.mockImplementation(() => new Response("<rss/>", { status: 200 }));
    const unprocessedItems = [
      {
        id: "item-1",
        title: "Reserved Elsewhere",
        source: "test",
        publishedAt: "2024-01-01T00:00:00.000Z",
        link: "https://example.com/1",
      },
      {
        id: "item-2",
        title: "Still Ours",
        source: "test",
        publishedAt: "2024-01-01T00:00:00.000Z",
        link: "https://example.com/2",
      },
    ];
    dbMock.getUnprocessedNewsItems.mockResolvedValueOnce(unprocessedItems);
    dbMock.reserveNewsItemsForAi.mockResolvedValueOnce(["item-2"]);
    aiMock.processNewsItems.mockResolvedValueOnce({
      events: [
        {
          newsItemId: "item-2",
          title: "Still Ours",
          category: "politics",
          severity: "medium",
          locationLabel: null,
          publishedAt: "2024-01-01T00:00:00.000Z",
          skipped: false,
        },
      ],
      failed: 0,
    });

    const job = new NewsJob(
      loggerMock as never,
      dbMock as never,
      aiMock as never
    );
    await job.run();

    expect(aiMock.processNewsItems).toHaveBeenCalledWith([unprocessedItems[1]]);
    expect(dbMock.upsertEvents).toHaveBeenCalledWith([
      expect.objectContaining({ newsItemId: "item-2" }),
    ]);
    expect(loggerMock.info).toHaveBeenCalledWith(
      "news job completed",
      expect.objectContaining({
        reservedForAi: 1,
        aiProcessed: 1,
      })
    );
  });

  it("handles a feed failure gracefully", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Not Found", { status: 404 }));

    const job = new NewsJob(
      loggerMock as never,
      dbMock as never,
      aiMock as never
    );
    await job.run();

    expect(dbMock.upsertNewsItems).toHaveBeenCalledWith([]);
    expect(loggerMock.info).toHaveBeenCalledWith(
      "news job completed",
      expect.objectContaining({ totalItems: 0, services: 1 })
    );
  });

  it("handles all services failing gracefully", async () => {
    fetchMock.mockRejectedValue(new Error("network timeout"));

    const job = new NewsJob(
      loggerMock as never,
      dbMock as never,
      aiMock as never
    );
    await job.run();

    expect(dbMock.upsertNewsItems).toHaveBeenCalledWith([]);
    expect(loggerMock.info).toHaveBeenCalledWith(
      "news job completed",
      expect.objectContaining({ totalItems: 0 })
    );
  });
});
