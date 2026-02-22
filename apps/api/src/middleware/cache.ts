import { cache } from "hono/cache";
import { etag } from "hono/etag";
import { createMiddleware } from "hono/factory";

import type { AppEnv } from "../types";

export const etagMiddleware = etag({ weak: true });

type CacheOptions = {
  ttl: number;
  cacheName?: string;
};

export const createCacheMiddleware = (options: CacheOptions) => {
  const { ttl, cacheName = "rehoboam-api" } = options;

  return cache({
    cacheName,
    cacheControl: `public, s-maxage=${String(ttl)}, max-age=${String(ttl)}`,
    vary: "Origin",
    wait: false,
  });
};

export const cacheControl = (directive: string) =>
  createMiddleware<AppEnv>(async (c, next) => {
    await next();
    c.header("Cache-Control", directive);
  });
