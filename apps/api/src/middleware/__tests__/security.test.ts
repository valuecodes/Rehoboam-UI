import { Hono } from "hono";

import type { AppEnv } from "../../types";
import { loggerMiddleware } from "../logger";
import { corsMiddleware, secureHeadersMiddleware } from "../security";

const createApp = () => {
  const app = new Hono<AppEnv>();
  app.use("*", secureHeadersMiddleware);
  app.use("*", corsMiddleware);
  app.use("*", loggerMiddleware);
  app.get("/api/test", (c) => c.json({ ok: true }));
  return app;
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("corsMiddleware", () => {
  it("sets CORS headers for allowed production origin", async () => {
    const res = await createApp().request("/api/test", {
      headers: { Origin: "https://rehoboam.valuecodes.fi" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://rehoboam.valuecodes.fi"
    );
  });

  it("sets CORS headers for allowed localhost origin", async () => {
    const res = await createApp().request("/api/test", {
      headers: { Origin: "http://localhost:3000" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000"
    );
  });

  it("does not set CORS headers for disallowed origin", async () => {
    const res = await createApp().request("/api/test", {
      headers: { Origin: "https://evil.example.com" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("handles OPTIONS preflight with correct methods", async () => {
    const res = await createApp().request("/api/test", {
      method: "OPTIONS",
      headers: {
        Origin: "https://rehoboam.valuecodes.fi",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(res.status).toBe(204);
    const allowMethods = res.headers.get("Access-Control-Allow-Methods");
    expect(allowMethods).toContain("GET");
    expect(allowMethods).toContain("OPTIONS");
  });

  it("exposes X-Request-Id header", async () => {
    const res = await createApp().request("/api/test", {
      headers: { Origin: "https://rehoboam.valuecodes.fi" },
    });

    expect(res.headers.get("Access-Control-Expose-Headers")).toContain(
      "X-Request-Id"
    );
  });
});

describe("secureHeadersMiddleware", () => {
  it("sets X-Content-Type-Options header", async () => {
    const res = await createApp().request("/api/test");

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("sets X-Frame-Options header", async () => {
    const res = await createApp().request("/api/test");

    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
  });

  it("removes X-Powered-By header", async () => {
    const res = await createApp().request("/api/test");

    expect(res.headers.get("X-Powered-By")).toBeNull();
  });
});
