import { events, newsItems } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import {
  CategorySchema,
  EventPublishedAtSchema,
  EventsResponseSchema,
  SeveritySchema,
  StatsResponseSchema,
} from "@repo/types";
import type {
  Category,
  RehoboamEvent,
  Severity,
  StatsResponse,
} from "@repo/types";
import { count, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

const MAX_EVENTS = 50;

export class DatabaseClient {
  private readonly db;

  constructor(
    d1: D1Database,
    private readonly logger: Logger
  ) {
    this.db = drizzle(d1, { schema: { events, newsItems } });
  }

  async getEvents(): Promise<RehoboamEvent[]> {
    const rows = await this.db
      .select()
      .from(events)
      .where(eq(events.skipped, false))
      .orderBy(desc(events.publishedAt))
      .limit(MAX_EVENTS);

    this.logger.debug("fetched events from D1", { count: rows.length });

    if (rows.length > 0) {
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

    const existingEventRows = await this.db.select().from(events).limit(1);

    if (existingEventRows.length > 0) {
      this.logger.debug("processed events exist but none are displayable", {
        count: existingEventRows.length,
      });
      return [];
    }

    const fallbackRows = await this.db
      .select({
        id: newsItems.id,
        title: newsItems.title,
        publishedAt: newsItems.publishedAt,
      })
      .from(newsItems)
      .orderBy(desc(newsItems.publishedAt))
      .limit(MAX_EVENTS);

    this.logger.debug("falling back to news items from D1", {
      count: fallbackRows.length,
    });

    const items = fallbackRows.map((row) => ({
      id: row.id,
      date: EventPublishedAtSchema.parse(row.publishedAt),
      title: row.title,
      location: "Unknown",
      severity: "medium" as const,
      category: "general" as const,
    }));

    return EventsResponseSchema.parse(items);
  }

  async getStats(): Promise<StatsResponse> {
    const [totalRow] = await this.db
      .select({ total: count() })
      .from(events)
      .where(eq(events.skipped, false));

    const total = totalRow?.total ?? 0;

    const categoryRows = await this.db
      .select({ category: events.category, total: count() })
      .from(events)
      .where(eq(events.skipped, false))
      .groupBy(events.category);

    const severityRows = await this.db
      .select({ severity: events.severity, total: count() })
      .from(events)
      .where(eq(events.skipped, false))
      .groupBy(events.severity);

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setUTCDate(cutoff.getUTCDate() - 6);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const activityRows = await this.db
      .select({
        date: sql<string>`strftime('%Y-%m-%d', ${events.publishedAt})`,
        total: count(),
      })
      .from(events)
      .where(
        sql`${events.skipped} = 0 AND strftime('%Y-%m-%d', ${events.publishedAt}) >= ${cutoffStr}`
      )
      .groupBy(sql`strftime('%Y-%m-%d', ${events.publishedAt})`)
      .orderBy(sql`strftime('%Y-%m-%d', ${events.publishedAt})`);

    const byCategory = Object.fromEntries(
      CategorySchema.options.map((cat) => [cat, 0])
    ) as Record<Category, number>;
    for (const row of categoryRows) {
      if (row.category in byCategory) {
        byCategory[row.category as Category] = row.total;
      }
    }

    const bySeverity = Object.fromEntries(
      SeveritySchema.options.map((sev) => [sev, 0])
    ) as Record<Severity, number>;
    for (const row of severityRows) {
      if (row.severity in bySeverity) {
        bySeverity[row.severity as Severity] = row.total;
      }
    }

    const activityMap = new Map(activityRows.map((r) => [r.date, r.total]));
    const recentActivity = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(cutoff);
      d.setUTCDate(cutoff.getUTCDate() + i);
      const date = d.toISOString().slice(0, 10);
      return { date, count: activityMap.get(date) ?? 0 };
    });

    this.logger.debug("fetched stats from D1", { total });

    return StatsResponseSchema.parse({
      totals: { events: total },
      byCategory,
      bySeverity,
      recentActivity,
    });
  }
}
