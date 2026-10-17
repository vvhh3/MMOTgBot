-- Сохраняем таблицу и id существующих записей; старое оружие разделяем на экземпляры.
ALTER TABLE `inventory_items` ADD `weapon_level` integer
  CONSTRAINT `inventory_weapon_instance` CHECK (`weapon_level` IS NULL OR
    (`quantity` = 1 AND `weapon_level` >= 1 AND `weapon_level` = CAST(`weapon_level` AS INTEGER)));
--> statement-breakpoint
DROP INDEX `inventory_items_player_item_unique`;
--> statement-breakpoint
-- Старые выкладки ссылались на тип оружия, а не экземпляр. Требуется новый выбор.
UPDATE `trades` SET `from_offer` = '[]', `to_offer` = '[]', `from_ready` = 0, `to_ready` = 0
WHERE `status` IN ('pending', 'open') AND (
  EXISTS (SELECT 1 FROM json_each(`from_offer`) e JOIN `items` i ON i.id = json_extract(e.value, '$.itemType') WHERE i.type = 'weapon') OR
  EXISTS (SELECT 1 FROM json_each(`to_offer`) e JOIN `items` i ON i.id = json_extract(e.value, '$.itemType') WHERE i.type = 'weapon')
);
--> statement-breakpoint
WITH RECURSIVE copies(player_id, item_type, acquired_at, remaining) AS (
  SELECT player_id, item_type, acquired_at, quantity - 1 FROM inventory_items
  WHERE item_type IN (SELECT id FROM items WHERE type = 'weapon') AND quantity > 1
  UNION ALL
  SELECT player_id, item_type, acquired_at, remaining - 1 FROM copies WHERE remaining > 1
)
INSERT INTO inventory_items (player_id, item_type, quantity, acquired_at, equiped, weapon_level)
SELECT player_id, item_type, 1, acquired_at, 0, 1 FROM copies;
--> statement-breakpoint
DELETE FROM inventory_items WHERE quantity <= 0 AND item_type IN (SELECT id FROM items WHERE type = 'weapon');
--> statement-breakpoint
UPDATE inventory_items SET quantity = 1, weapon_level = 1
WHERE weapon_level IS NULL AND item_type IN (SELECT id FROM items WHERE type = 'weapon');
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_items_player_stack_unique` ON `inventory_items` (`player_id`,`item_type`) WHERE `weapon_level` IS NULL;
--> statement-breakpoint
ALTER TABLE `items` ADD `catalog_key` text;--> statement-breakpoint
ALTER TABLE `items` ADD `rarity` text DEFAULT 'common' NOT NULL;--> statement-breakpoint
ALTER TABLE `items` ADD `weapon_family` text;--> statement-breakpoint
ALTER TABLE `items` ADD `damage_category` text;--> statement-breakpoint
ALTER TABLE `items` ADD `damage_type` text;--> statement-breakpoint
ALTER TABLE `items` ADD `passive_id` text;--> statement-breakpoint
ALTER TABLE `items` ADD `passive_params` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `items_catalog_key_unique` ON `items` (`catalog_key`);
--> statement-breakpoint
UPDATE items SET weapon_family = 'legacy', damage_category = 'physical', damage_type =
  CASE WHEN name IN ('Ржавый нож', 'Старая винтовка') THEN 'piercing' ELSE 'blunt' END
WHERE type = 'weapon';
