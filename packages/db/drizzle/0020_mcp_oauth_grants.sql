CREATE TABLE `oauth_grants` (
	`id` char(26) NOT NULL,
	`client_id` char(26) NOT NULL,
	`user_id` char(26) NOT NULL,
	`organization_id` char(26),
	`issuer` varchar(2048) NOT NULL,
	`resource` varchar(2048) NOT NULL,
	`redirect_uri` varchar(2048) NOT NULL,
	`scopes` json NOT NULL,
	`session_hash` char(64) NOT NULL,
	`code_challenge` char(43) NOT NULL,
	`code_hash` char(64),
	`code_used_at` datetime(3),
	`expires_at` datetime(3) NOT NULL,
	`approved_at` datetime(3),
	`revoked_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `oauth_grants_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauth_code_hash` UNIQUE(`code_hash`)
);
--> statement-breakpoint
CREATE INDEX `oauth_grant_user` ON `oauth_grants` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauth_grant_org` ON `oauth_grants` (`organization_id`);--> statement-breakpoint
CREATE INDEX `oauth_grant_expiry` ON `oauth_grants` (`expires_at`);--> statement-breakpoint
CREATE INDEX `oauth_grant_client` ON `oauth_grants` (`client_id`);