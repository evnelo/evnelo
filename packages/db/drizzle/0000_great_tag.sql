CREATE TABLE `api_keys` (
	`id` char(26) NOT NULL,
	`organization_id` char(26) NOT NULL,
	`name` varchar(80) NOT NULL,
	`prefix` char(12) NOT NULL,
	`hash` char(64) NOT NULL,
	`scopes` json NOT NULL DEFAULT ('["read"]'),
	`last_used_at` datetime(3),
	`revoked_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_keys_hash_unique` UNIQUE(`hash`)
);
--> statement-breakpoint
CREATE TABLE `attendees` (
	`id` char(26) NOT NULL,
	`event_id` char(26) NOT NULL,
	`order_id` char(26) NOT NULL,
	`ticket_type_id` char(26) NOT NULL,
	`user_id` char(26),
	`name` varchar(120) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` varchar(32),
	`sms_opt_in` boolean NOT NULL DEFAULT false,
	`reminders_opt_out` boolean NOT NULL DEFAULT false,
	`status` enum('pending_approval','confirmed','rejected','cancelled','waitlisted') NOT NULL DEFAULT 'confirmed',
	`answers` json NOT NULL DEFAULT ('{}'),
	`deleted_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `attendees_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `check_ins` (
	`id` char(26) NOT NULL,
	`ticket_id` char(26) NOT NULL,
	`event_id` char(26) NOT NULL,
	`checked_in_by` char(26),
	`method` enum('scan','manual') NOT NULL,
	`undone_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `check_ins_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `discount_codes` (
	`id` char(26) NOT NULL,
	`event_id` char(26) NOT NULL,
	`code` varchar(40) NOT NULL,
	`kind` enum('percent','fixed') NOT NULL,
	`value` int NOT NULL,
	`max_uses` int,
	`uses` int NOT NULL DEFAULT 0,
	`expires_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `discount_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `dc_event_code` UNIQUE(`event_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `event_hosts` (
	`id` char(26) NOT NULL,
	`event_id` char(26) NOT NULL,
	`user_id` char(26),
	`name` varchar(120) NOT NULL,
	`title` varchar(120),
	`avatar_url` varchar(500),
	`social_links` json NOT NULL DEFAULT ('[]'),
	`position` int NOT NULL DEFAULT 0,
	CONSTRAINT `event_hosts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_invites` (
	`id` char(26) NOT NULL,
	`event_id` char(26) NOT NULL,
	`email` varchar(255),
	`token` char(48) NOT NULL,
	`max_uses` int NOT NULL DEFAULT 1,
	`uses` int NOT NULL DEFAULT 0,
	`expires_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `event_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_invites_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `event_sponsors` (
	`id` char(26) NOT NULL,
	`event_id` char(26) NOT NULL,
	`name` varchar(120) NOT NULL,
	`logo_url` varchar(500),
	`tier` varchar(60),
	`website` varchar(300),
	`social_links` json NOT NULL DEFAULT ('[]'),
	`position` int NOT NULL DEFAULT 0,
	CONSTRAINT `event_sponsors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_tags` (
	`event_id` char(26) NOT NULL,
	`tag_id` char(26) NOT NULL,
	CONSTRAINT `event_tags_event_id_tag_id_pk` PRIMARY KEY(`event_id`,`tag_id`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` char(26) NOT NULL,
	`organization_id` char(26) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description_md` text,
	`cover_image_url` varchar(500),
	`logo_url` varchar(500),
	`timezone` varchar(64) NOT NULL DEFAULT 'UTC',
	`starts_at` datetime(3) NOT NULL,
	`ends_at` datetime(3) NOT NULL,
	`location_type` enum('in_person','online','hybrid') NOT NULL DEFAULT 'in_person',
	`venue_name` varchar(160),
	`address` varchar(300),
	`city` varchar(100),
	`country` char(2),
	`lat` varchar(20),
	`lng` varchar(20),
	`online_url` varchar(500),
	`visibility` enum('public','unlisted','private') NOT NULL DEFAULT 'public',
	`status` enum('draft','published','cancelled','ended') NOT NULL DEFAULT 'draft',
	`requires_approval` boolean NOT NULL DEFAULT false,
	`capacity` int,
	`waitlist_enabled` boolean NOT NULL DEFAULT false,
	`collect_phone` boolean NOT NULL DEFAULT false,
	`fee_pass_through` boolean NOT NULL DEFAULT false,
	`refund_policy` text,
	`social_links` json NOT NULL DEFAULT ('[]'),
	`reminder_hours` json NOT NULL DEFAULT ('[24,1]'),
	`published_at` datetime(3),
	`deleted_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `events_id` PRIMARY KEY(`id`),
	CONSTRAINT `events_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` char(26) NOT NULL,
	`organization_id` char(26) NOT NULL,
	`event_id` char(26),
	`attendee_id` char(26),
	`channel` enum('email','sms') NOT NULL,
	`template` varchar(60) NOT NULL,
	`recipient` varchar(255) NOT NULL,
	`status` enum('queued','sent','delivered','bounced','failed','skipped') NOT NULL DEFAULT 'queued',
	`provider_message_id` varchar(120),
	`error` varchar(300),
	`scheduled_for` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`sent_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` char(26) NOT NULL,
	`order_id` char(26) NOT NULL,
	`ticket_type_id` char(26) NOT NULL,
	`quantity` int NOT NULL,
	`unit_price_minor` bigint NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` char(26) NOT NULL,
	`event_id` char(26) NOT NULL,
	`organization_id` char(26) NOT NULL,
	`user_id` char(26),
	`email` varchar(255) NOT NULL,
	`status` enum('pending','paid','free','refunded','partially_refunded','failed','expired') NOT NULL DEFAULT 'pending',
	`currency` char(3) NOT NULL DEFAULT 'USD',
	`subtotal_minor` bigint NOT NULL DEFAULT 0,
	`discount_minor` bigint NOT NULL DEFAULT 0,
	`tax_minor` bigint NOT NULL DEFAULT 0,
	`service_fee_minor` bigint NOT NULL DEFAULT 0,
	`total_minor` bigint NOT NULL DEFAULT 0,
	`platform_fee_minor` bigint NOT NULL DEFAULT 0,
	`refunded_minor` bigint NOT NULL DEFAULT 0,
	`discount_code_id` char(26),
	`stripe_payment_intent_id` varchar(80),
	`stripe_account_id` varchar(60),
	`hold_expires_at` datetime(3),
	`paid_at` datetime(3),
	`answers` json NOT NULL DEFAULT ('{}'),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `ord_pi` UNIQUE(`stripe_payment_intent_id`)
);
--> statement-breakpoint
CREATE TABLE `organization_invites` (
	`id` char(26) NOT NULL,
	`organization_id` char(26) NOT NULL,
	`email` varchar(255) NOT NULL,
	`role` enum('admin','member','checkin') NOT NULL DEFAULT 'member',
	`token` char(48) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`accepted_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `organization_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_invites_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `organization_members` (
	`organization_id` char(26) NOT NULL,
	`user_id` char(26) NOT NULL,
	`role` enum('owner','admin','member','checkin') NOT NULL DEFAULT 'member',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `organization_members_organization_id_user_id_pk` PRIMARY KEY(`organization_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` char(26) NOT NULL,
	`slug` varchar(60) NOT NULL,
	`name` varchar(120) NOT NULL,
	`logo_url` varchar(500),
	`website` varchar(300),
	`accent_color` char(7),
	`social_links` json NOT NULL DEFAULT ('[]'),
	`stripe_account_id` varchar(60),
	`stripe_account_type` enum('standard','express'),
	`stripe_charges_enabled` boolean NOT NULL DEFAULT false,
	`fee_pass_through` boolean NOT NULL DEFAULT false,
	`deleted_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `registration_fields` (
	`id` char(26) NOT NULL,
	`event_id` char(26) NOT NULL,
	`key` varchar(60) NOT NULL,
	`label` varchar(160) NOT NULL,
	`help_text` varchar(300),
	`placeholder` varchar(120),
	`type` enum('short_text','long_text','email','phone','number','select','multi_select','checkbox','date','url','file','consent') NOT NULL,
	`options` json,
	`required` boolean NOT NULL DEFAULT false,
	`scope` enum('order','attendee') NOT NULL DEFAULT 'attendee',
	`ticket_type_ids` json,
	`condition` json,
	`position` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `registration_fields_id` PRIMARY KEY(`id`),
	CONSTRAINT `rf_event_key` UNIQUE(`event_id`,`key`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` char(64) NOT NULL,
	`user_id` char(26) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `sessions_token` PRIMARY KEY(`token`)
);
--> statement-breakpoint
CREATE TABLE `sms_unlocks` (
	`id` char(26) NOT NULL,
	`event_id` char(26) NOT NULL,
	`organization_id` char(26) NOT NULL,
	`amount_minor` bigint NOT NULL DEFAULT 500,
	`currency` char(3) NOT NULL DEFAULT 'USD',
	`stripe_payment_intent_id` varchar(80),
	`paid_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `sms_unlocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `sms_unlocks_event_id_unique` UNIQUE(`event_id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` char(26) NOT NULL,
	`slug` varchar(60) NOT NULL,
	`name` varchar(60) NOT NULL,
	`curated` boolean NOT NULL DEFAULT false,
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `ticket_types` (
	`id` char(26) NOT NULL,
	`event_id` char(26) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`price_minor` bigint NOT NULL DEFAULT 0,
	`currency` char(3) NOT NULL DEFAULT 'USD',
	`quantity` int,
	`sold` int NOT NULL DEFAULT 0,
	`held` int NOT NULL DEFAULT 0,
	`min_per_order` int NOT NULL DEFAULT 1,
	`max_per_order` int NOT NULL DEFAULT 10,
	`sales_start_at` datetime(3),
	`sales_end_at` datetime(3),
	`hidden` boolean NOT NULL DEFAULT false,
	`access_code` varchar(60),
	`tax_rate_bps` int NOT NULL DEFAULT 0,
	`position` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ticket_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` char(26) NOT NULL,
	`attendee_id` char(26) NOT NULL,
	`event_id` char(26) NOT NULL,
	`token` char(48) NOT NULL,
	`revoked_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `tickets_attendee_id_unique` UNIQUE(`attendee_id`),
	CONSTRAINT `tickets_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(26) NOT NULL,
	`email` varchar(255) NOT NULL,
	`name` varchar(120),
	`avatar_url` varchar(500),
	`email_verified_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`identifier` varchar(255) NOT NULL,
	`token` char(64) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `verification_tokens_identifier_token_pk` PRIMARY KEY(`identifier`,`token`)
);
--> statement-breakpoint
CREATE TABLE `waitlist_entries` (
	`id` char(26) NOT NULL,
	`event_id` char(26) NOT NULL,
	`ticket_type_id` char(26),
	`email` varchar(255) NOT NULL,
	`name` varchar(120),
	`promoted_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `waitlist_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `wl_event_email` UNIQUE(`event_id`,`email`)
);
--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` char(26) NOT NULL,
	`webhook_id` char(26) NOT NULL,
	`event` varchar(60) NOT NULL,
	`payload` json NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`next_attempt_at` datetime(3),
	`response_status` int,
	`delivered_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `webhook_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` char(26) NOT NULL,
	`organization_id` char(26) NOT NULL,
	`url` varchar(500) NOT NULL,
	`secret` char(64) NOT NULL,
	`events` json NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `webhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ak_org` ON `api_keys` (`organization_id`);--> statement-breakpoint
CREATE INDEX `att_event` ON `attendees` (`event_id`,`status`);--> statement-breakpoint
CREATE INDEX `att_email` ON `attendees` (`event_id`,`email`);--> statement-breakpoint
CREATE INDEX `ci_ticket` ON `check_ins` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `et_tag` ON `event_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `ev_org` ON `events` (`organization_id`);--> statement-breakpoint
CREATE INDEX `ev_discover` ON `events` (`visibility`,`status`,`starts_at`);--> statement-breakpoint
CREATE INDEX `ev_city` ON `events` (`city`,`starts_at`);--> statement-breakpoint
CREATE INDEX `nt_queue` ON `notifications` (`status`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `nt_event` ON `notifications` (`event_id`,`template`);--> statement-breakpoint
CREATE INDEX `ord_event` ON `orders` (`event_id`,`status`);--> statement-breakpoint
CREATE INDEX `ord_email` ON `orders` (`email`);--> statement-breakpoint
CREATE INDEX `om_user` ON `organization_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `tt_event` ON `ticket_types` (`event_id`);--> statement-breakpoint
CREATE INDEX `tk_event` ON `tickets` (`event_id`);--> statement-breakpoint
CREATE INDEX `wd_pending` ON `webhook_deliveries` (`delivered_at`,`next_attempt_at`);