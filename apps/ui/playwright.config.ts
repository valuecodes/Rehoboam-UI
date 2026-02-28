/* eslint-disable import/no-default-export */
import { defineConfig } from "@playwright/test";

const isCI = Boolean(process.env.CI);

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

const baseUrl = process.env.SCREENSHOT_BASE_URL ?? "http://127.0.0.1:3000";
const viewportWidth = parseNumber(process.env.SCREENSHOT_VIEWPORT_WIDTH, 1365);
const viewportHeight = parseNumber(
  process.env.SCREENSHOT_VIEWPORT_HEIGHT,
  1024
);

const viteServer = {
  command: "pnpm exec vite --host 127.0.0.1 --port 3000 --strictPort",
  url: "http://127.0.0.1:3000",
  timeout: 120_000,
  reuseExistingServer: true,
};

const apiServer = {
  command: "pnpm --filter rehoboam-api dev",
  url: "http://127.0.0.1:3001/api/events",
  timeout: 120_000,
  reuseExistingServer: true,
};

const getSelectedProjects = (argv: readonly string[]): string[] => {
  return argv.flatMap((arg, index) => {
    if (arg.startsWith("--project=")) {
      return [arg.slice("--project=".length)];
    }

    if (arg === "--project") {
      const project = argv[index + 1];

      return project === undefined ? [] : [project];
    }

    return [];
  });
};

const selectedProjects = getSelectedProjects(process.argv);
const isSmokeOnly =
  selectedProjects.length > 0 &&
  selectedProjects.every((project) => project === "smoke");
const needsApiServer = !isCI && !isSmokeOnly;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.playwright.ts",
  fullyParallel: false,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: isCI ? "github" : "list",
  use: {
    baseURL: baseUrl,
    headless: getHeadless(),
    viewport: { width: viewportWidth, height: viewportHeight },
  },
  projects: [
    {
      name: "screenshot",
      testMatch: "screenshot.scene.playwright.ts",
    },
    {
      name: "smoke",
      testMatch: ["smoke.e2e.playwright.ts", "scene-data.e2e.playwright.ts"],
    },
    {
      name: "api-contract",
      testMatch: "api-contract.e2e.playwright.ts",
    },
  ],
  webServer: needsApiServer ? [viteServer, apiServer] : [viteServer],
});
