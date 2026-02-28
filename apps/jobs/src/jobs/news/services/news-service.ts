import type { Logger } from "@repo/logger";
import type { NewsItem } from "@repo/types";

const FEED_FETCH_TIMEOUT_MS = 8000;

export abstract class NewsService {
  abstract readonly slug: string;
  abstract readonly url: string;

  constructor(protected readonly logger: Logger) {}

  async fetch(): Promise<NewsItem[]> {
    this.logger.debug("fetching feed", { source: this.slug, url: this.url });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, FEED_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(this.url, { signal: controller.signal });

      if (!response.ok) {
        this.logger.error("feed fetch failed", {
          source: this.slug,
          status: response.status,
        });
        return [];
      }

      const xml = await response.text();
      const items = await this.parse(xml);

      this.logger.info("feed parsed", {
        source: this.slug,
        itemCount: items.length,
      });

      return items;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        this.logger.error("feed fetch timed out", {
          source: this.slug,
          url: this.url,
          timeoutMs: FEED_FETCH_TIMEOUT_MS,
        });
        return [];
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error("feed processing failed", {
        source: this.slug,
        error: message,
      });
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  }

  protected async hashId(raw: string): Promise<string> {
    try {
      const data = new TextEncoder().encode(raw);
      const buffer = await crypto.subtle.digest("SHA-256", data);
      const bytes = new Uint8Array(buffer);

      return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      return raw;
    }
  }

  protected abstract parse(xml: string): Promise<NewsItem[]>;
}
