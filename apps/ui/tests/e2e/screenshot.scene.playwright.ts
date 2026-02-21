import { mkdir } from "node:fs/promises";
import { dirname, extname } from "node:path";
import { expect, test } from "@playwright/test";

const SCENE_SELECTOR = ".rehoboam-scene__instrument";

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.trunc(parsed);
};

type ScreenshotOutputPaths = {
  fullPage: string;
  instrument: string;
};

const resolveOutputPaths = (outputBasePath: string): ScreenshotOutputPaths => {
  const extension = extname(outputBasePath) || ".png";
  const baseWithoutExtension = outputBasePath.slice(
    0,
    outputBasePath.length - extname(outputBasePath).length
  );
  const normalizedBasePath =
    extname(outputBasePath) === ""
      ? `${outputBasePath}${extension}`
      : outputBasePath;

  return {
    fullPage: normalizedBasePath,
    instrument: `${baseWithoutExtension}.instrument${extension}`,
  };
};

const outputBasePath =
  process.env.SCREENSHOT_OUTPUT_BASE ??
  ".tmp/screenshots/current-codex-auto.png";
const settleDelayMs = parseNumber(process.env.SCREENSHOT_SETTLE_MS, 200);

test("captures Rehoboam scene screenshots", async ({ page }) => {
  const outputPaths = resolveOutputPaths(outputBasePath);
  await mkdir(dirname(outputPaths.fullPage), { recursive: true });
  await mkdir(dirname(outputPaths.instrument), { recursive: true });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(SCENE_SELECTOR)).toBeVisible();

  if (settleDelayMs > 0) {
    await page.waitForTimeout(settleDelayMs);
  }

  await page.screenshot({
    fullPage: true,
    path: outputPaths.fullPage,
  });
  await page.locator(SCENE_SELECTOR).screenshot({
    path: outputPaths.instrument,
  });
});
