import { z } from "zod";

export const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);

export type Severity = z.infer<typeof SeveritySchema>;

export const EventSchema = z.object({
  id: z.string().min(1),
  date: z.iso.date(),
  title: z.string().min(1),
  location: z.string().min(1),
  severity: SeveritySchema,
});

export type RehoboamEvent = z.infer<typeof EventSchema>;

export const EventsResponseSchema = z.array(EventSchema);

export type EventsResponse = z.infer<typeof EventsResponseSchema>;
