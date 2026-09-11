ALTER TABLE `waitlist_entries` ADD `token` char(48);--> statement-breakpoint
ALTER TABLE `waitlist_entries` ADD `hold_expires_at` datetime(3);--> statement-breakpoint
ALTER TABLE `waitlist_entries` ADD `expired_at` datetime(3);--> statement-breakpoint
ALTER TABLE `waitlist_entries` ADD `registered_at` datetime(3);--> statement-breakpoint
ALTER TABLE `waitlist_entries` ADD `order_id` char(26);--> statement-breakpoint
ALTER TABLE `waitlist_entries` ADD CONSTRAINT `wl_token` UNIQUE(`token`);--> statement-breakpoint
CREATE INDEX `wl_hold` ON `waitlist_entries` (`hold_expires_at`);