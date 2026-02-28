ALTER TABLE `news_items` ADD `ai_reserved_at` text;
--> statement-breakpoint
CREATE INDEX `idx_news_items_ai_reserved_at` ON `news_items` (`ai_reserved_at`);
