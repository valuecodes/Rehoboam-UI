import { NewsService } from "../jobs/news/services/news-service";
import type { NewsItem } from "@repo/types";

class TestNewsService extends NewsService {
  readonly slug = "test-source";
  readonly url = "https://example.com/rss.xml";

  protected async parse(): Promise<NewsItem[]> {
    return [
      {
        id: await this.hashId("test-1"),
        title: "Test Article",
        source: this.slug,
        publishedAt: "2024-01-01T12:00:00.000Z",
        link: "https://example.com/1",
        description: "A test article",
      },
    ];
  }
}

const loggerMock = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("NewsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and delegates to parse on success", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("<rss/>", { status: 200 }));

    const service = new TestNewsService(loggerMock as never);
    const items = await service.fetch();

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toMatch(/^[0-9a-f]{64}$/);
    expect(loggerMock.info).toHaveBeenCalledWith(
      "feed parsed",
      expect.objectContaining({ source: "test-source", itemCount: 1 })
    );
  });

  it("returns empty array on HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("Not Found", { status: 404 })
    );

    const service = new TestNewsService(loggerMock as never);
    const items = await service.fetch();

    expect(items).toHaveLength(0);
    expect(loggerMock.error).toHaveBeenCalledWith(
      "feed fetch failed",
      expect.objectContaining({ status: 404, source: "test-source" })
    );
  });

  it("returns empty array on network error", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network timeout"));

    const service = new TestNewsService(loggerMock as never);
    const items = await service.fetch();

    expect(items).toHaveLength(0);
    expect(loggerMock.error).toHaveBeenCalledWith(
      "feed processing failed",
      expect.objectContaining({ error: "network timeout" })
    );
  });
});
