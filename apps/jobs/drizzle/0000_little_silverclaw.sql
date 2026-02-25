CREATE TABLE `news_items` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`source` text NOT NULL,
	`published_at` text NOT NULL,
	`link` text NOT NULL,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_news_items_source` ON `news_items` (`source`);--> statement-breakpoint
CREATE INDEX `idx_news_items_published_at` ON `news_items` (`published_at`);