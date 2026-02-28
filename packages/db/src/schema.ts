import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const newsItems = sqliteTable(
  "news_items",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    source: text("source").notNull(),
    publishedAt: text("published_at").notNull(),
    link: text("link").notNull(),
    description: text("description"),
    aiReservedAt: text("ai_reserved_at"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("idx_news_items_source").on(table.source),
    index("idx_news_items_published_at").on(table.publishedAt),
    index("idx_news_items_ai_reserved_at").on(table.aiReservedAt),
  ]
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    newsItemId: text("news_item_id")
      .notNull()
      .references(() => newsItems.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: text("category").notNull(),
    severity: text("severity").notNull(),
    locationLabel: text("location_label"),
    publishedAt: text("published_at").notNull(),
    skipped: integer("skipped", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("idx_events_news_item_id").on(table.newsItemId),
    index("idx_events_published_at").on(table.publishedAt),
    index("idx_events_category").on(table.category),
  ]
);
