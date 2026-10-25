import { z } from "zod";

const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);

type Severity = z.infer<typeof SeveritySchema>;

const CategorySchema = z.enum([
  "conflict",
  "politics",
  "climate",
  "health",
  "economy",
  "diplomacy",
  "disaster",
  "science",
  "general",
]);

type Category = z.infer<typeof CategorySchema>;

const EventPublishedAtSchema = z.iso
  .datetime()
  .transform((value) => value.slice(0, 10));

const EventSchema = z.object({
  id: z.string().min(1),
  date: z.iso.date(),
  title: z.string().min(1),
  location: z.string().min(1),
  severity: SeveritySchema,
  category: CategorySchema,
});

type RehoboamEvent = z.infer<typeof EventSchema>;

const EventsResponseSchema = z.array(EventSchema);

type EventsResponse = z.infer<typeof EventsResponseSchema>;

const NewsItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  source: z.string().min(1),
  publishedAt: z.iso.datetime(),
  link: z.string(),
  description: z.string().optional(),
});

type NewsItem = z.infer<typeof NewsItemSchema>;

const StatsDailyActivitySchema = z.object({
  date: z.iso.date(),
  count: z.number().int().nonnegative(),
});

type StatsDailyActivity = z.infer<typeof StatsDailyActivitySchema>;

const StatsResponseSchema = z.object({
  totals: z.object({
    events: z.number().int().nonnegative(),
  }),
  byCategory: z.record(CategorySchema, z.number().int().nonnegative()),
  bySeverity: z.record(SeveritySchema, z.number().int().nonnegative()),
  recentActivity: z.array(StatsDailyActivitySchema),
});

type StatsResponse = z.infer<typeof StatsResponseSchema>;

export {
  CategorySchema,
  EventPublishedAtSchema,
  EventSchema,
  EventsResponseSchema,
  NewsItemSchema,
  SeveritySchema,
  StatsDailyActivitySchema,
  StatsResponseSchema,
};
export type {
  Category,
  EventsResponse,
  NewsItem,
  RehoboamEvent,
  Severity,
  StatsDailyActivity,
  StatsResponse,
};
