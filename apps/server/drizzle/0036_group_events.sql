CREATE TABLE `event_parties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_window_id` integer NOT NULL,
	`leader_player_id` integer NOT NULL,
	`status` text DEFAULT 'forming' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`creation_request_id` text NOT NULL,
	`creation_fingerprint` text NOT NULL,
	`processed_requests` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`event_window_id`) REFERENCES `group_event_windows`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`leader_player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "event_party_status" CHECK("event_parties"."status" IN ('forming','active','finished','disbanded','expired')),
	CONSTRAINT "event_party_version" CHECK("event_parties"."version" >= 0 AND "event_parties"."version" = CAST("event_parties"."version" AS INTEGER))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_party_creation_unique` ON `event_parties` (`leader_player_id`,`creation_request_id`);
--> statement-breakpoint
CREATE INDEX `event_party_status_expiry_idx` ON `event_parties` (`status`,`expires_at`);
--> statement-breakpoint
CREATE TABLE `event_party_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`party_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`invited_by_player_id` integer,
	`slot` integer NOT NULL,
	`status` text NOT NULL,
	`ready` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`invite_expires_at` text,
	`joined_at` text,
	`ended_at` text,
	FOREIGN KEY (`party_id`) REFERENCES `event_parties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invited_by_player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "event_member_status" CHECK("event_party_members"."status" IN ('invited','joined','active','left','declined','cancelled','expired','finished')),
	CONSTRAINT "event_member_slot" CHECK("event_party_members"."slot" IN (0,1,2)),
	CONSTRAINT "event_member_ready" CHECK("event_party_members"."ready" IN (0,1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_member_current_unique` ON `event_party_members` (`player_id`) WHERE "event_party_members"."status" IN ('joined','active');
--> statement-breakpoint
CREATE UNIQUE INDEX `event_member_slot_unique` ON `event_party_members` (`party_id`,`slot`) WHERE "event_party_members"."status" IN ('invited','joined','active');
--> statement-breakpoint
CREATE UNIQUE INDEX `event_member_party_player_unique` ON `event_party_members` (`party_id`,`player_id`) WHERE "event_party_members"."status" IN ('invited','joined','active');
--> statement-breakpoint
CREATE INDEX `event_member_invite_idx` ON `event_party_members` (`player_id`,`status`,`invite_expires_at`);
--> statement-breakpoint
CREATE TABLE `group_event_rewards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`event_window_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`xp` integer NOT NULL,
	`points` integer NOT NULL,
	`coins` integer NOT NULL,
	`items` text NOT NULL,
	`granted_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `group_event_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_window_id`) REFERENCES `group_event_windows`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "group_event_reward_amounts" CHECK("group_event_rewards"."xp" >= 0 AND "group_event_rewards"."xp" = CAST("group_event_rewards"."xp" AS INTEGER) AND "group_event_rewards"."points" >= 0 AND "group_event_rewards"."points" = CAST("group_event_rewards"."points" AS INTEGER) AND "group_event_rewards"."coins" >= 0 AND "group_event_rewards"."coins" = CAST("group_event_rewards"."coins" AS INTEGER))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_event_reward_unique` ON `group_event_rewards` (`run_id`,`player_id`);
--> statement-breakpoint
CREATE INDEX `group_event_reward_player_idx` ON `group_event_rewards` (`player_id`,`event_window_id`);
--> statement-breakpoint
CREATE TABLE `group_event_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`party_id` integer NOT NULL,
	`event_window_id` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`config_snapshot` text NOT NULL,
	`battle_state` text NOT NULL,
	`wave_number` integer DEFAULT 1 NOT NULL,
	`round_number` integer DEFAULT 1 NOT NULL,
	`state_version` integer DEFAULT 0 NOT NULL,
	`round_started_at` text NOT NULL,
	`round_deadline_at` text NOT NULL,
	`started_at` text NOT NULL,
	`last_action_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`finished_at` text,
	FOREIGN KEY (`party_id`) REFERENCES `event_parties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_window_id`) REFERENCES `group_event_windows`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "group_event_run_status" CHECK("group_event_runs"."status" IN ('active','victory','defeat','aborted')),
	CONSTRAINT "group_event_run_numbers" CHECK("group_event_runs"."wave_number" >= 1 AND "group_event_runs"."wave_number" = CAST("group_event_runs"."wave_number" AS INTEGER) AND "group_event_runs"."round_number" >= 1 AND "group_event_runs"."round_number" = CAST("group_event_runs"."round_number" AS INTEGER) AND "group_event_runs"."state_version" >= 0 AND "group_event_runs"."state_version" = CAST("group_event_runs"."state_version" AS INTEGER))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_event_run_party_unique` ON `group_event_runs` (`party_id`);
--> statement-breakpoint
CREATE INDEX `group_event_run_deadline_idx` ON `group_event_runs` (`status`,`round_deadline_at`);
--> statement-breakpoint
CREATE INDEX `group_event_run_expiry_idx` ON `group_event_runs` (`status`,`expires_at`);
--> statement-breakpoint
CREATE TABLE `group_event_windows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`location_id` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`min_level` integer DEFAULT 1 NOT NULL,
	`config` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "group_event_window_dates" CHECK("group_event_windows"."starts_at" < "group_event_windows"."ends_at"),
	CONSTRAINT "group_event_window_level" CHECK("group_event_windows"."min_level" >= 1 AND "group_event_windows"."min_level" = CAST("group_event_windows"."min_level" AS INTEGER)),
	CONSTRAINT "group_event_window_enabled" CHECK("group_event_windows"."enabled" IN (0,1))
);
--> statement-breakpoint
CREATE INDEX `group_event_window_access_idx` ON `group_event_windows` (`location_id`,`enabled`,`starts_at`,`ends_at`);
