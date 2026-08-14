PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_mobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`level` integer NOT NULL,
	`max_health` integer NOT NULL,
	`strength` integer NOT NULL,
	`defense` integer NOT NULL,
	`loot` text NOT NULL,
	`points_reward` integer NOT NULL,
	`location_id` text NOT NULL,
	`respawn_seconds` integer NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_mobs`("id", "name", "description", "level", "max_health", "strength", "loot", "points_reward", "location_id") SELECT "id", "name", "description", "level", "max_health", "strength", "loot", "points_reward", "location_id" FROM `mobs`;--> statement-breakpoint
DROP TABLE `mobs`;--> statement-breakpoint
ALTER TABLE `__new_mobs` RENAME TO `mobs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_players` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`health` integer DEFAULT 100 NOT NULL,
	`max_health` integer DEFAULT 100 NOT NULL,
	`strength` integer DEFAULT 10 NOT NULL,
	`defense` integer DEFAULT 5 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`current_location_id` text,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	FOREIGN KEY (`current_location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_players`("id", "name", "health", "max_health", "strength", "defense", "level", "points", "current_location_id", "created_at", "last_seen_at") SELECT "id", "name", "health", "max_health", "strength", "defense", "level", "points", "current_location_id", "created_at", "last_seen_at" FROM `players`;--> statement-breakpoint
DROP TABLE `players`;--> statement-breakpoint
ALTER TABLE `__new_players` RENAME TO `players`;--> statement-breakpoint
CREATE INDEX `players_current_location_idx` ON `players` (`current_location_id`);