import type { LogEntry } from "@repo/logger";
import { Hono } from "hono";
import type { MockInstance } from "vitest";

import type { AppEnv } from "../../types";
import { loggerMiddleware, onErrorHandler } from "../logger";

type ConsoleSpy = MockInstance<(...args: unknown[]) => void>;

const parseLogEntry = (spy: ConsoleSpy, callIndex = 0): LogEntry => {
  const call = spy.mock.calls[callIndex] as unknown[] | undefined;
  expect(call).toBeDefined();
  return JSON.parse(String(call?.[0])) as LogEntry;
};

describe("loggerMiddleware", () => {
  let consoleSpy: {
    debug: ConsoleSpy;
    log: ConsoleSpy;
    warn: ConsoleSpy;
    error: ConsoleSpy;
  };

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, "debug").mockImplementation(() => undefined),
      log: vi.spyOn(console, "log").mockImplementation(() => undefined),
      warn: vi.spyOn(console, "warn").mockImplementation(() => undefined),
      error: vi.spyOn(console, "error").mockImplementation(() => undefined),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("makes logger accessible via c.get('logger')", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", loggerMiddleware);
    app.get("/test", (c) => {
      const logger = c.get("logger");
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      return c.json({ ok: true });
    });

    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("logs request received and request completed", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", loggerMiddleware);
    app.get("/hello", (c) => c.json({ ok: true }));

    await app.request("/hello");

    expect(consoleSpy.log).toHaveBeenCalledTimes(2);

    const receivedEntry = parseLogEntry(consoleSpy.log, 0);
    expect(receivedEntry.message).toBe("request received");
    expect(receivedEntry.method).toBe("GET");
    expect(receivedEntry.path).toBe("/hello");
    expect(receivedEntry.requestId).toBeDefined();

    const completedEntry = parseLogEntry(consoleSpy.log, 1);
    expect(completedEntry.message).toBe("request completed");
    expect(completedEntry.status).toBe(200);
    expect(typeof completedEntry.duration).toBe("number");
  });

  it("sets a unique requestId per request", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", loggerMiddleware);
    app.get("/test", (c) => c.json({ id: c.get("requestId") }));

    const res1 = await app.request("/test");
    const res2 = await app.request("/test");
    const body1: { id: string } = await res1.json();
    const body2: { id: string } = await res2.json();

    expect(body1.id).toBeDefined();
    expect(body2.id).toBeDefined();
    expect(body1.id).not.toBe(body2.id);
  });
});

describe("onErrorHandler", () => {
  let consoleSpy: {
    log: ConsoleSpy;
    error: ConsoleSpy;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(() => undefined),
      error: vi.spyOn(console, "error").mockImplementation(() => undefined),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the error and returns a 500 JSON response", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", loggerMiddleware);
    app.onError(onErrorHandler);
    app.get("/fail", () => {
      throw new Error("something broke");
    });

    const res = await app.request("/fail");
    expect(res.status).toBe(500);

    const body: { error: string } = await res.json();
    expect(body.error).toBe("Internal Server Error");

    expect(consoleSpy.error).toHaveBeenCalled();
    const errorEntry = parseLogEntry(consoleSpy.error);
    expect(errorEntry.message).toBe("unhandled error");
    expect(errorEntry.error).toBe("something broke");
  });
});
