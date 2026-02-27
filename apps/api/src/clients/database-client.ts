import { newsItems } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import type { RehoboamEvent } from "@repo/types";
import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

const MAX_EVENTS = 50;

export class DatabaseClient {
  private readonly db;

  constructor(
    d1: D1Database,
    private readonly logger: Logger
  ) {
    this.db = drizzle(d1, { schema: { newsItems } });
  }

  async getEvents(): Promise<RehoboamEvent[]> {
    const rows = await this.db
      .select()
      .from(newsItems)
      .orderBy(desc(newsItems.publishedAt))
      .limit(MAX_EVENTS);

    this.logger.debug("fetched news items from D1", { count: rows.length });

    return rows.map((row) => ({
      id: row.id,
      date: row.publishedAt.slice(0, 10),
      title: row.title,
      location: row.source,
      severity: "medium" as const,
    }));
  }
}
