ALTER TABLE `registration_fields` MODIFY COLUMN `scope` enum('order','attendee','guest') NOT NULL DEFAULT 'attendee';--> statement-breakpoint
ALTER TABLE `attendees` ADD `guest_of_attendee_id` char(26);--> statement-breakpoint
ALTER TABLE `events` ADD `guests_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `max_guests` int DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `att_guest_of` ON `attendees` (`guest_of_attendee_id`);