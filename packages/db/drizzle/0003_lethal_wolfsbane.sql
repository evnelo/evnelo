ALTER TABLE `notifications` MODIFY COLUMN `status` enum('queued','sending','sent','delivered','bounced','failed','skipped') NOT NULL DEFAULT 'queued';--> statement-breakpoint
ALTER TABLE `notifications` ADD `data` json;--> statement-breakpoint
ALTER TABLE `notifications` ADD `dedupe_key` varchar(120);--> statement-breakpoint
ALTER TABLE `notifications` ADD `attempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `nt_dedupe` UNIQUE(`dedupe_key`);--> statement-breakpoint
CREATE INDEX `nt_provider` ON `notifications` (`provider_message_id`);