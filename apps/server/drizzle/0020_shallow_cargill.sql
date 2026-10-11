ALTER TABLE `items` ADD `shop_available` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `items` SET `shop_available` = 1 WHERE `id` IN (1, 2, 3, 5);
