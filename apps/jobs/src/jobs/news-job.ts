import type { Logger } from "@repo/logger";

import type { Job } from "./index";

export class NewsJob implements Job {
  readonly name = "news";
  readonly cron = "0 */6 * * *";

  constructor(private readonly logger: Logger) {}

  run(): Promise<void> {
    this.logger.debug("news job executed");
    return Promise.resolve();
  }
}
