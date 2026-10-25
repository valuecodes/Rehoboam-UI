import { AiClient } from "~/clients/ai-client";

import {
  createLoggerMock,
  makeAiResponse,
  makeItem,
} from "./ai-client-fixtures";

const loggerMock = createLoggerMock();

describe("AiClient prompt injection defense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("accepts common place punctuation in AI location output", async () => {
    const aiMock = {
      run: vi.fn().mockResolvedValue({
        output_text: makeAiResponse([
          {
            id: "item-1",
            include: true,
            title: "Safe Title 1",
            location: "Trinidad & Tobago",
            severity: "low",
            category: "general",
          },
          {
            id: "item-2",
            include: true,
            title: "Safe Title 2",
            location: "Côte d’Ivoire",
            severity: "medium",
            category: "general",
          },
          {
            id: "item-3",
            include: true,
            title: "Safe Title 3",
            location: "Tel Aviv/Jerusalem",
            severity: "high",
            category: "politics",
          },
        ]),
      }),
    };

    const client = new AiClient(aiMock as never, loggerMock as never);
    const result = await client.processNewsItems([
      makeItem("item-1", "Original Title 1"),
      makeItem("item-2", "Original Title 2"),
      makeItem("item-3", "Original Title 3"),
    ]);

    expect(result.failed).toBe(0);
    expect(result.events).toEqual([
      expect.objectContaining({
        newsItemId: "item-1",
        locationLabel: "Trinidad & Tobago",
        skipped: false,
      }),
      expect.objectContaining({
        newsItemId: "item-2",
        locationLabel: "Côte d’Ivoire",
        skipped: false,
      }),
      expect.objectContaining({
        newsItemId: "item-3",
        locationLabel: "Tel Aviv/Jerusalem",
        skipped: false,
      }),
    ]);
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
