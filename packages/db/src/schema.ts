import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const newsItems = sqliteTable(
  "news_items",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    source: text("source").notNull(),
    publishedAt: text("published_at").notNull(),
    link: text("link").notNull(),
    description: text("description"),
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
  ]
);
