import type { Logger } from "@repo/logger";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { newsItems } from "@repo/db/schema";
import type { NewsItem } from "@repo/types";

export class DatabaseClient {
  private readonly db;

  constructor(
    d1: D1Database,
    private readonly logger: Logger
  ) {
    this.db = drizzle(d1, { schema: { newsItems } });
  }

  async upsertNewsItems(items: NewsItem[]): Promise<number> {
    if (items.length === 0) {
      this.logger.debug("no news items to upsert");
      return 0;
    }

    const now = new Date().toISOString();
    let processedCount = 0;
    const batchSize = 10;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      const values = batch.map((item) => ({
        id: item.id,
        title: item.title,
        source: item.source,
        publishedAt: item.publishedAt,
        link: item.link,
        description: item.description ?? null,
        createdAt: now,
        updatedAt: now,
      }));

      await this.db
        .insert(newsItems)
        .values(values)
        .onConflictDoUpdate({
          target: newsItems.id,
          set: {
            title: sql`excluded.title`,
            source: sql`excluded.source`,
            publishedAt: sql`excluded.published_at`,
            link: sql`excluded.link`,
            description: sql`excluded.description`,
            updatedAt: sql`excluded.updated_at`,
          },
        });

      processedCount += batch.length;
    }

    this.logger.info("news items upserted", { count: processedCount });
    return processedCount;
  }

  async deleteOldNewsItems(maxItems: number): Promise<number> {
    if (maxItems < 1) {
      throw new Error("maxItems must be at least 1");
    }

    const result = await this.db.run(
      sql`DELETE FROM news_items WHERE id NOT IN (SELECT id FROM news_items ORDER BY published_at DESC, id DESC LIMIT ${maxItems})`
    );

    const deletedCount = result.meta.changes;

    this.logger.info("old news items deleted", { deletedCount, maxItems });
    return deletedCount;
  }
}
