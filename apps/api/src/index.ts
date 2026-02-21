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
app.use("*", loggerMiddleware);
app.use("*", etagMiddleware);
// Default edge cache for all routes; individual routes can override with a longer TTL
app.use("*", createCacheMiddleware({ ttl: 60 }));

app.use("/api/events", createCacheMiddleware({ ttl: 300 }));
app.onError(onErrorHandler);

app.route("/api/events", events);

app.notFound(notFoundHandler);

// eslint-disable-next-line import/no-default-export -- Cloudflare Workers require a default export
export default app;
