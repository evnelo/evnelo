CREATE TABLE `api_idempotency_keys` (
	`id` char(26) NOT NULL,
	`api_key_id` char(26) NOT NULL,
	`key` varchar(120) NOT NULL,
	`request_hash` char(64) NOT NULL,
	`response_status` int,
	`response_body` json,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `api_idempotency_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `aik_key` UNIQUE(`api_key_id`,`key`)
);
--> statement-breakpoint
CREATE TABLE `api_rate_limits` (
	`api_key_id` char(26) NOT NULL,
	`window_start` datetime(3) NOT NULL,
	`count` int NOT NULL DEFAULT 1,
	CONSTRAINT `api_rate_limits_api_key_id_window_start_pk` PRIMARY KEY(`api_key_id`,`window_start`)
);
--> statement-breakpoint
CREATE INDEX `aik_expiry` ON `api_idempotency_keys` (`expires_at`);