ALTER TABLE `players` ADD `last_regen_time` text NOT NULL DEFAULT '';
UPDATE `players` SET `last_regen_time` = `created_at`;