CREATE TABLE `oauth_clients` (
	`id` char(26) NOT NULL,
	`client_id` varchar(2048) NOT NULL,
	`client_id_hash` char(64) NOT NULL,
	`redirect_uris` json NOT NULL,
	`scopes` json NOT NULL,
	`disabled_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `oauth_clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauth_client_hash` UNIQUE(`client_id_hash`)
);
