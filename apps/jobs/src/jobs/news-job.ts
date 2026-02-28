import type { Logger } from "@repo/logger";
import type { NewsItem } from "@repo/types";

import type { AiProcessor } from "../clients/ai-client";
import type { DatabaseClient } from "../clients/database-client";
import type { Job } from "./index";
import { BbcNewsService } from "./news/services/bbc-service";
import type { NewsService } from "./news/services/news-service";

export class NewsJob implements Job {
  readonly name = "news";
  readonly cron = "0 */6 * * *";

  private readonly services: NewsService[];

  constructor(
    private readonly logger: Logger,
    private readonly db: DatabaseClient,
    private readonly ai: AiProcessor,
    private readonly aiItemLimit?: number
  ) {
    this.services = [new BbcNewsService(logger)];
  }

  async run(): Promise<void> {
    this.logger.info("news job started", {
      serviceCount: this.services.length,
    });

    const results = await Promise.allSettled(
      this.services.map((service) => service.fetch())
    );

    const allItems: NewsItem[] = results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : []
    );

    const processedCount = await this.db.upsertNewsItems(allItems);
    const deletedCount = await this.db.deleteOldNewsItems(200);

    const unprocessedItems = await this.db.getUnprocessedNewsItems();
    const itemsForAi =
      this.aiItemLimit === undefined
        ? unprocessedItems
        : unprocessedItems.slice(0, this.aiItemLimit);

    const reservedForAi = await this.db.reserveNewsItemsForAi(
      itemsForAi.map((item) => item.id)
    );
    const aiResult = await this.ai.processNewsItems(itemsForAi);
    const eventCount = await this.db.upsertEvents(aiResult.events);

    this.logger.info("news job completed", {
      totalItems: allItems.length,
      processedCount,
      deletedCount,
      unprocessedItems: unprocessedItems.length,
      reservedForAi,
      aiProcessed: aiResult.events.length,
      aiSkipped: aiResult.events.filter((e) => e.skipped).length,
      aiFailed: aiResult.failed,
      eventsUpserted: eventCount,
      services: this.services.length,
      failed: results.filter((r) => r.status === "rejected").length,
    });
  }
}
