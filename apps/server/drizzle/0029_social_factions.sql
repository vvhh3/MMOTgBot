ALTER TABLE `players` ADD `faction_id` text;--> statement-breakpoint
CREATE INDEX `players_faction_idx` ON `players` (`faction_id`);