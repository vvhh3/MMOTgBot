-- Independent NPC buyback; retain previous behavior for custom items.
ALTER TABLE items ADD sell_price integer NOT NULL DEFAULT 0 CHECK (sell_price >= 0);
--> statement-breakpoint
UPDATE items SET sell_price = CASE WHEN shop_available = 1 AND price > 0 THEN max(1, price / 2) ELSE 0 END;
--> statement-breakpoint
-- Ржавый нож: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'common', damage = 2, defense = 0, heal_amount = 0, price = 50, sell_price = 5, catalog_key = 'rusty_knife' WHERE id = 1 AND catalog_key IS NULL AND name = 'Ржавый нож' AND type = 'weapon' AND rarity = 'common' AND damage = 3 AND defense = 0 AND heal_amount = 0 AND price = 10;
--> statement-breakpoint
-- Кожаная броня: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'common', damage = 0, defense = 1, heal_amount = 0, price = 50, sell_price = 5, catalog_key = 'leather_armor' WHERE id = 2 AND catalog_key IS NULL AND name = 'Кожаная броня' AND type = 'armor' AND rarity = 'common' AND damage = 0 AND defense = 2 AND heal_amount = 0 AND price = 15;
--> statement-breakpoint
-- Малая аптечка: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'common', damage = 0, defense = 0, heal_amount = 15, price = 15, sell_price = 3, catalog_key = 'small_medkit' WHERE id = 3 AND catalog_key IS NULL AND name = 'Малая аптечка' AND type = 'potion' AND rarity = 'common' AND damage = 0 AND defense = 0 AND heal_amount = 10 AND price = 12;
--> statement-breakpoint
-- Металлолом: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'common', damage = 0, defense = 0, heal_amount = 0, price = 5, sell_price = 0, catalog_key = 'scrap_metal' WHERE id = 4 AND catalog_key IS NULL AND name = 'Металлолом' AND type = 'material' AND rarity = 'common' AND damage = 0 AND defense = 0 AND heal_amount = 0 AND price = 5;
--> statement-breakpoint
-- Старая винтовка: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'rare', damage = 4, defense = 0, heal_amount = 0, price = 2500, sell_price = 100, catalog_key = 'old_rifle' WHERE id = 5 AND catalog_key IS NULL AND name = 'Старая винтовка' AND type = 'weapon' AND rarity = 'common' AND damage = 8 AND defense = 0 AND heal_amount = 0 AND price = 30;
--> statement-breakpoint
-- Палка: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'common', damage = 1, defense = 0, heal_amount = 0, price = 2, sell_price = 0, catalog_key = 'training_stick' WHERE catalog_key IS NULL AND (SELECT count(*) FROM items WHERE name = 'Палка' AND type = 'weapon') = 1 AND NOT EXISTS (SELECT 1 FROM items WHERE catalog_key = 'training_stick') AND name = 'Палка' AND type = 'weapon' AND rarity = 'common' AND damage = 1 AND defense = 0 AND heal_amount = 0 AND price = 2;
--> statement-breakpoint
-- Швабра: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'common', damage = 2, defense = 0, heal_amount = 0, price = 50, sell_price = 5 WHERE catalog_key = 'mop' AND type = 'weapon' AND rarity = 'common' AND damage = 3 AND defense = 0 AND heal_amount = 0 AND price = 12;
--> statement-breakpoint
-- Мамин тапок: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'uncommon', damage = 3, defense = 0, heal_amount = 0, price = 300, sell_price = 20 WHERE catalog_key = 'mothers_slipper' AND type = 'weapon' AND rarity = 'uncommon' AND damage = 4 AND defense = 0 AND heal_amount = 0 AND price = 20;
--> statement-breakpoint
-- Степлер судьбы: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'rare', damage = 4, defense = 0, heal_amount = 0, price = 2500, sell_price = 100 WHERE catalog_key = 'fate_stapler' AND type = 'weapon' AND rarity = 'rare' AND damage = 5 AND defense = 0 AND heal_amount = 0 AND price = 35;
--> statement-breakpoint
-- Проклятая шаурма: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'rare', damage = 4, defense = 0, heal_amount = 0, price = 2500, sell_price = 100 WHERE catalog_key = 'cursed_shawarma' AND type = 'weapon' AND rarity = 'rare' AND damage = 6 AND defense = 0 AND heal_amount = 0 AND price = 45;
--> statement-breakpoint
-- Айфон 9: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'epic', damage = 5, defense = 0, heal_amount = 0, price = 20000, sell_price = 500 WHERE catalog_key = 'iphone_9' AND type = 'weapon' AND rarity = 'epic' AND damage = 7 AND defense = 0 AND heal_amount = 0 AND price = 70;
--> statement-breakpoint
-- Квитанция ЖКХ: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'epic', damage = 5, defense = 0, heal_amount = 0, price = 20000, sell_price = 500 WHERE catalog_key = 'utility_bill' AND type = 'weapon' AND rarity = 'epic' AND damage = 7 AND defense = 0 AND heal_amount = 0 AND price = 70;
--> statement-breakpoint
-- Чайник последнего кипячения: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'rare', damage = 4, defense = 0, heal_amount = 0, price = 2500, sell_price = 100 WHERE catalog_key = 'last_boil_kettle' AND type = 'weapon' AND rarity = 'rare' AND damage = 6 AND defense = 0 AND heal_amount = 0 AND price = 50;
--> statement-breakpoint
-- Пылесос душ: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'legendary', damage = 6, defense = 0, heal_amount = 0, price = 150000, sell_price = 5000 WHERE catalog_key = 'soul_vacuum' AND type = 'weapon' AND rarity = 'legendary' AND damage = 8 AND defense = 0 AND heal_amount = 0 AND price = 150;
--> statement-breakpoint
-- Кирпич с дипломом: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'common', damage = 2, defense = 0, heal_amount = 0, price = 50, sell_price = 5 WHERE catalog_key = 'graduate_brick' AND type = 'weapon' AND rarity = 'common' AND damage = 3 AND defense = 0 AND heal_amount = 0 AND price = 12;
--> statement-breakpoint
-- Батон позавчерашний: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'common', damage = 2, defense = 0, heal_amount = 0, price = 50, sell_price = 5 WHERE catalog_key = 'day_before_yesterday_loaf' AND type = 'weapon' AND rarity = 'common' AND damage = 3 AND defense = 0 AND heal_amount = 0 AND price = 10;
--> statement-breakpoint
-- Вантуз начинающего мага: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'common', damage = 2, defense = 0, heal_amount = 0, price = 50, sell_price = 5 WHERE catalog_key = 'apprentice_plunger' AND type = 'weapon' AND rarity = 'common' AND damage = 3 AND defense = 0 AND heal_amount = 0 AND price = 14;
--> statement-breakpoint
-- Кастрюля «Не трогай, на завтра»: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'common', damage = 0, defense = 1, heal_amount = 0, price = 50, sell_price = 5 WHERE catalog_key = 'tomorrow_pot' AND type = 'armor' AND rarity = 'common' AND damage = 0 AND defense = 2 AND heal_amount = 0 AND price = 16;
--> statement-breakpoint
-- Сковорода семейного правосудия: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'uncommon', damage = 3, defense = 0, heal_amount = 0, price = 300, sell_price = 20 WHERE catalog_key = 'family_justice_pan' AND type = 'weapon' AND rarity = 'uncommon' AND damage = 4 AND defense = 0 AND heal_amount = 0 AND price = 24;
--> statement-breakpoint
-- Удлинитель на полрайона: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'uncommon', damage = 3, defense = 0, heal_amount = 0, price = 300, sell_price = 20 WHERE catalog_key = 'district_extension_cord' AND type = 'weapon' AND rarity = 'uncommon' AND damage = 4 AND defense = 0 AND heal_amount = 0 AND price = 26;
--> statement-breakpoint
-- Носок самостоятельной жизни: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'uncommon', damage = 3, defense = 0, heal_amount = 0, price = 300, sell_price = 20 WHERE catalog_key = 'independent_sock' AND type = 'weapon' AND rarity = 'uncommon' AND damage = 4 AND defense = 0 AND heal_amount = 0 AND price = 22;
--> statement-breakpoint
-- Суп «Мама передала»: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'uncommon', damage = 0, defense = 0, heal_amount = 25, price = 40, sell_price = 8 WHERE catalog_key = 'mothers_soup' AND type = 'potion' AND rarity = 'uncommon' AND damage = 0 AND defense = 0 AND heal_amount = 20 AND price = 22;
--> statement-breakpoint
-- Мышка с двойным кликом: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'rare', damage = 4, defense = 0, heal_amount = 0, price = 2500, sell_price = 100 WHERE catalog_key = 'double_click_mouse' AND type = 'weapon' AND rarity = 'rare' AND damage = 5 AND defense = 0 AND heal_amount = 0 AND price = 38;
--> statement-breakpoint
-- Папка «Новая папка (37)»: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'rare', damage = 4, defense = 0, heal_amount = 0, price = 2500, sell_price = 100 WHERE catalog_key = 'new_folder_37' AND type = 'weapon' AND rarity = 'rare' AND damage = 5 AND defense = 0 AND heal_amount = 0 AND price = 40;
--> statement-breakpoint
-- Дуршлаг ясного разума: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'rare', damage = 0, defense = 3, heal_amount = 0, price = 2500, sell_price = 100 WHERE catalog_key = 'clear_mind_colander' AND type = 'armor' AND rarity = 'rare' AND damage = 0 AND defense = 3 AND heal_amount = 0 AND price = 42;
--> statement-breakpoint
-- Кофе «Дедлайн вчера»: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'rare', damage = 0, defense = 0, heal_amount = 35, price = 100, sell_price = 20, passive_id = NULL, passive_params = '{}', shop_available = 1, description = 'Бодрящий глоток возвращает 35 HP. Дедлайн всё ещё вчера.' WHERE catalog_key = 'yesterday_deadline_coffee' AND type = 'potion' AND rarity = 'rare' AND damage = 0 AND defense = 0 AND heal_amount = 0 AND price = 45;
--> statement-breakpoint
-- Клавиатура вечного CAPS LOCK: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'epic', damage = 5, defense = 0, heal_amount = 0, price = 20000, sell_price = 500 WHERE catalog_key = 'eternal_caps_keyboard' AND type = 'weapon' AND rarity = 'epic' AND damage = 7 AND defense = 0 AND heal_amount = 0 AND price = 75;
--> statement-breakpoint
-- Пульт от всего, кроме телевизора: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'epic', damage = 5, defense = 0, heal_amount = 0, price = 20000, sell_price = 500 WHERE catalog_key = 'everything_remote' AND type = 'weapon' AND rarity = 'epic' AND damage = 7 AND defense = 0 AND heal_amount = 0 AND price = 78;
--> statement-breakpoint
-- Шапочка из фольги PRO MAX: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'epic', damage = 0, defense = 4, heal_amount = 0, price = 20000, sell_price = 500 WHERE catalog_key = 'foil_hat_pro_max' AND type = 'armor' AND rarity = 'epic' AND damage = 0 AND defense = 4 AND heal_amount = 0 AND price = 80;
--> statement-breakpoint
-- Флешка «Курсовая_финал_точно»: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'epic', damage = 5, defense = 0, heal_amount = 0, price = 20000, sell_price = 500 WHERE catalog_key = 'final_thesis_usb' AND type = 'weapon' AND rarity = 'epic' AND damage = 7 AND defense = 0 AND heal_amount = 0 AND price = 72;
--> statement-breakpoint
-- Банхаммер районного чата: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'legendary', damage = 6, defense = 0, heal_amount = 0, price = 150000, sell_price = 5000 WHERE catalog_key = 'district_chat_banhammer' AND type = 'weapon' AND rarity = 'legendary' AND damage = 8 AND defense = 0 AND heal_amount = 0 AND price = 160;
--> statement-breakpoint
-- Тапок администратора вселенной: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'legendary', damage = 6, defense = 0, heal_amount = 0, price = 150000, sell_price = 5000 WHERE catalog_key = 'universe_admin_slipper' AND type = 'weapon' AND rarity = 'legendary' AND damage = 8 AND defense = 0 AND heal_amount = 0 AND price = 155;
--> statement-breakpoint
-- Халат главного по подъезду: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'legendary', damage = 0, defense = 5, heal_amount = 0, price = 150000, sell_price = 5000 WHERE catalog_key = 'entrance_chief_robe' AND type = 'armor' AND rarity = 'legendary' AND damage = 0 AND defense = 5 AND heal_amount = 0 AND price = 150;
--> statement-breakpoint
-- Пельмень первозданный: update the standard profile only; preserve custom numeric edits.
UPDATE items SET rarity = 'legendary', damage = 0, defense = 0, heal_amount = 45, price = 600, sell_price = 100 WHERE catalog_key = 'primordial_dumpling' AND type = 'potion' AND rarity = 'legendary' AND damage = 0 AND defense = 0 AND heal_amount = 60 AND price = 90;
--> statement-breakpoint
-- Keep inventory instances; incompatible equipment returns to the bag. Active battles retain their snapshots.
UPDATE inventory_items SET equiped = 0 WHERE equiped = 1 AND item_type IN (
 SELECT i.id FROM items i WHERE i.type IN ('weapon', 'armor') AND
 (SELECT level FROM players WHERE id = inventory_items.player_id) <
 CASE i.rarity WHEN 'uncommon' THEN 2 WHEN 'rare' THEN 3 WHEN 'epic' THEN 5 WHEN 'legendary' THEN 7 ELSE 1 END
);
