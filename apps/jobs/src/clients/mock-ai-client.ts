import type { Logger } from "@repo/logger";
import type { NewsItem } from "@repo/types";

import type {
  AiProcessingResult,
  AiProcessor,
  ProcessedEvent,
} from "./ai-client";

const SKIP_PATTERN =
  /\b(sports?|football|soccer|nba|nfl|mlb|celebrity|entertainment|lifestyle)\b/i;
const CATEGORY_PATTERNS: {
  category: ProcessedEvent["category"];
  pattern: RegExp;
}[] = [
  {
    category: "conflict",
    pattern: /\b(war|attack|military|missile|conflict)\b/i,
  },
  {
    category: "politics",
    pattern: /\b(election|parliament|president|minister|policy)\b/i,
  },
  {
    category: "climate",
    pattern: /\b(climate|emissions|wildfire|flood|storm)\b/i,
  },
  {
    category: "health",
    pattern: /\b(health|virus|hospital|disease|outbreak)\b/i,
  },
  {
    category: "economy",
    pattern: /\b(economy|market|inflation|trade|tariff)\b/i,
  },
  {
    category: "diplomacy",
    pattern: /\b(diplomacy|summit|sanctions|treaty|ambassador)\b/i,
  },
  {
    category: "disaster",
    pattern: /\b(earthquake|hurricane|disaster|evacuation)\b/i,
  },
  { category: "science", pattern: /\b(science|research|nasa|space|study)\b/i },
];

export class MockAiClient implements AiProcessor {
  constructor(private readonly logger: Logger) {}

  processNewsItems(items: NewsItem[]): Promise<AiProcessingResult> {
    if (items.length === 0) {
      this.logger.debug("no news items to process with mock AI");
      return Promise.resolve({ events: [], failed: 0 });
    }

    const events = items.map((item) => this.classify(item));

    this.logger.info("mock AI processing completed", {
      total: items.length,
      processed: events.length,
      skipped: events.filter((event) => event.skipped).length,
      failed: 0,
    });

    return Promise.resolve({ events, failed: 0 });
  }

  private classify(item: NewsItem): ProcessedEvent {
    const sourceText = `${item.title} ${item.description ?? ""}`;

    if (SKIP_PATTERN.test(sourceText)) {
      return {
        newsItemId: item.id,
        title: item.title,
        category: "general",
        severity: "low",
        locationLabel: null,
        publishedAt: item.publishedAt,
        skipped: true,
      };
    }

    return {
      newsItemId: item.id,
      title:
        item.title.length <= 80 ? item.title : `${item.title.slice(0, 77)}...`,
      category: this.getCategory(sourceText),
      severity: this.getSeverity(sourceText),
      locationLabel: null,
      publishedAt: item.publishedAt,
      skipped: false,
    };
  }

  private getCategory(text: string): ProcessedEvent["category"] {
    const match = CATEGORY_PATTERNS.find(({ pattern }) => pattern.test(text));
    return match?.category ?? "general";
  }

  private getSeverity(text: string): ProcessedEvent["severity"] {
    if (/\b(war|invasion|catastrophic|massive|emergency)\b/i.test(text)) {
      return "critical";
    }

    if (/\b(attack|crisis|evacuation|sanctions|outbreak)\b/i.test(text)) {
      return "high";
    }

    if (/\b(election|policy|market|summit|storm)\b/i.test(text)) {
      return "medium";
    }

    return "low";
  }
}
