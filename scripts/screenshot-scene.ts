import { $, parseArgv, ProcessOutput } from "zx";

type CliOptions = {
  baseUrl: string | undefined;
  headed: boolean;
  headless: boolean;
  height: string | undefined;
  output: string | undefined;
  settleMs: string | undefined;
  showHelp: boolean;
  width: string | undefined;
};

const HELP_TEXT = `
Capture deterministic Rehoboam screenshots with Playwright.

Usage:
  pnpm screenshot:scene [options]

Options:
  --output <path>       Base output path (default: .tmp/screenshots/current-codex-auto.png)
  --width <number>      Viewport width (default: 1365)
  --height <number>     Viewport height (default: 1024)
  --settle-ms <number>  Delay after selector visibility (default: 200)
  --base-url <url>      App URL (default: http://127.0.0.1:3001)
  --headed              Run browser in headed mode
  --headless            Force headless mode
  --help                Show this help

Environment variable equivalents:
  SCREENSHOT_OUTPUT_BASE
  SCREENSHOT_VIEWPORT_WIDTH
  SCREENSHOT_VIEWPORT_HEIGHT
  SCREENSHOT_SETTLE_MS
  SCREENSHOT_BASE_URL
  SCREENSHOT_HEADLESS
`.trim();

const VALUE_OPTIONS = new Set([
  "--output",
  "--width",
  "--height",
  "--settle-ms",
  "--base-url",
]);
const FLAG_OPTIONS = new Set(["--help", "-h", "--headed", "--headless"]);

const validateArgv = (argv: readonly string[]): void => {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      break;
    }

    if (arg.startsWith("--")) {
      const equalsIndex = arg.indexOf("=");
      const option = equalsIndex >= 0 ? arg.slice(0, equalsIndex) : arg;
      const hasInlineValue = equalsIndex >= 0;

      if (!VALUE_OPTIONS.has(option) && !FLAG_OPTIONS.has(option)) {
        throw new Error(`Unknown option: ${option}`);
      }

      if (VALUE_OPTIONS.has(option) && !hasInlineValue) {
        const next = argv.at(index + 1);
        if (next === undefined || next.startsWith("-")) {
          throw new Error(`Missing value for ${option}.`);
        }

        index += 1;
      }

      continue;
    }

    if (arg.startsWith("-")) {
      if (arg !== "-h") {
        throw new Error(`Unknown option: ${arg}`);
      }

      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }
};

const readOptionalString = (
  optionName: string,
  value: unknown
): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  throw new Error(`Invalid value for ${optionName}.`);
};

const parseArgs = (argv: readonly string[]): CliOptions => {
  validateArgv(argv);

  const parsed = parseArgv(
    [...argv],
    {
      alias: { h: "help" },
      boolean: ["help", "headed", "headless"],
      string: ["output", "width", "height", "settle-ms", "base-url"],
      parseBoolean: true,
      camelCase: true,
    },
    {}
  );

  return {
    baseUrl: readOptionalString("--base-url", parsed.baseUrl),
    headed: parsed.headed === true,
    headless: parsed.headless === true,
    height: readOptionalString("--height", parsed.height),
    output: readOptionalString("--output", parsed.output),
    settleMs: readOptionalString("--settle-ms", parsed.settleMs),
    showHelp: parsed.help === true,
    width: readOptionalString("--width", parsed.width),
  };
};

const options = parseArgs(process.argv.slice(2));

if (options.showHelp) {
  console.log(HELP_TEXT);
  process.exit(0);
}

const commandEnv: NodeJS.ProcessEnv = {
  ...process.env,
  ...(options.baseUrl === undefined
    ? {}
    : { SCREENSHOT_BASE_URL: options.baseUrl }),
  ...(options.headed ? { SCREENSHOT_HEADLESS: "false" } : {}),
  ...(options.headless ? { SCREENSHOT_HEADLESS: "true" } : {}),
  ...(options.height === undefined
    ? {}
    : { SCREENSHOT_VIEWPORT_HEIGHT: options.height }),
  ...(options.output === undefined
    ? {}
    : { SCREENSHOT_OUTPUT_BASE: options.output }),
  ...(options.settleMs === undefined
    ? {}
    : { SCREENSHOT_SETTLE_MS: options.settleMs }),
  ...(options.width === undefined
    ? {}
    : { SCREENSHOT_VIEWPORT_WIDTH: options.width }),
};

const run = $({
  env: commandEnv,
  stdio: "inherit",
});

try {
  if (options.headed) {
    await run`pnpm exec playwright test -c playwright.config.ts --headed`;
  } else {
    await run`pnpm exec playwright test -c playwright.config.ts`;
  }
} catch (error) {
  if (error instanceof ProcessOutput) {
    process.exit(error.exitCode ?? 1);
  }

  throw error;
}
