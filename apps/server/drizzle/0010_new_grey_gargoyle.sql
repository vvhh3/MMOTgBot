CREATE TABLE `trades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_player_id` integer NOT NULL,
	`to_player_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`from_offer` text DEFAULT '[]' NOT NULL,
	`to_offer` text DEFAULT '[]' NOT NULL,
	`from_ready` integer DEFAULT false NOT NULL,
	`to_ready` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`from_player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trades_to_player_idx` ON `trades` (`to_player_id`,`status`);--> statement-breakpoint
CREATE INDEX `trades_from_player_idx` ON `trades` (`from_player_id`,`status`);