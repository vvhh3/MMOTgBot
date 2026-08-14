CREATE TABLE `combat_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`mob_id` integer NOT NULL,
	`player_health` integer NOT NULL,
	`mob_health` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`started_at` text NOT NULL,
	`last_action_at` text NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mob_id`) REFERENCES `mobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `combat_sessions_player_idx` ON `combat_sessions` (`player_id`);--> statement-breakpoint
CREATE INDEX `combat_sessions_mob_idx` ON `combat_sessions` (`mob_id`);--> statement-breakpoint
CREATE TABLE `mobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`level` integer NOT NULL,
	`max_health` integer NOT NULL,
	`strength` integer NOT NULL,
	`loot` text NOT NULL,
	`points_reward` integer NOT NULL,
	`location_id` text,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `players` ADD `health` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `max_health` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `strength` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `defense` integer NOT NULL;