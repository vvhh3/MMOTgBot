-- Добавляем колонки без пересоздания locations и без каскадного удаления связей.
ALTER TABLE `locations` ADD `min_level` integer DEFAULT 1 NOT NULL
  CONSTRAINT `locations_min_level_positive` CHECK (`min_level` >= 1 AND `min_level` = CAST(`min_level` AS INTEGER));
--> statement-breakpoint
ALTER TABLE `locations` ADD `is_open` integer DEFAULT false NOT NULL
  CONSTRAINT `locations_is_open_boolean` CHECK (`is_open` IN (0, 1));
--> statement-breakpoint
UPDATE `locations` SET `is_open` = 1 WHERE `id` IN ('square', 'rialto', 'market');
