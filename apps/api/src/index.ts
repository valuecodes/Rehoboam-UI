import { Hono } from "hono";

import { loggerMiddleware, onErrorHandler } from "./middleware/logger";
import { events } from "./routes/events";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.use("*", loggerMiddleware);
app.onError(onErrorHandler);

app.route("/api/events", events);

app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// eslint-disable-next-line import/no-default-export -- Cloudflare Workers require a default export
export default app;
