ALTER TABLE `orders` ADD `access_token` char(48);--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_method_type` varchar(40);--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_method_brand` varchar(40);--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_method_last4` varchar(4);--> statement-breakpoint
ALTER TABLE `orders` ADD `stripe_receipt_url` varchar(500);--> statement-breakpoint
UPDATE `orders` SET `access_token` = REPLACE(REPLACE(TO_BASE64(RANDOM_BYTES(24)), '/', '_'), '+', '-') WHERE `access_token` IS NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_access_token_unique` UNIQUE(`access_token`);