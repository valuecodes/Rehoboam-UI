import type { NewsItem } from "@repo/types";

type AiResponseItem =
  | {
      id: string;
      include: true;
      title: string;
      location: string | null;
      severity: string;
      category: string;
    }
  | { id: string; include: false };

const createLoggerMock = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

const makeItem = (id: string, title: string): NewsItem => ({
  id,
  title,
  source: "bbc-world",
  publishedAt: "2024-01-01T00:00:00.000Z",
  link: `https://example.com/${id}`,
  description: `Description for ${title}`,
});

const makeAiResponse = (items: AiResponseItem[]) =>
  JSON.stringify({
    items,
  });

export { createLoggerMock, makeAiResponse, makeItem };
