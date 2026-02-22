import { Hono } from "hono";

import type { AppEnv } from "../../types";
import { cacheControl, createCacheMiddleware, etagMiddleware } from "../cache";
import { loggerMiddleware } from "../logger";

const createApp = () => {
  const app = new Hono<AppEnv>();
  app.use("*", loggerMiddleware);
  app.use("*", etagMiddleware);
  app.get("/api/test", (c) => c.json({ ok: true }));
  return app;
};

const createExecutionCtx = () => ({
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
  props: {},
});

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("etagMiddleware", () => {
  it("sets ETag header on responses", async () => {
    const res = await createApp().request("/api/test");

    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toMatch(/^W\/"[a-f0-9]+"$/);
  });

  it("returns 304 when If-None-Match matches", async () => {
    const app = createApp();

    const first = await app.request("/api/test");
    const etag = first.headers.get("ETag");
    expect(etag).toBeDefined();

    const second = await app.request("/api/test", {
      headers: { "If-None-Match": etag ?? "" },
    });

    expect(second.status).toBe(304);
  });

  it("returns 200 when If-None-Match does not match", async () => {
    const res = await createApp().request("/api/test", {
      headers: { "If-None-Match": 'W/"stale"' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toMatch(/^W\/"[a-f0-9]+"$/);
  });
});

describe("createCacheMiddleware", () => {
  it("does not break requests when caches API is unavailable", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", loggerMiddleware);
    app.use("/api/test/*", createCacheMiddleware({ ttl: 3600 }));
    app.get("/api/test/data", (c) => c.json({ cached: true }));

    const res = await app.request("/api/test/data");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cached: true });
  });

  it("sets Vary: Origin header to prevent CORS cache poisoning", async () => {
    const mockCache = { match: vi.fn().mockResolvedValue(null), put: vi.fn() };
    vi.stubGlobal("caches", { open: vi.fn().mockResolvedValue(mockCache) });
    const executionCtx = createExecutionCtx();

    const app = new Hono<AppEnv>();
    app.use("*", loggerMiddleware);
    app.use("/api/test/*", createCacheMiddleware({ ttl: 60 }));
    app.get("/api/test/data", (c) => c.json({ ok: true }));

    const res = await app.request(
      "/api/test/data",
      undefined,
      undefined,
      executionCtx
    );

    expect(res.headers.get("Vary")).toContain("origin");

    vi.unstubAllGlobals();
  });

  it("does not persist X-Request-Id across cached responses", async () => {
    const cacheStore = new Map<string, Response>();
    const mockCache = {
      match: vi.fn((key: string) => cacheStore.get(key) ?? null),
      put: vi.fn((key: string, response: Response) => {
        cacheStore.set(key, response.clone());
      }),
    };
    vi.stubGlobal("caches", { open: vi.fn().mockResolvedValue(mockCache) });
    const executionCtx = createExecutionCtx();

    const app = new Hono<AppEnv>();
    app.use("*", loggerMiddleware);
    app.use("/api/test/*", createCacheMiddleware({ ttl: 60 }));
    app.get("/api/test/data", (c) => c.json({ id: c.get("requestId") }));

    const first = await app.request(
      "/api/test/data",
      undefined,
      undefined,
      executionCtx
    );
    const firstBody = await first.json<{ id: string }>();
    const firstHeader = first.headers.get("X-Request-Id");

    const second = await app.request(
      "/api/test/data",
      undefined,
      undefined,
      executionCtx
    );
    const secondBody = await second.json<{ id: string }>();
    const secondHeader = second.headers.get("X-Request-Id");

    expect(mockCache.put).toHaveBeenCalledTimes(1);
    expect(secondBody.id).toBe(firstBody.id);
    expect(firstHeader).toBe(firstBody.id);
    expect(secondHeader).toBeDefined();
    expect(secondHeader).not.toBe(secondBody.id);
    expect(secondHeader).not.toBe(firstHeader);

    vi.unstubAllGlobals();
  });
});

describe("cacheControl", () => {
  it("sets the specified Cache-Control directive", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", loggerMiddleware);
    app.use("*", cacheControl("no-store"));
    app.get("/api/test", (c) => c.json({ ok: true }));

    const res = await app.request("/api/test");

    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets custom max-age directive", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", loggerMiddleware);
    app.use("*", cacheControl("public, max-age=600"));
    app.get("/api/test", (c) => c.json({ ok: true }));

    const res = await app.request("/api/test");

    expect(res.headers.get("Cache-Control")).toBe("public, max-age=600");
  });
});
