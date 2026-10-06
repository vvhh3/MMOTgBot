PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_players` (
        `id` integer PRIMARY KEY NOT NULL,
        `friend_id` integer DEFAULT 0 NOT NULL,
        `name` text NOT NULL,
        `health` integer DEFAULT 100 NOT NULL,
        `max_health` integer DEFAULT 100 NOT NULL,
        `strength` integer DEFAULT 10 NOT NULL,
        `defense` integer DEFAULT 5 NOT NULL,
        `level` integer DEFAULT 1 NOT NULL,
        `xp` integer DEFAULT 0 NOT NULL,
        `points` integer DEFAULT 0 NOT NULL,
        `stat_points` integer DEFAULT 0 NOT NULL,
        `current_location_id` text,
        `created_at` text NOT NULL,
        `last_seen_at` text NOT NULL,
        `last_regen_time` text NOT NULL,
        `id_the_last_action` text,
        `money` integer DEFAULT 0 NOT NULL,
        `cooldowns` text DEFAULT '{}' NOT NULL,
        FOREIGN KEY (`current_location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
        CONSTRAINT "money_non_negative" CHECK("__new_players"."money" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_players`("id", "friend_id", "name", "health", "max_health", "strength", "defense", "level", "xp", "points", "stat_points", "current_location_id", "created_at", "last_seen_at", "last_regen_time", "id_the_last_action") SELECT "id", "friend_id", "name", "health", "max_health", "strength", "defense", "level", "xp", "points", "stat_points", "current_location_id", "created_at", "last_seen_at", "last_regen_time", "id_the_last_action" FROM `players`;--> statement-breakpoint
DROP TABLE `players`;--> statement-breakpoint
ALTER TABLE `__new_players` RENAME TO `players`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `players_current_location_idx` ON `players` (`current_location_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `players_friend_id_idx` ON `players` (`friend_id`);