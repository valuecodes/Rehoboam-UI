import type { Logger } from "@repo/logger";
import type { NewsItem } from "@repo/types";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

import { NewsService } from "./news-service";

const BbcItemSchema = z.object({
  guid: z.union([z.object({ "#text": z.string() }), z.string()]),
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

    const mapped = await Promise.all(
      items.map(async (item) => {
        const guidText =
          typeof item.guid === "string" ? item.guid : item.guid["#text"];
        const date = new Date(item.pubDate);

        if (Number.isNaN(date.getTime())) {
          this.logger.warn("skipping item with invalid pubDate", {
            source: this.slug,
            title: item.title,
          });
          return null;
        }

        return {
          id: await this.hashId(guidText),
          title: item.title,
          source: this.slug,
          publishedAt: date.toISOString(),
          link: item.link,
          ...(item.description !== undefined && {
            description: item.description,
          }),
        } satisfies NewsItem;
      })
    );

    return mapped.filter((item): item is NewsItem => item !== null);
  }
}
