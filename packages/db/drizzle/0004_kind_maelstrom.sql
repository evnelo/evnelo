CREATE TABLE `accounts` (
	`id` char(26) NOT NULL,
	`user_id` char(26) NOT NULL,
	`type` varchar(20) NOT NULL,
	`provider` varchar(40) NOT NULL,
	`provider_account_id` varchar(120) NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` int,
	`token_type` varchar(40),
	`scope` varchar(300),
	`id_token` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `acc_provider` UNIQUE(`provider`,`provider_account_id`)
);
--> statement-breakpoint
CREATE INDEX `acc_user` ON `accounts` (`user_id`);