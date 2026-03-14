import type { NewsItem } from "@repo/types";

import { AiClient } from "../clients/ai-client";

const loggerMock = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const makeItem = (id: string, title: string): NewsItem => ({
  id,
  title,
  source: "bbc-world",
  publishedAt: "2024-01-01T00:00:00.000Z",
  link: `https://example.com/${id}`,
  description: `Description for ${title}`,
});

const makeAiResponse = (
  items: (
    | {
        id: string;
        include: true;
        title: string;
        location: string | null;
        severity: string;
        category: string;
      }
    | { id: string; include: false }
  )[]
) =>
  JSON.stringify({
    items,
  });

describe("AiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty result for empty input", async () => {
    const aiMock = { run: vi.fn() };
    const client = new AiClient(aiMock as never, loggerMock as never);

    const result = await client.processNewsItems([]);

    expect(result).toEqual({ events: [], failed: 0 });
    expect(aiMock.run).not.toHaveBeenCalled();
    expect(loggerMock.debug).toHaveBeenCalledWith(
      "no news items to process with AI"
    );
  });

  it("processes items and maps included results", async () => {
    const aiMock = {
      run: vi.fn().mockResolvedValue({
        response: {
          items: [
            {
              id: "item-1",
              include: true,
              title: "Short Title",
              location: "London, UK",
              severity: "high",
              category: "conflict",
            },
          ],
        },
      }),
    };

    const client = new AiClient(aiMock as never, loggerMock as never);
    const result = await client.processNewsItems([
      makeItem("item-1", "Long Original Title About Something"),
    ]);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      newsItemId: "item-1",
      title: "Short Title",
      category: "conflict",
      severity: "high",
      locationLabel: "London, UK",
      publishedAt: "2024-01-01T00:00:00.000Z",
      skipped: false,
    });
    expect(result.failed).toBe(0);
  });

  it("marks skipped items with skipped: true", async () => {
    const aiMock = {
      run: vi.fn().mockResolvedValue({
        output_text: makeAiResponse([{ id: "item-1", include: false }]),
      }),
    };

    const client = new AiClient(aiMock as never, loggerMock as never);
    const result = await client.processNewsItems([
      makeItem("item-1", "Sports Game Result"),
    ]);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual(
      expect.objectContaining({
        newsItemId: "item-1",
        skipped: true,
        category: "general",
        severity: "low",
        locationLabel: null,
      })
    );
  });

  it("batches items into groups of 5", async () => {
    const aiMock = {
      run: vi.fn().mockResolvedValue({
        output_text: makeAiResponse([]),
      }),
    };

    const items = Array.from({ length: 12 }, (_, i) =>
      makeItem(`item-${String(i)}`, `Article ${String(i)}`)
    );

    const client = new AiClient(aiMock as never, loggerMock as never);
    const result = await client.processNewsItems(items);

    expect(aiMock.run).toHaveBeenCalledTimes(3);
    expect(result.events).toHaveLength(12);
  });

  it("uses fallback when AI call throws", async () => {
    const aiMock = {
      run: vi.fn().mockRejectedValue(new Error("AI service unavailable")),
    };

    const client = new AiClient(aiMock as never, loggerMock as never);
    const result = await client.processNewsItems([
      makeItem("item-1", "Test Article"),
    ]);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      newsItemId: "item-1",
      title: "Test Article",
      category: "general",
      severity: "medium",
      locationLabel: null,
      publishedAt: "2024-01-01T00:00:00.000Z",
      skipped: false,
    });
    expect(result.failed).toBe(1);
    expect(loggerMock.warn).toHaveBeenCalledWith(
      "AI batch processing failed, using fallback",
      expect.objectContaining({
        error: "AI service unavailable",
      })
    );
  });

  it("uses fallback when AI returns invalid JSON", async () => {
    const aiMock = {
      run: vi.fn().mockResolvedValue({
        output_text: "not valid json",
      }),
    };

    const client = new AiClient(aiMock as never, loggerMock as never);
    const result = await client.processNewsItems([
      makeItem("item-1", "Test Article"),
    ]);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual(
      expect.objectContaining({
        newsItemId: "item-1",
        title: "Test Article",
        skipped: false,
      })
    );
    expect(result.failed).toBe(1);
  });

  it("extracts JSON when the model prepends commentary", async () => {
    const aiMock = {
      run: vi.fn().mockResolvedValue({
        text: 'Reasoning before JSON {"items":[{"id":"item-1","include":true,"title":"Parsed Title","location":"Manama, Bahrain","severity":"high","category":"conflict"}]}',
      }),
    };

    const client = new AiClient(aiMock as never, loggerMock as never);
    const result = await client.processNewsItems([
      makeItem("item-1", "Test Article"),
    ]);

    expect(result.events).toEqual([
      {
        newsItemId: "item-1",
        title: "Parsed Title",
        category: "conflict",
        severity: "high",
        locationLabel: "Manama, Bahrain",
        publishedAt: "2024-01-01T00:00:00.000Z",
        skipped: false,
      },
    ]);
    expect(result.failed).toBe(0);
  });

  it("falls back to nested output content when top-level text is empty", async () => {
    const aiMock = {
      run: vi.fn().mockResolvedValue({
        text: "",
        output: [
          {
            content: [
              {
                text: '{"items":[{"id":"item-1","include":true,"title":"Nested Output","location":"Tehran, Iran","severity":"high","category":"conflict"}]}',
              },
            ],
          },
        ],
      }),
    };

    const client = new AiClient(aiMock as never, loggerMock as never);
    const result = await client.processNewsItems([
      makeItem("item-1", "Test Article"),
    ]);

    expect(result.events).toEqual([
      {
        newsItemId: "item-1",
        title: "Nested Output",
        category: "conflict",
        severity: "high",
        locationLabel: "Tehran, Iran",
        publishedAt: "2024-01-01T00:00:00.000Z",
        skipped: false,
      },
    ]);
    expect(result.failed).toBe(0);
  });

  it("ignores AI response items with unknown IDs", async () => {
    const aiMock = {
      run: vi.fn().mockResolvedValue({
        output_text: makeAiResponse([
          {
            id: "item-1",
            include: true,
            title: "Valid",
            location: null,
            severity: "low",
            category: "general",
          },
          {
            id: "unknown-id",
            include: true,
            title: "Ghost",
            location: null,
            severity: "low",
            category: "general",
          },
        ]),
      }),
    };

    const client = new AiClient(aiMock as never, loggerMock as never);
    const result = await client.processNewsItems([
      makeItem("item-1", "Test Article"),
    ]);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.newsItemId).toBe("item-1");
  });

  it("uses fallback for batch items omitted from AI response", async () => {
    const aiMock = {
      run: vi.fn().mockResolvedValue({
        output_text: makeAiResponse([
          {
            id: "item-1",
            include: true,
            title: "Parsed Title",
            location: "Berlin, Germany",
            severity: "high",
            category: "politics",
          },
        ]),
      }),
    };

    const client = new AiClient(aiMock as never, loggerMock as never);
    const result = await client.processNewsItems([
      makeItem("item-1", "Article One"),
      makeItem("item-2", "Article Two"),
      makeItem("item-3", "Article Three"),
    ]);

    expect(result.events).toHaveLength(3);
    expect(result.events[0]).toEqual(
      expect.objectContaining({
        newsItemId: "item-1",
        title: "Parsed Title",
        category: "politics",
        severity: "high",
        skipped: false,
      })
    );
    expect(result.events[1]).toEqual(
      expect.objectContaining({
        newsItemId: "item-2",
        title: "Article Two",
        category: "general",
        severity: "medium",
        skipped: false,
      })
    );
    expect(result.events[2]).toEqual(
      expect.objectContaining({
        newsItemId: "item-3",
        title: "Article Three",
        category: "general",
        severity: "medium",
        skipped: false,
      })
    );
    expect(loggerMock.warn).toHaveBeenCalledWith(
      "AI omitted item from response, using fallback",
      { newsItemId: "item-2" }
    );
    expect(result.failed).toBe(0);
  });

  describe("prompt injection defense", () => {
    it("sanitizes title with null bytes before sending to AI", async () => {
      const aiMock = {
        run: vi.fn().mockResolvedValue({ output_text: makeAiResponse([]) }),
      };

      const client = new AiClient(aiMock as never, loggerMock as never);
      await client.processNewsItems([
        makeItem("item-1", "Hello\x00World\x01Injected"),
      ]);

      const [, request] = aiMock.run.mock.calls[0] as [
        string,
        { messages: { role: string; content: string }[] },
      ];
      const userContent = request.messages[1]?.content ?? "";
      expect(userContent).toContain("HelloWorldInjected");
      expect(userContent).not.toContain("\x00");
      expect(userContent).not.toContain("\x01");
    });

    it("truncates title over 200 chars before sending to AI", async () => {
      const aiMock = {
        run: vi.fn().mockResolvedValue({ output_text: makeAiResponse([]) }),
      };

      const longTitle = "a".repeat(250);
      const client = new AiClient(aiMock as never, loggerMock as never);
      await client.processNewsItems([makeItem("item-1", longTitle)]);

      const [, request] = aiMock.run.mock.calls[0] as [
        string,
        { messages: { role: string; content: string }[] },
      ];
      const userContent = request.messages[1]?.content ?? "";
      const parsed = JSON.parse(userContent) as { title: string }[];
      expect(parsed[0]?.title).toHaveLength(200);
    });

    it("falls back when AI returns title longer than 100 chars", async () => {
      const aiMock = {
        run: vi.fn().mockResolvedValue({
          output_text: makeAiResponse([
            {
              id: "item-1",
              include: true,
              title: "a".repeat(101),
              location: null,
              severity: "low",
              category: "general",
            },
          ]),
        }),
      };

      const client = new AiClient(aiMock as never, loggerMock as never);
      const result = await client.processNewsItems([
        makeItem("item-1", "Original Title"),
      ]);

      expect(result.failed).toBe(1);
      expect(result.events[0]).toEqual(
        expect.objectContaining({
          newsItemId: "item-1",
          title: "Original Title",
          skipped: false,
        })
      );
    });

    it("falls back when AI returns location with disallowed characters", async () => {
      const aiMock = {
        run: vi.fn().mockResolvedValue({
          output_text: makeAiResponse([
            {
              id: "item-1",
              include: true,
              title: "Safe Title",
              location: "<script>alert('xss')</script>",
              severity: "low",
              category: "general",
            },
          ]),
        }),
      };

      const client = new AiClient(aiMock as never, loggerMock as never);
      const result = await client.processNewsItems([
        makeItem("item-1", "Original Title"),
      ]);

      expect(result.failed).toBe(1);
    });

    it("accepts Unicode location names from AI output", async () => {
      const aiMock = {
        run: vi.fn().mockResolvedValue({
          output_text: makeAiResponse([
            {
              id: "item-1",
              include: true,
              title: "Safe Title",
              location: "São Paulo, Brasil",
              severity: "low",
              category: "general",
            },
          ]),
        }),
      };

      const client = new AiClient(aiMock as never, loggerMock as never);
      const result = await client.processNewsItems([
        makeItem("item-1", "Original Title"),
      ]);

      expect(result.failed).toBe(0);
      expect(result.events[0]).toEqual(
        expect.objectContaining({
          newsItemId: "item-1",
          locationLabel: "São Paulo, Brasil",
          skipped: false,
        })
      );
    });

    it("sanitizes title in omit-fallback path", async () => {
      const aiMock = {
        run: vi.fn().mockResolvedValue({
          output_text: makeAiResponse([]),
        }),
      };

      const client = new AiClient(aiMock as never, loggerMock as never);
      const result = await client.processNewsItems([
        makeItem("item-1", "<b>Malicious\x00Title</b>"),
      ]);

      expect(result.events[0]?.title).toBe("MaliciousTitle");
    });

    it("sanitizes title in full AI failure fallback path", async () => {
      const aiMock = {
        run: vi.fn().mockRejectedValue(new Error("AI service unavailable")),
      };

      const client = new AiClient(aiMock as never, loggerMock as never);
      const result = await client.processNewsItems([
        makeItem("item-1", "<b>Injected\x00Title</b>"),
      ]);

      expect(result.events[0]?.title).toBe("InjectedTitle");
    });
  });

  it("passes correct request shape to AI", async () => {
    const aiMock = {
      run: vi.fn().mockResolvedValue({
        output_text: makeAiResponse([]),
      }),
    };

    const client = new AiClient(aiMock as never, loggerMock as never);
    await client.processNewsItems([makeItem("item-1", "Test")]);

    expect(aiMock.run).toHaveBeenCalledWith(
      "@cf/meta/llama-3.1-8b-instruct-fast",
      expect.anything()
    );

    const [, request] = aiMock.run.mock.calls[0] as [
      string,
      {
        messages: { role: string; content: string }[];
        max_output_tokens: number;
        temperature: number;
        response_format: {
          type: string;
          json_schema: unknown;
        };
      },
    ];

    expect(request.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "system" }),
        expect.objectContaining({ role: "user" }),
      ])
    );
    expect(request.max_output_tokens).toBe(2048);
    expect(request.temperature).toBe(0.1);
    expect(request.response_format.type).toBe("json_schema");
  });
});
