import { BbcNewsService } from "../jobs/news/services/bbc-service";

const loggerMock = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const BBC_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:media="http://search.yahoo.com/mrss/" version="2.0">
  <channel>
    <title>BBC News</title>
    <item>
      <title>First Article</title>
      <description>First article description</description>
      <link>https://www.bbc.com/news/articles/abc123</link>
      <guid isPermaLink="false">https://www.bbc.com/news/articles/abc123#0</guid>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      <media:thumbnail width="240" height="135" url="https://ichef.bbci.co.uk/img1.jpg"/>
    </item>
    <item>
      <title>Second Article</title>
      <description>Second article description</description>
      <link>https://www.bbc.com/news/articles/def456</link>
      <guid isPermaLink="false">https://www.bbc.com/news/articles/def456#0</guid>
      <pubDate>Tue, 02 Jan 2024 12:00:00 GMT</pubDate>
      <media:thumbnail width="240" height="135" url="https://ichef.bbci.co.uk/img2.jpg"/>
    </item>
  </channel>
</rss>`;

describe("BbcNewsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses BBC RSS feed", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(BBC_RSS, { status: 200 }),
    );

    const service = new BbcNewsService(loggerMock as never);
    const items = await service.fetch();

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      id: expect.stringMatching(/^[0-9a-f]{64}$/),
      title: "First Article",
      source: "bbc-world",
      publishedAt: "2024-01-01T12:00:00.000Z",
      link: "https://www.bbc.com/news/articles/abc123",
      description: "First article description",
    });
  });

  it("returns empty array for invalid feed structure", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("<notRss/>", { status: 200 }),
    );

    const service = new BbcNewsService(loggerMock as never);
    const items = await service.fetch();

    expect(items).toHaveLength(0);
    expect(loggerMock.warn).toHaveBeenCalledWith(
      "invalid BBC feed structure",
      { source: "bbc-world" },
    );
  });

  it("returns empty array for empty channel", async () => {
    const xml = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel><title>Empty</title></channel>
    </rss>`;

    vi.mocked(fetch).mockResolvedValue(new Response(xml, { status: 200 }));

    const service = new BbcNewsService(loggerMock as never);
    const items = await service.fetch();

    expect(items).toHaveLength(0);
  });

  it("handles single item feed", async () => {
    const xml = `<?xml version="1.0"?>
    <rss xmlns:media="http://search.yahoo.com/mrss/" version="2.0">
      <channel>
        <item>
          <title>Only One</title>
          <link>https://www.bbc.com/news/articles/single</link>
          <guid isPermaLink="false">single-id</guid>
          <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
        </item>
      </channel>
    </rss>`;

    vi.mocked(fetch).mockResolvedValue(new Response(xml, { status: 200 }));

    const service = new BbcNewsService(loggerMock as never);
    const items = await service.fetch();

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toMatch(/^[0-9a-f]{64}$/);
  });
});
