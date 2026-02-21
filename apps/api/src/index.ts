import { Hono } from "hono";

import { notFoundHandler, onErrorHandler } from "./middleware/error-handlers";
import { loggerMiddleware } from "./middleware/logger";
import { events } from "./routes/events";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.use("*", loggerMiddleware);
app.onError(onErrorHandler);

app.route("/api/events", events);

app.notFound(notFoundHandler);

// eslint-disable-next-line import/no-default-export -- Cloudflare Workers require a default export
export default app;
