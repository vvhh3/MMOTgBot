CREATE INDEX `combat_sessions_status_last_action_idx` ON `combat_sessions` (`status`, `last_action_at`);--> statement-breakpoint
CREATE INDEX `pvp_status_last_action_idx` ON `pvp_sessions` (`status`, `last_action_at`);--> statement-breakpoint
CREATE INDEX `events_created_idx` ON `events` (`created_at`);
