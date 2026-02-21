import type { Context, ErrorHandler } from "hono";

import type { AppEnv } from "../types";

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

export const notFoundHandler = (c: Context<AppEnv>) => {
  return c.json({ error: "Not Found" }, 404);
};
