-- Прежний список ID означал гарантированную выдачу одной штуки.
-- Сохраняем порядок, повторяющиеся ID, пустые таблицы и уже заданные шансы.
UPDATE mobs SET loot = (
  SELECT COALESCE(json_group_array(json(
    CASE WHEN entry.type = 'integer'
      THEN json_object('itemType', entry.value, 'chancePercent', 100)
      ELSE entry.value
    END
  )), '[]')
  FROM json_each(mobs.loot) AS entry
);
