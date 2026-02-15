/* eslint-disable import/no-default-export */
import { defineConfig } from "@playwright/test";

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.trunc(parsed);
};

const getHeadless = (): boolean => {
  const value = process.env.SCREENSHOT_HEADLESS;

  if (value === undefined) {
    return true;
  }

  return value !== "false" && value !== "0";
};

const baseUrl = process.env.SCREENSHOT_BASE_URL ?? "http://127.0.0.1:3001";
const viewportWidth = parseNumber(process.env.SCREENSHOT_VIEWPORT_WIDTH, 1365);
const viewportHeight = parseNumber(
  process.env.SCREENSHOT_VIEWPORT_HEIGHT,
  1024
);

export default defineConfig({
  testDir: ".",
  testMatch: "tests/e2e/screenshot.scene.playwright.ts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: baseUrl,
    headless: getHeadless(),
    viewport: { width: viewportWidth, height: viewportHeight },
  },
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 3001 --strictPort",
    url: baseUrl,
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
