import type { Logger } from "@repo/logger";

import type { Job } from "./index";
import { BbcNewsService } from "./news/services/bbc-service";
import { CnnNewsService } from "./news/services/cnn-service";
import type { NewsService } from "./news/services/news-service";
import type { NewsItem } from "./news/types";

export class NewsJob implements Job {
  readonly name = "news";
  readonly cron = "0 */6 * * *";

  private readonly services: NewsService[];

  constructor(private readonly logger: Logger) {
    this.services = [
      new BbcNewsService(logger),
      new CnnNewsService(logger),
    ];
  }

  async run(): Promise<void> {
    this.logger.info("news job started", {
      serviceCount: this.services.length,
    });

    const results = await Promise.allSettled(
      this.services.map((service) => service.fetch()),
    );

    const allItems: NewsItem[] = results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );

    this.logger.info("news job completed", {
      totalItems: allItems.length,
      services: this.services.length,
      failed: results.filter((r) => r.status === "rejected").length,
    });
  }
}
