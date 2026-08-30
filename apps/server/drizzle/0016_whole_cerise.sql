CREATE TABLE IF NOT EXISTS `friendships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_id` integer NOT NULL,
	`to_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`from_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `friendships_pair_unique` ON `friendships` (`from_id`,`to_id`);