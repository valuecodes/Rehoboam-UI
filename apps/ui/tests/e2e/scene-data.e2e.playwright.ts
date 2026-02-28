import { expect, test } from "@playwright/test";

import {
  interceptEventsApi,
  interceptEventsApiError,
  MOCK_API_EVENTS,
} from "./fixtures/mock-api-events";

const CALLOUT_DEBUG_URL = "/?callout-debug=1";

const MOCK_TITLES = MOCK_API_EVENTS.map((event) => event.title.toUpperCase());

const MOCK_CITIES = MOCK_API_EVENTS.map((event) => {
  const [city] = event.location.split(",");
  return city.trim().toUpperCase();
});

test.describe("scene data integration tests", () => {
  test.beforeEach(async ({ page }) => {
    await interceptEventsApi(page);
  });

  test("callout displays event title", async ({ page }) => {
    await page.goto(CALLOUT_DEBUG_URL);

    const subtitle = page.locator(".rehoboam-scene__callout-subtitle");

    await expect(subtitle).toBeVisible();

    const text = await subtitle.textContent();

    expect(text).toBeTruthy();
    expect(MOCK_TITLES).toContainEqual(text);
  });

  test("callout displays event location", async ({ page }) => {
    await page.goto(CALLOUT_DEBUG_URL);

    const location = page.locator(".rehoboam-scene__callout-title-location");

    await expect(location).toBeVisible();

    const text = await location.textContent();

    expect(text).toBeTruthy();
    expect(MOCK_CITIES).toContainEqual(text);
  });

  test("callout shows divergence label", async ({ page }) => {
    await page.goto(CALLOUT_DEBUG_URL);

    const label = page.locator(".rehoboam-scene__callout-title-label");

    await expect(label).toBeVisible();
    await expect(label).toContainText("DIVERGENCE :");
  });

  test("scene handles API error gracefully", async ({ page }) => {
    const errors: Error[] = [];

    page.on("pageerror", (error) => {
      errors.push(error);
    });

    await page.unrouteAll();
    await interceptEventsApiError(page);
    await page.goto("/");

    await expect(page.locator(".rehoboam-scene__instrument")).toBeVisible();

    expect(errors).toHaveLength(0);
  });
});
