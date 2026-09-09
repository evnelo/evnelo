CREATE FULLTEXT INDEX `ev_search_ft` ON `events` (`name`, `description_md`);
--> statement-breakpoint
CREATE FULLTEXT INDEX `org_name_ft` ON `organizations` (`name`);
--> statement-breakpoint
CREATE FULLTEXT INDEX `tag_name_ft` ON `tags` (`name`);
