import { z } from "zod";

export const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);

export type Severity = z.infer<typeof SeveritySchema>;

export const EventSchema = z.object({
  id: z.string(),
  date: z.string(),
  title: z.string(),
  location: z.string(),
  severity: SeveritySchema,
});

export type Event = z.infer<typeof EventSchema>;

export const EventsResponseSchema = z.array(EventSchema);

export type EventsResponse = z.infer<typeof EventsResponseSchema>;
