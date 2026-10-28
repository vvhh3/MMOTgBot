import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

test('retention migration only adds indexes, preserves existing data and can be applied twice', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'mmobot-retention-migration-'));
  const source = fileURLToPath(new URL('../drizzle/', import.meta.url));
  const old = path.join(directory, 'old');
  mkdirSync(path.join(old, 'meta'), { recursive: true });
  const journal = JSON.parse(readFileSync(path.join(source, 'meta/_journal.json'), 'utf8'));
  journal.entries = journal.entries.filter(e => e.idx < 35);
  writeFileSync(path.join(old, 'meta/_journal.json'), JSON.stringify(journal));
  for (const entry of journal.entries) copyFileSync(path.join(source, `${entry.tag}.sql`), path.join(old, `${entry.tag}.sql`));
  const connection = new Database(path.join(directory, 'test.db'));
  try {
    connection.pragma('foreign_keys = ON');
    const db = drizzle(connection);
    migrate(db, { migrationsFolder: old });
    connection.exec(`
      INSERT INTO locations (id, name, description, x, y, homeImg, fightImg) VALUES ('arena', 'A', 'A', 0, 0, 'a', 'b');
      INSERT INTO players (id, friend_id, name, health, xp, money, created_at, last_seen_at, last_regen_time, id_the_last_action) VALUES
        (1, 1, 'A', 70, 123, 55, '2020-01-01', '2020-01-01', '2020-01-01', '{"type":"TakeAWalk","id":1}'),
        (2, 2, 'B', 80, 456, 66, '2020-01-01', '2020-01-01', '2020-01-01', '{"type":"Fight","id":1}');
      INSERT INTO mobs (id, name, description, level, max_health, strength, defense, loot, points_reward, location_id, respawn_seconds)
        VALUES (1, 'M', 'M', 1, 100, 10, 5, '[]', 1, 'arena', 1);
      INSERT INTO combat_sessions (id, player_id, mob_id, player_health, mob_health, status, started_at, last_action_at, battle_state) VALUES
        (1, 1, 1, 70, 100, 'active', '2020-01-01', '2020-01-01', '{"processedRequests":[{"requestId":"saved"}],"events":[]}'),
        (2, 1, 1, 70, 0, 'victory', '2020-01-01', '2020-01-01', '{"droppedItems":[{"id":3}]}');
      INSERT INTO pvp_sessions (id, player_1_id, player_2_id, player_1_health, player_2_health, status, creadet_at, last_action_at) VALUES
        (1, 1, 2, 70, 80, 'active', '2020-01-01', '2020-01-01'),
        (2, 1, 2, 70, 80, 'finished', '2020-01-01', NULL),
        (3, 1, 2, 70, 80, 'pending', '2020-01-01', NULL);
      INSERT INTO events (player_id, location_id, type, created_at) VALUES (1, 'arena', 'walk', '2020-01-01');
      INSERT INTO inventory_items (player_id, item_type, quantity, acquired_at) VALUES (1, 3, 2, '2020-01-01');
      INSERT INTO quests (id, title, description, difficulty, objective_type, target_count) VALUES (1, 'Q', 'Q', 'easy', 'kill', 5);
      INSERT INTO player_quests (player_id, quest_id, assigned_day, progress) VALUES (1, 1, '2020-01-01', 3);
    `);
    const tables = ['players', 'mobs', 'combat_sessions', 'pvp_sessions', 'events', 'inventory_items', 'quests', 'player_quests'];
    const snapshot = () => Object.fromEntries(tables.map(table => [table, connection.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));
    const before = snapshot();
    migrate(db, { migrationsFolder: source });
    assert.deepEqual(snapshot(), before);
    for (const [table, index, filter] of [
      ['combat_sessions', 'combat_sessions_status_last_action_idx', "status IN ('victory', 'defeat', 'fled', 'aborted') AND last_action_at <= ?"],
      ['pvp_sessions', 'pvp_status_last_action_idx', "status = 'finished' AND last_action_at <= ?"],
      ['events', 'events_created_idx', 'created_at < ?'],
    ]) {
      assert.ok(connection.pragma(`index_list(${table})`).some(row => row.name === index));
      const plan = connection.prepare(`EXPLAIN QUERY PLAN SELECT id FROM ${table} WHERE ${filter} LIMIT 500`).all('2026-01-01');
      assert.ok(plan.some(row => row.detail.includes(index)), JSON.stringify(plan));
    }
    migrate(db, { migrationsFolder: source });
    assert.deepEqual(snapshot(), before);
    assert.deepEqual(connection.pragma('foreign_key_check'), []);
    assert.equal(connection.pragma('integrity_check', { simple: true }), 'ok');
  } finally { connection.close(); rmSync(directory, { recursive: true, force: true }); }
});
