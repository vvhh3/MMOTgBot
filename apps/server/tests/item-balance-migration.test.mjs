import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

test('item balance migrates standard records once, preserving custom items, wallets, instances and active snapshots', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'mmobot-item-migration-'));
  const source = fileURLToPath(new URL('../drizzle/', import.meta.url));
  const old = path.join(directory, 'migrations');
  mkdirSync(path.join(old, 'meta'), { recursive: true });
  const journal = JSON.parse(readFileSync(path.join(source, 'meta/_journal.json'), 'utf8'));
  journal.entries = journal.entries.filter(e => e.idx < 32);
  writeFileSync(path.join(old, 'meta/_journal.json'), JSON.stringify(journal));
  for (const e of journal.entries) copyFileSync(path.join(source, `${e.tag}.sql`), path.join(old, `${e.tag}.sql`));
  const sqlite = new Database(path.join(directory, 'test.db'));
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite);
  try {
    migrate(db, { migrationsFolder: old });
    sqlite.exec(`
      INSERT INTO locations (id, name, description, x, y, homeImg, fightImg, is_open)
        VALUES ('square', 'Square', 'Keep', 1, 1, 'home', 'fight', 1);
      INSERT INTO players (id, friend_id, name, level, money, created_at, last_seen_at, last_regen_time)
        VALUES (1, 1, 'Low', 1, 777, 'now', 'now', 'now'), (2, 2, 'High', 7, 999, 'now', 'now', 'now');
      INSERT INTO items (id, name, description, type, rarity, damage, price, shop_available, catalog_key) VALUES
        (1, 'Ржавый нож', 'Keep description', 'weapon', 'common', 3, 10, 1, NULL),
        (5, 'Старая винтовка', 'Keep rifle', 'weapon', 'common', 8, 30, 1, NULL),
        (10, 'Пылесос душ', 'Keep vacuum', 'weapon', 'legendary', 8, 150, 1, 'soul_vacuum'),
        (11, 'Авторская швабра', 'Keep numeric edits', 'weapon', 'common', 9, 777, 1, 'mop'),
        (99, 'Палка', 'Keep stick ID', 'weapon', 'common', 1, 2, 0, NULL);
      INSERT INTO items (id, name, description, type, rarity, heal_amount, price, shop_available, catalog_key, passive_id)
        VALUES (12, 'Кофе «Дедлайн вчера»', 'Old coffee', 'potion', 'rare', 0, 45, 0, 'yesterday_deadline_coffee', 'caffeine_credit');
      INSERT INTO inventory_items (id, player_id, item_type, quantity, acquired_at, equiped, weapon_level)
        VALUES (42, 1, 5, 1, 'old', 1, 4), (43, 2, 10, 1, 'old', 1, 6);
      INSERT INTO mobs (id, name, description, level, max_health, strength, defense, loot, points_reward, coin_reward, respawn_seconds, location_id)
        VALUES (1, 'Keep mob', 'Keep', 1, 100, 5, 2, '[]', 20, 30, 60, 'square');
      INSERT INTO combat_sessions (player_id, mob_id, player_health, mob_health, started_at, last_action_at, battle_state)
        VALUES (1, 1, 70, 90, 'old', 'old', '{"fighters":[{"strength":18}],"choices":["weapon_attack",null]}');
    `);
    const snapshot = sqlite.prepare('SELECT battle_state FROM combat_sessions').get();
    const mob = sqlite.prepare('SELECT * FROM mobs').get();
    migrate(db, { migrationsFolder: source });
    const item = id => sqlite.prepare('SELECT * FROM items WHERE id = ?').get(id);
    assert.equal(item(1).damage, 2);
    assert.equal(item(1).price, 50);
    assert.equal(item(1).sell_price, 5);
    assert.equal(item(1).description, 'Keep description');
    assert.equal(item(5).rarity, 'rare');
    assert.equal(item(5).damage, 4);
    assert.equal(item(5).price, 2500);
    assert.equal(item(10).price, 150000);
    assert.equal(item(10).sell_price, 5000);
    assert.equal(item(11).damage, 9);
    assert.equal(item(11).price, 777);
    assert.equal(item(11).sell_price, 388);
    assert.equal(item(12).heal_amount, 35);
    assert.equal(item(12).shop_available, 1);
    assert.equal(item(12).passive_id, null);
    assert.equal(item(99).catalog_key, 'training_stick');
    assert.equal(item(99).damage, 1);
    assert.deepEqual(sqlite.prepare('SELECT money FROM players ORDER BY id').all(), [{ money: 777 }, { money: 999 }]);
    assert.deepEqual(sqlite.prepare('SELECT id, weapon_level, equiped FROM inventory_items ORDER BY id').all(), [
      { id: 42, weapon_level: 4, equiped: 0 }, { id: 43, weapon_level: 6, equiped: 1 },
    ]);
    assert.deepEqual(sqlite.prepare('SELECT battle_state FROM combat_sessions').get(), snapshot);
    assert.deepEqual(sqlite.prepare('SELECT * FROM mobs').get(), mob);
    sqlite.exec('UPDATE items SET price = 222222 WHERE id = 10');
    migrate(db, { migrationsFolder: source });
    assert.equal(item(10).price, 222222);
    assert.deepEqual(sqlite.pragma('foreign_key_check'), []);
  } catch (error) {
    throw new Error(error.message, { cause: error });
  } finally {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
