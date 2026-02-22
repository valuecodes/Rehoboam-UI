import { Hono } from "hono";

import { createCacheMiddleware, etagMiddleware } from "./middleware/cache";
import { notFoundHandler, onErrorHandler } from "./middleware/error-handlers";
import { loggerMiddleware } from "./middleware/logger";
import { corsMiddleware, secureHeadersMiddleware } from "./middleware/security";
import { events } from "./routes/events";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.use("*", secureHeadersMiddleware);
app.use("*", corsMiddleware);
app.use("*", etagMiddleware);
app.use("/api/events", createCacheMiddleware({ ttl: 300 }));
// Logger runs after cache so cached responses don't carry a stale X-Request-Id
app.use("*", loggerMiddleware);
app.onError(onErrorHandler);

app.route("/api/events", events);

app.notFound(notFoundHandler);

// eslint-disable-next-line import/no-default-export -- Cloudflare Workers require a default export
export default app;
