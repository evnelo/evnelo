CREATE TABLE `registration_uploads` (
	`id` char(26) NOT NULL,
	`event_id` char(26) NOT NULL,
	`object_key` varchar(255) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `registration_uploads_id` PRIMARY KEY(`id`),
	CONSTRAINT `registration_uploads_object_key_unique` UNIQUE(`object_key`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `disputed_at` datetime(3);--> statement-breakpoint
ALTER TABLE `orders` ADD `dispute_status` varchar(40);--> statement-breakpoint
CREATE INDEX `ru_stale` ON `registration_uploads` (`created_at`);