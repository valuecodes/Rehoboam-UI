import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

const ALLOWED_ORIGINS = [
  "https://rehoboam.valuecodes.fi",
  "http://localhost:3000",
];

const corsMiddleware = cors({
  origin: ALLOWED_ORIGINS,
  allowMethods: ["GET", "OPTIONS"],
  exposeHeaders: ["X-Request-Id"],
});

const secureHeadersMiddleware = secureHeaders();

export { corsMiddleware, secureHeadersMiddleware };
