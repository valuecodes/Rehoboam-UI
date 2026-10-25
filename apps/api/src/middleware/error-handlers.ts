import type { Context, ErrorHandler } from "hono";

import type { AppEnv } from "~/types";

const onErrorHandler: ErrorHandler<AppEnv> = (err, c) => {
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

const notFoundHandler = (c: Context<AppEnv>) =>
  c.json({ error: "Not Found" }, 404);

export { notFoundHandler, onErrorHandler };
