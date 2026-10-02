CREATE TABLE `oauth_families` (
	`id` char(26) NOT NULL,
	`grant_id` char(26) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`revoked_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `oauth_families_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`id` char(26) NOT NULL,
	`family_id` char(26) NOT NULL,
	`token_hash` char(64) NOT NULL,
	`kind` enum('access','refresh') NOT NULL,
	`scopes` json NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`used_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `oauth_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauth_token_hash` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE INDEX `oauth_family_grant` ON `oauth_families` (`grant_id`);--> statement-breakpoint
CREATE INDEX `oauth_family_expiry` ON `oauth_families` (`expires_at`);--> statement-breakpoint
CREATE INDEX `oauth_token_family` ON `oauth_tokens` (`family_id`);--> statement-breakpoint
CREATE INDEX `oauth_token_expiry` ON `oauth_tokens` (`expires_at`);