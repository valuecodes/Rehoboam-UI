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

vi.mock("../jobs/news/services/cnn-service", () => ({
  CnnNewsService: MockService,
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

    const job = new NewsJob(loggerMock as never, dbMock as never);
    await job.run();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(dbMock.upsertNewsItems).toHaveBeenCalledOnce();
    expect(dbMock.deleteOldNewsItems).toHaveBeenCalledWith(200);
    expect(loggerMock.info).toHaveBeenCalledWith(
      "news job completed",
      expect.objectContaining({ totalItems: 2, deletedCount: 0, failed: 0 })
    );
  });

  it("continues when one service fails", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("<rss/>", { status: 200 }))
      .mockResolvedValueOnce(new Response("Not Found", { status: 404 }));

    const job = new NewsJob(loggerMock as never, dbMock as never);
    await job.run();

    expect(dbMock.upsertNewsItems).toHaveBeenCalledOnce();
    expect(loggerMock.info).toHaveBeenCalledWith(
      "news job completed",
      expect.objectContaining({ totalItems: 1 })
    );
  });

  it("handles all services failing gracefully", async () => {
    fetchMock.mockRejectedValue(new Error("network timeout"));

    const job = new NewsJob(loggerMock as never, dbMock as never);
    await job.run();

    expect(dbMock.upsertNewsItems).toHaveBeenCalledWith([]);
    expect(loggerMock.info).toHaveBeenCalledWith(
      "news job completed",
      expect.objectContaining({ totalItems: 0 })
    );
  });
});
