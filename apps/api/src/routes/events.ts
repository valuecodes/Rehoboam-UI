import { EventsResponseSchema } from "@repo/types";
import { Hono } from "hono";

import { DatabaseClient } from "../clients/database-client";
import type { AppEnv } from "../types";

export const events = new Hono<AppEnv>().get("/", async (c) => {
  const logger = c.get("logger");
  const db = new DatabaseClient(c.env.DB, logger);
  const items = await db.getEvents();

  logger.debug("returning events", { count: items.length });

  return c.json(EventsResponseSchema.parse(items));
});
