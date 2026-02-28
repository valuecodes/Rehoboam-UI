import { expect, test } from "@playwright/test";

const API_BASE = "http://127.0.0.1:3001";

const SEVERITY_VALUES = ["low", "medium", "high", "critical"];

test.describe("API contract tests (local-only, requires API server)", () => {
  test.skip(
    Boolean(process.env.CI),
    "Skipped in CI — requires local API server with D1"
  );

  test("GET /api/events returns 200 JSON array", async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/events`);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");

    const body: unknown = await response.json();

    expect(Array.isArray(body)).toBe(true);
  });

  test("each event has required fields", async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/events`);
    const events = (await response.json()) as Record<string, unknown>[];

    expect(events.length).toBeGreaterThan(0);

    for (const event of events) {
      expect(typeof event.id).toBe("string");
      expect(typeof event.date).toBe("string");
      expect(typeof event.title).toBe("string");
      expect(typeof event.location).toBe("string");
      expect(typeof event.severity).toBe("string");
      expect(SEVERITY_VALUES).toContain(event.severity);
    }
  });

  test("CORS headers for localhost:3000", async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/events`, {
      headers: { origin: "http://localhost:3000" },
    });

    expect(response.headers()["access-control-allow-origin"]).toBeDefined();
  });

  test("X-Request-Id header present", async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/events`);
    const requestId = response.headers()["x-request-id"];

    expect(requestId).toBeDefined();
    expect(requestId.length).toBeGreaterThan(0);
  });

  test("ETag header present", async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/events`);
    const etag = response.headers().etag;

    expect(etag).toBeDefined();
    expect(etag).toMatch(/^W\//);
  });

  test("unknown route returns 404", async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/nonexistent`);

    expect(response.status()).toBe(404);
  });

  test("secure headers present", async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/events`);
    const headers = response.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
  });
});
