ALTER TABLE mobs ADD COLUMN catalog_key text;
--> statement-breakpoint
ALTER TABLE mobs ADD COLUMN is_active integer NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE UNIQUE INDEX mobs_catalog_key_unique ON mobs(catalog_key);
--> statement-breakpoint
ALTER TABLE quests ADD COLUMN is_active integer NOT NULL DEFAULT 1;
--> statement-breakpoint
-- Keep referenced rows: deleting mobs/quests cascades into battle/quest history.
UPDATE mobs SET is_active = 0 WHERE id <> -1;
--> statement-breakpoint
UPDATE quests SET is_active = 0 WHERE
 (objective_type = 'kill' AND target_id IN (SELECT CAST(id AS TEXT) FROM mobs WHERE is_active = 0))
 OR title IN ('Устранить громилу', 'Первое оружие', 'Полевой медик', 'Коллекция ржавых ножей',
 'Запасы металлолома', 'Арсенал снайпера', 'Патруль Парка Победы');
--> statement-breakpoint
UPDATE combat_sessions SET battle_state = json_set(battle_state, '$.encounter', json_object(
 'level', (SELECT level FROM mobs WHERE id = mob_id), 'rank', 'normal',
 'locationId', (SELECT location_id FROM mobs WHERE id = mob_id),
 'pointsReward', (SELECT points_reward FROM mobs WHERE id = mob_id),
 'coinReward', (SELECT coin_reward FROM mobs WHERE id = mob_id),
 'loot', json((SELECT loot FROM mobs WHERE id = mob_id))))
WHERE battle_state IS NOT NULL AND json_valid(battle_state) AND json_type(battle_state, '$.encounter') IS NULL;
--> statement-breakpoint
UPDATE items SET description = 'Простое оружие, которое можно добыть на Площади'
WHERE catalog_key = 'training_stick' AND description = 'Простое оружие, которое можно добыть у крыс на Площади';
