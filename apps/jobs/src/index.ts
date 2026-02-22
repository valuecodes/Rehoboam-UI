import { handleScheduled } from "./scheduled";

// eslint-disable-next-line import/no-default-export -- Cloudflare Workers require a default export
export default {
  scheduled: handleScheduled,
} satisfies ExportedHandler<Env>;
