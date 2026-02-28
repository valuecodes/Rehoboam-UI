import { events } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { EventPublishedAtSchema, EventsResponseSchema } from "@repo/types";
import type { RehoboamEvent } from "@repo/types";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

const MAX_EVENTS = 50;

export class DatabaseClient {
  private readonly db;

  constructor(
    d1: D1Database,
    private readonly logger: Logger
  ) {
    this.db = drizzle(d1, { schema: { events } });
  }

  async getEvents(): Promise<RehoboamEvent[]> {
    const rows = await this.db
      .select()
      .from(events)
      .where(eq(events.skipped, false))
      .orderBy(desc(events.publishedAt))
      .limit(MAX_EVENTS);

    this.logger.debug("fetched events from D1", { count: rows.length });

    const items = rows.map((row) => ({
      id: row.id,
      date: EventPublishedAtSchema.parse(row.publishedAt),
      title: row.title,
      location: row.locationLabel ?? "Unknown",
      severity: row.severity,
      category: row.category,
    }));

    return EventsResponseSchema.parse(items);
  }
}
