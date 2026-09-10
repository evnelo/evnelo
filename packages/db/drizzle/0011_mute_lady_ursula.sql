ALTER TABLE `events` DROP INDEX `events_slug_unique`;--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `ev_org_slug` UNIQUE(`organization_id`,`slug`);