import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { secureHeaders } from "hono/secure-headers";

import type { AppEnv } from "../types";

const ALLOWED_ORIGINS = [
  "https://rehoboam.valuecodes.fi",
  "http://localhost:3000",
];

export const corsMiddleware = cors({
  origin: ALLOWED_ORIGINS,
  allowMethods: ["GET", "OPTIONS"],
  exposeHeaders: ["X-Request-Id"],
});

export const secureHeadersMiddleware = secureHeaders();

export const cacheControlMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  }
);
