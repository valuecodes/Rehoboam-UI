import { expect, test } from "@playwright/test";

import { interceptEventsApi } from "./fixtures/mock-api-events";

test.describe("UI smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    await interceptEventsApi(page);
  });

  test("page loads and scene renders", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(".rehoboam-scene__instrument")).toBeVisible();
  });

  test("hud route renders the developer hud overlay", async ({ page }) => {
    await page.goto("/#/hud");

    await expect(page.locator(".rehoboam-scene__instrument")).toBeVisible();
    await expect(page.getByLabel("Developer HUD")).toBeVisible();
  });

  test("privacy route renders the privacy policy panel", async ({ page }) => {
    await page.goto("/#/privacy");

    await expect(
      page.getByRole("heading", { name: "Privacy Policy" })
    ).toBeVisible();
    await expect(page.locator(".rehoboam-scene__canvas")).toHaveCount(0);
  });

  test("canvas element is present", async ({ page }) => {
    await page.goto("/");

    const canvas = page.locator(".rehoboam-scene__canvas");

    await expect(canvas).toBeAttached();
    await expect(canvas).toHaveAttribute("aria-hidden", "true");
  });

  test("scene has correct aria label", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(".rehoboam-scene__instrument")).toHaveAttribute(
      "aria-label",
      "Rehoboam V2 scene container"
    );
  });

  test("existing hud query flag still enables the overlay", async ({
    page,
  }) => {
    await page.goto("/?hud");

    await expect(page.locator(".rehoboam-scene__instrument")).toBeVisible();
    await expect(page.getByLabel("Developer HUD")).toBeVisible();
  });

  test("desktop nav switches from home to privacy", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Privacy policy" }).click();

    await expect(page).toHaveURL(/#\/privacy$/);
    await expect(
      page.getByRole("heading", { name: "Privacy Policy" })
    ).toBeVisible();
  });

  test("no uncaught exceptions", async ({ page }) => {
    const errors: Error[] = [];

    page.on("pageerror", (error) => {
      errors.push(error);
    });

    await page.goto("/");
    await expect(page.locator(".rehoboam-scene__instrument")).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test("no console errors during load", async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.goto("/");
    await expect(page.locator(".rehoboam-scene__instrument")).toBeVisible();

    expect(consoleErrors).toHaveLength(0);
  });

  test("scene renders with empty API response", async ({ page }) => {
    await page.unrouteAll();
    await interceptEventsApi(page, []);
    await page.goto("/");

    await expect(page.locator(".rehoboam-scene__instrument")).toBeVisible();
  });
});
