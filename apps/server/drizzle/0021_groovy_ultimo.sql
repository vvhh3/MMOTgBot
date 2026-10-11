ALTER TABLE `mobs` ADD `coin_reward` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `mobs`
SET `coin_reward` = CASE `id`
  WHEN 0 THEN 5
  WHEN 1 THEN 10
  WHEN 2 THEN 15
  WHEN 3 THEN 20
  WHEN 4 THEN 30
  ELSE `coin_reward`
END
WHERE `id` IN (0, 1, 2, 3, 4);
