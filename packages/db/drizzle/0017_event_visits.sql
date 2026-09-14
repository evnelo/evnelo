CREATE TABLE `event_visits` (
	`id` char(26) NOT NULL,
	`event_id` char(26) NOT NULL,
	`day` date NOT NULL,
	`visitor_hash` char(64) NOT NULL,
	`views` int NOT NULL DEFAULT 1,
	`referrer_host` varchar(255),
	`utm_source` varchar(100),
	`utm_medium` varchar(100),
	`utm_campaign` varchar(100),
	`country` char(2),
	`device` enum('desktop','mobile'),
	`opened_registration` boolean NOT NULL DEFAULT false,
	`registered` boolean NOT NULL DEFAULT false,
	`first_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`last_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `event_visits_id` PRIMARY KEY(`id`),
	CONSTRAINT `ev_visit_day` UNIQUE(`event_id`,`day`,`visitor_hash`)
);
--> statement-breakpoint
ALTER TABLE `notifications` ADD `opened_at` datetime(3);--> statement-breakpoint
ALTER TABLE `notifications` ADD `clicked_at` datetime(3);--> statement-breakpoint
CREATE INDEX `ev_visit_event` ON `event_visits` (`event_id`,`day`);