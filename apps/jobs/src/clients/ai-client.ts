import type { Logger } from "@repo/logger";
import { CategorySchema } from "@repo/types";
import type { Category, NewsItem } from "@repo/types";
import { z } from "zod";

import {
  sanitizeNewsInput,
  sanitizeText,
  stripDangerousHtml,
  stripHtml,
} from "../lib/sanitize";

const BATCH_SIZE = 5;
const MAX_OUTPUT_TOKENS = 2048;
const TEMPERATURE = 0.1;
const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const LOCATION_TEXT_RE = /^[\p{L}\p{N} ,.&/'’()-]+$/u;

const INSTRUCTIONS = `You are a news analysis system. You receive an array of news items and return a JSON object with an "items" array.

For each news item:
1. Decide relevance: filter OUT sports, entertainment, lifestyle, human interest, celebrity news. Set "include": false for these.
2. For relevant items, produce:
   - "title": a concise, factual title (max 50 chars, no clickbait)
   - "location": the primary city/country mentioned, or null if unclear
   - "severity": "low" (routine), "medium" (significant), "high" (major crisis), "critical" (war/disaster escalation)
   - "category": one of "conflict", "politics", "climate", "health", "economy", "diplomacy", "disaster", "science", "general"
3. For filtered items, only "id" and "include": false are needed.

Return ONLY valid JSON. Do not include commentary, explanation, markdown, or any text before or after the JSON.

Response schema:
{"items": [{"id": "...", "include": true, "title": "...", "location": "City, Country", "severity": "medium", "category": "politics"}, {"id": "...", "include": false}]}`;

const AI_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        oneOf: [
          {
            type: "object",
            properties: {
              id: { type: "string" },
              include: { type: "boolean", const: true },
              title: { type: "string" },
              location: { type: ["string", "null"] },
              severity: {
                type: "string",
                enum: ["low", "medium", "high", "critical"],
              },
              category: {
                type: "string",
                enum: [
                  "conflict",
                  "politics",
                  "climate",
                  "health",
                  "economy",
                  "diplomacy",
                  "disaster",
                  "science",
                  "general",
                ],
              },
            },
            required: [
              "id",
              "include",
              "title",
              "location",
              "severity",
              "category",
            ],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              id: { type: "string" },
              include: { type: "boolean", const: false },
            },
            required: ["id", "include"],
            additionalProperties: false,
          },
        ],
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

const AiIncludedItemSchema = z.object({
  id: z.string(),
  include: z.literal(true),
  title: z
    .string()
    .max(100)
    .transform(stripHtml)
    .transform((s) => s.trim()),
  location: z
    .string()
    .max(100)
    .transform(stripDangerousHtml)
    .transform((s) => s.trim())
    .refine((s) => LOCATION_TEXT_RE.test(s), {
      message: "Location contains unsupported characters",
    })
    .nullable(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  category: CategorySchema,
});

const AiSkippedItemSchema = z.object({
  id: z.string(),
  include: z.literal(false),
});

const AiResponseSchema = z.object({
  items: z.array(z.union([AiIncludedItemSchema, AiSkippedItemSchema])),
});

export type ProcessedEvent = {
  newsItemId: string;
  title: string;
  category: Category;
  severity: "low" | "medium" | "high" | "critical";
  locationLabel: string | null;
  publishedAt: string;
  skipped: boolean;
};

export type AiProcessingResult = {
  events: ProcessedEvent[];
  failed: number;
};

export type AiProcessor = {
  processNewsItems(items: NewsItem[]): Promise<AiProcessingResult>;
};

export class AiClient implements AiProcessor {
  constructor(
    private readonly ai: Ai,
    private readonly logger: Logger
  ) {}

  async processNewsItems(items: NewsItem[]): Promise<AiProcessingResult> {
    if (items.length === 0) {
      this.logger.debug("no news items to process with AI");
      return { events: [], failed: 0 };
    }

    const allEvents: ProcessedEvent[] = [];
    let failed = 0;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      try {
        const batchEvents = await this.processBatch(batch);
        allEvents.push(...batchEvents);
      } catch (error) {
        this.logger.warn("AI batch processing failed, using fallback", {
          batchIndex: i,
          batchSize: batch.length,
          error: error instanceof Error ? error.message : String(error),
        });
        failed += batch.length;
        allEvents.push(...this.fallbackProcess(batch));
      }
    }

    this.logger.info("AI processing completed", {
      total: items.length,
      processed: allEvents.length,
      skipped: allEvents.filter((e) => e.skipped).length,
      failed,
    });

    return { events: allEvents, failed };
  }

  private async processBatch(batch: NewsItem[]): Promise<ProcessedEvent[]> {
    const batchInput = batch.map((item) => {
      const sanitized = sanitizeNewsInput(item.title, item.description ?? "");
      return {
        id: item.id,
        title: sanitized.title,
        description: sanitized.description,
      };
    });

    const input = JSON.stringify(batchInput);

    let response: unknown;

    try {
      response = await this.ai.run(MODEL as keyof AiModels, {
        messages: [
          {
            role: "system",
            content: INSTRUCTIONS,
          },
          {
            role: "user",
            content: input,
          },
        ],
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: TEMPERATURE,
        response_format: {
          type: "json_schema",
          json_schema: AI_RESPONSE_JSON_SCHEMA,
        },
      });
    } catch (error) {
      this.logger.error("AI run failed", {
        batchSize: batch.length,
        batchIds: batch.map((item) => item.id),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    const parsedJson = this.parseAiResponsePayload(response, batch);

    let parsed: z.infer<typeof AiResponseSchema>;

    try {
      parsed = AiResponseSchema.parse(parsedJson);
    } catch (error) {
      this.logger.error("AI response failed schema validation", {
        batchIds: batch.map((item) => item.id),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    const aiItemMap = new Map(
      parsed.items.map((aiItem) => [aiItem.id, aiItem])
    );

    return batch.map((newsItem) => {
      const aiItem = aiItemMap.get(newsItem.id);

      if (aiItem === undefined) {
        this.logger.warn("AI omitted item from response, using fallback", {
          newsItemId: newsItem.id,
        });
        return {
          newsItemId: newsItem.id,
          title: sanitizeText(newsItem.title, 100),
          category: "general",
          severity: "medium" as const,
          locationLabel: null,
          publishedAt: newsItem.publishedAt,
          skipped: false,
        };
      }

      if (aiItem.include) {
        return {
          newsItemId: newsItem.id,
          title: aiItem.title,
          category: aiItem.category,
          severity: aiItem.severity,
          locationLabel: aiItem.location,
          publishedAt: newsItem.publishedAt,
          skipped: false,
        };
      }

      return {
        newsItemId: newsItem.id,
        title: sanitizeText(newsItem.title, 100),
        category: "general",
        severity: "low" as const,
        locationLabel: null,
        publishedAt: newsItem.publishedAt,
        skipped: true,
      };
    });
  }

  private fallbackProcess(batch: NewsItem[]): ProcessedEvent[] {
    return batch.map((item) => ({
      newsItemId: item.id,
      title: sanitizeText(item.title, 100),
      category: "general",
      severity: "medium" as const,
      locationLabel: null,
      publishedAt: item.publishedAt,
      skipped: false,
    }));
  }

  private parseAiResponsePayload(
    response: unknown,
    batch: NewsItem[]
  ): unknown {
    if (
      typeof response === "object" &&
      response !== null &&
      "response" in response
    ) {
      return response.response;
    }

    const outputText = this.getOutputText(response);
    const outputPreview = outputText.slice(0, 500);
    const jsonText = this.extractJsonText(outputText);

    if (jsonText !== outputText) {
      this.logger.warn("AI response included non-JSON text; extracted JSON", {
        batchIds: batch.map((item) => item.id),
      });
    }

    try {
      return JSON.parse(jsonText);
    } catch (error) {
      this.logger.error("AI returned invalid JSON", {
        batchIds: batch.map((item) => item.id),
        outputPreview,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private getOutputText(response: unknown): string {
    if (typeof response !== "object" || response === null) {
      return "";
    }

    if ("output_text" in response && typeof response.output_text === "string") {
      const outputText = response.output_text.trim();

      if (outputText.length > 0) {
        return outputText;
      }
    }

    if ("text" in response && typeof response.text === "string") {
      const text = response.text.trim();

      if (text.length > 0) {
        return text;
      }
    }

    if ("output" in response) {
      return this.extractOutputText(response.output);
    }

    return "";
  }

  private extractOutputText(output: unknown): string {
    if (!Array.isArray(output)) {
      return "";
    }

    const chunks = output.flatMap((item) => {
      if (typeof item !== "object" || item === null) {
        return [];
      }

      const itemRecord = item as Record<string, unknown>;

      if (!("content" in itemRecord) || !Array.isArray(itemRecord.content)) {
        return [];
      }

      return itemRecord.content.flatMap((content: unknown) => {
        if (typeof content !== "object" || content === null) {
          return [];
        }

        const contentRecord = content as Record<string, unknown>;

        if ("text" in contentRecord && typeof contentRecord.text === "string") {
          const text = contentRecord.text.trim();
          return text.length > 0 ? [text] : [];
        }

        if (!("text" in contentRecord)) {
          return [];
        }

        const contentText = contentRecord.text;

        if (typeof contentText !== "object" || contentText === null) {
          return [];
        }

        const contentTextRecord = contentText as Record<string, unknown>;

        if (
          !("value" in contentTextRecord) ||
          typeof contentTextRecord.value !== "string"
        ) {
          return [];
        }

        const value = contentTextRecord.value.trim();
        return value.length > 0 ? [value] : [];
      });
    });

    return chunks.join("");
  }

  private extractJsonText(text: string): string {
    const trimmed = text.trim();
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      return trimmed;
    }

    return trimmed.slice(firstBrace, lastBrace + 1);
  }
}
