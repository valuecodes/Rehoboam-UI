import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

import type { Logger } from "@repo/logger";

import type { NewsItem } from "../types";
import { NewsService } from "./news-service";

const CnnItemSchema = z.object({
  guid: z.union([z.string(), z.object({ "#text": z.string() })]),
  title: z.string(),
  link: z.string(),
  pubDate: z.string().optional(),
  description: z.string().optional(),
});

const CnnFeedSchema = z.object({
  rss: z.object({
    channel: z.object({
      item: z.union([CnnItemSchema, z.array(CnnItemSchema)]).optional(),
    }),
  }),
});

export class CnnNewsService extends NewsService {
  readonly slug = "cnn";
  readonly url = "http://rss.cnn.com/rss/cnn_topstories.rss";

  private readonly xmlParser: XMLParser;

  constructor(logger: Logger) {
    super(logger);
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: false,
    });
  }

  protected async parse(xml: string): Promise<NewsItem[]> {
    const parsed: unknown = this.xmlParser.parse(xml);
    const result = CnnFeedSchema.safeParse(parsed);

    if (!result.success) {
      this.logger.warn("invalid CNN feed structure", { source: this.slug });
      return [];
    }

    const rawItems = result.data.rss.channel.item;
    const items = Array.isArray(rawItems)
      ? rawItems
      : rawItems
        ? [rawItems]
        : [];

    return Promise.all(
      items.map(async (item) => {
        const rawId =
          typeof item.guid === "string" ? item.guid : item.guid["#text"];

        return {
          id: await this.hashId(rawId),
          title: item.title,
          source: this.slug,
          publishedAt: item.pubDate
            ? new Date(item.pubDate).toISOString()
            : new Date().toISOString(),
          link: item.link,
          description: item.description,
        };
      }),
    );
  }
}
