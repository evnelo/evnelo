CREATE TABLE `event_reports` (
	`id` char(26) NOT NULL,
	`event_id` char(26) NOT NULL,
	`reason` enum('spam','scam','inappropriate','copyright','other') NOT NULL,
	`details` text,
	`reporter_email` varchar(255),
	`resolved_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `event_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `er_event` ON `event_reports` (`event_id`);