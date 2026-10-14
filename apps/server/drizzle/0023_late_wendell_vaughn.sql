CREATE TABLE `casino_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`game` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`bet` integer NOT NULL,
	`multiplier` real DEFAULT 1 NOT NULL,
	`potential_payout` integer DEFAULT 0 NOT NULL,
	`state` text NOT NULL,
	`created_at` text NOT NULL,
	`finished_at` text,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `casino_sessions_player_idx` ON `casino_sessions` (`player_id`);--> statement-breakpoint
CREATE INDEX `casino_sessions_player_status_idx` ON `casino_sessions` (`player_id`,`status`);