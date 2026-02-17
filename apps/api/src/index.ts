import { Hono } from "hono";

import { events } from "./routes/events";

const app = new Hono<{ Bindings: Env }>();

app.route("/api/events", events);

// eslint-disable-next-line import/no-default-export -- Cloudflare Workers require a default export
export default app;
