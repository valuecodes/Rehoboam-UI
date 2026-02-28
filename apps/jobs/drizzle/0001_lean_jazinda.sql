CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`news_item_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`severity` text NOT NULL,
	`location_label` text,
	`published_at` text NOT NULL,
	`skipped` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`news_item_id`) REFERENCES `news_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_events_news_item_id` ON `events` (`news_item_id`);--> statement-breakpoint
CREATE INDEX `idx_events_published_at` ON `events` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_events_category` ON `events` (`category`);
