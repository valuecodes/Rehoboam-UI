import type { Logger } from "@repo/logger";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

import type { NewsItem } from "../types";
import { NewsService } from "./news-service";

const BbcItemSchema = z.object({
  guid: z.object({ "#text": z.string() }),
  title: z.string(),
  link: z.string(),
  pubDate: z.string(),
  description: z.string().optional(),
});

const BbcFeedSchema = z.object({
  rss: z.object({
    channel: z.object({
      item: z.union([BbcItemSchema, z.array(BbcItemSchema)]).optional(),
    }),
  }),
});

export class BbcNewsService extends NewsService {
  readonly slug = "bbc-world";
  readonly url = "https://feeds.bbci.co.uk/news/world/rss.xml";

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
    const result = BbcFeedSchema.safeParse(parsed);

    if (!result.success) {
      this.logger.warn("invalid BBC feed structure", { source: this.slug });
      return [];
    }

    const rawItems = result.data.rss.channel.item;
    const items = Array.isArray(rawItems)
      ? rawItems
      : rawItems
        ? [rawItems]
        : [];

    return Promise.all(
      items.map(async (item) => ({
        id: await this.hashId(item.guid["#text"]),
        title: item.title,
        source: this.slug,
        publishedAt: new Date(item.pubDate).toISOString(),
        link: item.link,
        description: item.description,
      }))
    );
  }
}
