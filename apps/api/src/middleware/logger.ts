import { Logger } from "@repo/logger";
import { createMiddleware } from "hono/factory";

import type { AppEnv } from "../types";

export const loggerMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const requestId = crypto.randomUUID();
  const logger = new Logger({ context: "api" });

  c.set("logger", logger);
  c.set("requestId", requestId);

  const method = c.req.method;
  const path = c.req.path;

  logger.info("request received", { requestId, method, path });

  const start = Date.now();

  await next();

  // Set the request ID after downstream middleware so cache snapshots never persist a stale ID.
  c.header("X-Request-Id", requestId);

  const duration = Date.now() - start;
  const status = c.res.status;

  logger.info("request completed", {
    requestId,
    method,
    path,
    status,
    duration,
  });
});
