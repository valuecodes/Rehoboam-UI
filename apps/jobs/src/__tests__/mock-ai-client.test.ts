import type { NewsItem } from "@repo/types";

import { MockAiClient } from "../clients/mock-ai-client";

const loggerMock = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const makeItem = (
  id: string,
  title: string,
  description?: string
): NewsItem => ({
  id,
  title,
  source: "bbc-world",
  publishedAt: "2024-01-01T00:00:00.000Z",
  link: `https://example.com/${id}`,
  description,
});

describe("MockAiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips obvious sports and entertainment items", async () => {
    const client = new MockAiClient(loggerMock as never);

    const result = await client.processNewsItems([
      makeItem("item-1", "Sports roundup", "Football results"),
    ]);

    expect(result).toEqual({
      events: [
        expect.objectContaining({
          newsItemId: "item-1",
          skipped: true,
          severity: "low",
          category: "general",
        }),
      ],
      failed: 0,
    });
  });

  it("classifies topical stories deterministically", async () => {
    const client = new MockAiClient(loggerMock as never);

    const result = await client.processNewsItems([
      makeItem(
        "item-2",
        "Emergency summit after sanctions",
        "Leaders meet after a diplomatic crisis"
      ),
    ]);

    expect(result).toEqual({
      events: [
        expect.objectContaining({
          newsItemId: "item-2",
          skipped: false,
          severity: "critical",
          category: "diplomacy",
        }),
      ],
      failed: 0,
    });
  });
});
