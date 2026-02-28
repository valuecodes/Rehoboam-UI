import { events, newsItems } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import type { NewsItem } from "@repo/types";
import { and, desc, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import type { ProcessedEvent } from "./ai-client";

export class DatabaseClient {
  private readonly db;

  constructor(
    d1: D1Database,
    private readonly logger: Logger
  ) {
    this.db = drizzle(d1, { schema: { newsItems, events } });
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

  async upsertEvents(items: ProcessedEvent[]): Promise<number> {
    if (items.length === 0) {
      this.logger.debug("no events to upsert");
      return 0;
    }

    const now = new Date().toISOString();
    let processedCount = 0;
    const batchSize = 10;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      const values = batch.map((item) => ({
        id: item.newsItemId,
        newsItemId: item.newsItemId,
        title: item.title,
        category: item.category,
        severity: item.severity,
        locationLabel: item.locationLabel,
        publishedAt: item.publishedAt,
        skipped: item.skipped,
        createdAt: now,
        updatedAt: now,
      }));

      await this.db
        .insert(events)
        .values(values)
        .onConflictDoUpdate({
          target: events.id,
          set: {
            title: sql`excluded.title`,
            category: sql`excluded.category`,
            severity: sql`excluded.severity`,
            locationLabel: sql`excluded.location_label`,
            skipped: sql`excluded.skipped`,
            updatedAt: sql`excluded.updated_at`,
          },
        });

      processedCount += batch.length;
    }

    this.logger.info("events upserted", { count: processedCount });
    return processedCount;
  }

  async reserveNewsItemsForAi(itemIds: string[]): Promise<number> {
    if (itemIds.length === 0) {
      this.logger.debug("no news items to reserve for AI");
      return 0;
    }

    const now = new Date().toISOString();
    let reservedCount = 0;
    const batchSize = 25;

    for (let i = 0; i < itemIds.length; i += batchSize) {
      const batchIds = itemIds.slice(i, i + batchSize);

      await this.db
        .update(newsItems)
        .set({
          aiReservedAt: now,
          updatedAt: now,
        })
        .where(
          and(inArray(newsItems.id, batchIds), isNull(newsItems.aiReservedAt))
        );

      reservedCount += batchIds.length;
    }

    this.logger.info("news items reserved for AI", { count: reservedCount });
    return reservedCount;
  }

  async getUnprocessedNewsItems(): Promise<NewsItem[]> {
    const rows = await this.db
      .select({
        id: newsItems.id,
        title: newsItems.title,
        source: newsItems.source,
        publishedAt: newsItems.publishedAt,
        link: newsItems.link,
        description: newsItems.description,
      })
      .from(newsItems)
      .leftJoin(events, sql`${newsItems.id} = ${events.newsItemId}`)
      .where(and(isNull(events.id), isNull(newsItems.aiReservedAt)))
      .orderBy(desc(newsItems.publishedAt));

    this.logger.debug("found unprocessed news items", { count: rows.length });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      source: row.source,
      publishedAt: row.publishedAt,
      link: row.link,
      description: row.description ?? undefined,
    }));
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
