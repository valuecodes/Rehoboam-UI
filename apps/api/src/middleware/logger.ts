import { Logger } from "@repo/logger";
import type { ErrorHandler } from "hono";
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

export const onErrorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const logger = c.get("logger");
  const requestId = c.get("requestId");

  logger.error("unhandled error", {
    requestId,
    method: c.req.method,
    path: c.req.path,
    error: err.message,
    stack: err.stack,
  });

  return c.json({ error: "Internal Server Error" }, 500);
};
