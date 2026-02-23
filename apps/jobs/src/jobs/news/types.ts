import { z } from "zod";

export const NewsItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  source: z.string().min(1),
  publishedAt: z.iso.datetime(),
  link: z.string(),
  description: z.string().optional(),
});

export type NewsItem = z.infer<typeof NewsItemSchema>;
