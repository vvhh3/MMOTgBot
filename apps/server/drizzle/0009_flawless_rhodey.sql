CREATE TABLE `player_quests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`quest_id` integer NOT NULL,
	`assigned_day` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`completed_at` text,
	`claimed_at` text,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quest_id`) REFERENCES `quests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_quests_day_unique` ON `player_quests` (`player_id`,`assigned_day`,`quest_id`);--> statement-breakpoint
CREATE INDEX `player_quests_player_idx` ON `player_quests` (`player_id`);--> statement-breakpoint
CREATE TABLE `quests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`difficulty` text NOT NULL,
	`objective_type` text NOT NULL,
	`target_id` text,
	`target_count` integer NOT NULL,
	`target_xp` integer DEFAULT 0 NOT NULL,
	`target_points` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `quests_diffcluty_idx` ON `quests` (`difficulty`);