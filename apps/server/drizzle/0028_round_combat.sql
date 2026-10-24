DROP INDEX `combat_sessions_player_idx`;--> statement-breakpoint
ALTER TABLE `combat_sessions` ADD `round_number` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `combat_sessions` ADD `round_started_at` text;--> statement-breakpoint
ALTER TABLE `combat_sessions` ADD `state_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `combat_sessions` ADD `battle_state` text;--> statement-breakpoint
CREATE UNIQUE INDEX `combat_sessions_player_idx` ON `combat_sessions` (`player_id`) WHERE "combat_sessions"."status" = 'active';--> statement-breakpoint
ALTER TABLE `pvp_sessions` ADD `round_number` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `pvp_sessions` ADD `round_started_at` text;--> statement-breakpoint
ALTER TABLE `pvp_sessions` ADD `state_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `pvp_sessions` ADD `battle_state` text;--> statement-breakpoint
-- Old active sessions cannot be interpreted as hidden-choice rounds. Preserve their HP.
UPDATE players SET health = (SELECT player_health FROM combat_sessions WHERE player_id = players.id AND status = 'active')
WHERE EXISTS (SELECT 1 FROM combat_sessions WHERE player_id = players.id AND status = 'active');
--> statement-breakpoint
UPDATE players SET health = (SELECT CASE WHEN player_1_id = players.id THEN player_1_health ELSE player_2_health END
 FROM pvp_sessions WHERE status = 'active' AND (player_1_id = players.id OR player_2_id = players.id) ORDER BY id DESC LIMIT 1)
WHERE EXISTS (SELECT 1 FROM pvp_sessions WHERE status = 'active' AND (player_1_id = players.id OR player_2_id = players.id));
--> statement-breakpoint
UPDATE players SET id_the_last_action = NULL
WHERE (json_extract(id_the_last_action, '$.type') = 'TakeAWalk' AND EXISTS (
 SELECT 1 FROM combat_sessions WHERE status = 'active' AND player_id = players.id AND id = json_extract(players.id_the_last_action, '$.id')))
OR (json_extract(id_the_last_action, '$.type') = 'Fight' AND EXISTS (
 SELECT 1 FROM pvp_sessions WHERE status = 'active' AND (player_1_id = players.id OR player_2_id = players.id) AND id = json_extract(players.id_the_last_action, '$.id')));
--> statement-breakpoint
UPDATE combat_sessions SET status = 'aborted', state_version = state_version + 1 WHERE status = 'active';
--> statement-breakpoint
UPDATE pvp_sessions SET status = 'finished', winner_id = NULL, state_version = state_version + 1 WHERE status = 'active';
