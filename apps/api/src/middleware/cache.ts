import { cache } from "hono/cache";
import { etag } from "hono/etag";
import { createMiddleware } from "hono/factory";

import type { AppEnv } from "~/types";

const etagMiddleware = etag({ weak: true });

type CacheOptions = {
  ttl: number;
  cacheName?: string;
};

const createCacheMiddleware = (options: CacheOptions) => {
  const { ttl, cacheName = "rehoboam-api" } = options;

  return cache({
    cacheName,
    cacheControl: `public, s-maxage=${String(ttl)}, max-age=${String(ttl)}`,
    vary: "Origin",
    wait: false,
  });
};

const cacheControl = (directive: string) =>
  createMiddleware<AppEnv>(async (c, next) => {
    await next();
    c.header("Cache-Control", directive);
  });

const defaultNoStoreCacheControlMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    await next();
    if (!c.res.headers.has("Cache-Control")) {
      c.header("Cache-Control", "no-store");
    }
  }
);

export {
  cacheControl,
  createCacheMiddleware,
  defaultNoStoreCacheControlMiddleware,
  etagMiddleware,
};
