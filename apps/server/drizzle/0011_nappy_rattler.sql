CREATE TABLE `pvp_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_1_id` integer NOT NULL,
	`player_2_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`player_1_health` integer NOT NULL,
	`player_2_health` integer NOT NULL,
	`turn` text DEFAULT 'player1' NOT NULL,
	`winner_id` integer,
	`creadet_at` text NOT NULL,
	`last_action_at` text NOT NULL,
	FOREIGN KEY (`player_1_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_2_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pvp_player1_idx` ON `pvp_sessions` (`player_1_id`);--> statement-breakpoint
CREATE INDEX `pvp_player2_idx` ON `pvp_sessions` (`player_2_id`);