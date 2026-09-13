PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_pvp_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_1_id` integer NOT NULL,
	`player_2_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`player_1_health` integer NOT NULL,
	`player_2_health` integer NOT NULL,
	`turn` text DEFAULT 'player1' NOT NULL,
	`winner_id` integer,
	`creadet_at` text NOT NULL,
	`last_action_at` text,
	FOREIGN KEY (`player_1_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_2_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_pvp_sessions`("id", "player_1_id", "player_2_id", "status", "player_1_health", "player_2_health", "turn", "winner_id", "creadet_at", "last_action_at") SELECT "id", "player_1_id", "player_2_id", "status", "player_1_health", "player_2_health", "turn", "winner_id", "creadet_at", "last_action_at" FROM `pvp_sessions`;--> statement-breakpoint
DROP TABLE `pvp_sessions`;--> statement-breakpoint
ALTER TABLE `__new_pvp_sessions` RENAME TO `pvp_sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `pvp_player1_idx` ON `pvp_sessions` (`player_1_id`);--> statement-breakpoint
CREATE INDEX `pvp_player2_idx` ON `pvp_sessions` (`player_2_id`);--> statement-breakpoint
ALTER TABLE `players` ADD `id_the_last_action` text;