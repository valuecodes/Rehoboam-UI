import { Hono } from "hono";

import {
  createCacheMiddleware,
  defaultNoStoreCacheControlMiddleware,
  etagMiddleware,
} from "./middleware/cache";
import { notFoundHandler, onErrorHandler } from "./middleware/error-handlers";
import { loggerMiddleware } from "./middleware/logger";
import { corsMiddleware, secureHeadersMiddleware } from "./middleware/security";
import { events } from "./routes/events";
import { stats } from "./routes/stats";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.use("*", secureHeadersMiddleware);
app.use("*", corsMiddleware);
app.use("*", loggerMiddleware);
app.use("*", etagMiddleware);
app.use("*", defaultNoStoreCacheControlMiddleware);
app.use("/api/events", createCacheMiddleware({ ttl: 300 }));
app.use("/api/stats", createCacheMiddleware({ ttl: 600 }));
app.onError(onErrorHandler);

app.route("/api/events", events);
app.route("/api/stats", stats);

app.notFound(notFoundHandler);

// eslint-disable-next-line import/no-default-export -- Cloudflare Workers require a default export
export default app;
