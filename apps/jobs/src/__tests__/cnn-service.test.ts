import { CnnNewsService } from "../jobs/news/services/cnn-service";

const loggerMock = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const CNN_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:media="http://search.yahoo.com/mrss/" version="2.0">
  <channel>
    <title>CNN.com</title>
    <item>
      <title>First CNN Article</title>
      <link>https://www.cnn.com/2024/01/01/article1</link>
      <guid isPermaLink="true">https://www.cnn.com/2024/01/01/article1</guid>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      <description>First CNN description</description>
      <media:group>
        <media:content medium="image" url="https://cdn.cnn.com/img1-super.jpg" height="619" width="1100" type="image/jpeg"/>
        <media:content medium="image" url="https://cdn.cnn.com/img1-small.jpg" height="300" width="300" type="image/jpeg"/>
      </media:group>
    </item>
    <item>
      <title>Second CNN Article</title>
      <link>https://www.cnn.com/2024/01/02/article2</link>
      <guid isPermaLink="true">https://www.cnn.com/2024/01/02/article2</guid>
      <media:group>
        <media:content medium="image" url="https://cdn.cnn.com/img2.jpg" height="619" width="1100"/>
      </media:group>
    </item>
  </channel>
</rss>`;

describe("CnnNewsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses CNN RSS feed", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(CNN_RSS, { status: 200 }));

    const service = new CnnNewsService(loggerMock as never);
    const items = await service.fetch();

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      id: expect.stringMatching(/^[0-9a-f]{64}$/),
      title: "First CNN Article",
      source: "cnn",
      publishedAt: "2024-01-01T12:00:00.000Z",
      link: "https://www.cnn.com/2024/01/01/article1",
      description: "First CNN description",
    });
  });

  it("uses the expected feed URL", () => {
    const service = new CnnNewsService(loggerMock as never);

    expect(service.url).toBe("http://rss.cnn.com/rss/cnn_topstories.rss");
  });

  it("extracts guid from object form with isPermaLink", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(CNN_RSS, { status: 200 }));

    const service = new CnnNewsService(loggerMock as never);
    const items = await service.fetch();

    expect(items[0]?.id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles items without pubDate", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(CNN_RSS, { status: 200 }));

    const service = new CnnNewsService(loggerMock as never);
    const items = await service.fetch();

    expect(items[1]?.publishedAt).toBeDefined();
    expect(items[1]?.description).toBeUndefined();
  });

  it("returns empty array for invalid feed structure", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("<notRss/>", { status: 200 })
    );

    const service = new CnnNewsService(loggerMock as never);
    const items = await service.fetch();

    expect(items).toHaveLength(0);
    expect(loggerMock.warn).toHaveBeenCalledWith("invalid CNN feed structure", {
      source: "cnn",
    });
  });
});
