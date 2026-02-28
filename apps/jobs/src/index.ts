import { handleScheduled } from "./scheduled";
import type { JobsEnv } from "./types";

// eslint-disable-next-line import/no-default-export -- Cloudflare Workers require a default export
export default {
  scheduled: handleScheduled,
} satisfies ExportedHandler<JobsEnv>;
