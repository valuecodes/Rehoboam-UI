import { Hono } from "hono";

import { DatabaseClient } from "../clients/database-client";
import type { AppEnv } from "../types";

export const stats = new Hono<AppEnv>().get("/", async (c) => {
  const logger = c.get("logger");
  const db = new DatabaseClient(c.env.DB, logger);
  const data = await db.getStats();

  logger.debug("returning stats", { total: data.totals.events });

  return c.json(data);
});
