import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

test('round migration preserves progress/HP, releases old active sessions and adds no tables', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'mmobot-round-migration-'));
  const source = fileURLToPath(new URL('../drizzle/', import.meta.url));
  const old = path.join(directory, 'old');
  mkdirSync(path.join(old, 'meta'), { recursive: true });
  const journal = JSON.parse(readFileSync(path.join(source, 'meta/_journal.json'), 'utf8'));
  journal.entries = journal.entries.filter(e => e.idx < 28);
  writeFileSync(path.join(old, 'meta/_journal.json'), JSON.stringify(journal));
  for (const e of journal.entries) copyFileSync(path.join(source, e.tag + '.sql'), path.join(old, e.tag + '.sql'));
  const connection = new Database(path.join(directory, 'test.db'));
  try {
    connection.pragma('foreign_keys = ON');
    migrate(drizzle(connection), { migrationsFolder: old });
    connection.exec(`INSERT INTO locations (id, name, description, x, y, homeImg, fightImg) VALUES ('arena', 'A', 'A', 0, 0, 'a', 'b');
      INSERT INTO mobs (id, name, description, level, max_health, strength, defense, loot, points_reward, location_id, respawn_seconds)
        VALUES (1, 'M', 'M', 1, 100, 10, 5, '[]', 1, 'arena', 1);
      INSERT INTO players (id, friend_id, name, health, xp, money, created_at, last_seen_at, last_regen_time, id_the_last_action) VALUES
        (1, 1, 'A', 100, 123, 55, 'now', 'now', 'now', '{"id":1,"type":"Fight"}'),
        (2, 2, 'B', 100, 456, 66, 'now', 'now', 'now', '{"id":1,"type":"Fight"}'),
        (3, 3, 'C', 100, 789, 77, 'now', 'now', 'now', '{"id":1,"type":"TakeAWalk"}');
      INSERT INTO combat_sessions (id, player_id, mob_id, player_health, mob_health, status, started_at, last_action_at)
        VALUES (1, 3, 1, 42, 80, 'active', 'start', 'last');
      INSERT INTO pvp_sessions (id, player_1_id, player_2_id, player_1_health, player_2_health, status, turn, creadet_at, last_action_at)
        VALUES (1, 1, 2, 70, 30, 'active', 'player1', 'start', 'last'),
          (2, 1, 2, 100, 100, 'pending', 'player1', 'start', NULL),
          (3, 1, 2, 90, 0, 'finished', 'player1', 'start', 'last');`);
    const before = connection.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();
    // Scope the no-new-tables assertion to the round migration being tested.
    journal.entries = JSON.parse(readFileSync(path.join(source, 'meta/_journal.json'), 'utf8')).entries.filter(e => e.idx <= 28);
    writeFileSync(path.join(old, 'meta/_journal.json'), JSON.stringify(journal));
    copyFileSync(path.join(source, '0028_round_combat.sql'), path.join(old, '0028_round_combat.sql'));
    migrate(drizzle(connection), { migrationsFolder: old });
    assert.deepEqual(connection.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all(), before);
    assert.deepEqual(connection.prepare('SELECT health FROM players ORDER BY id').all().map(r => r.health), [70, 30, 42]);
    assert.deepEqual(connection.prepare('SELECT xp, money FROM players ORDER BY id').all(), [{ xp: 123, money: 55 }, { xp: 456, money: 66 }, { xp: 789, money: 77 }]);
    assert.ok(connection.prepare('SELECT id_the_last_action FROM players').all().every(r => r.id_the_last_action === null));
    assert.equal(connection.prepare('SELECT status FROM combat_sessions WHERE id = 1').get().status, 'aborted');
    assert.deepEqual(connection.prepare('SELECT status, winner_id FROM pvp_sessions ORDER BY id').all(), [
      { status: 'finished', winner_id: null }, { status: 'pending', winner_id: null }, { status: 'finished', winner_id: null }]);
    for (const table of ['combat_sessions', 'pvp_sessions']) {
      const columns = connection.pragma(`table_info(${table})`).map(c => c.name);
      for (const column of ['round_number', 'round_started_at', 'state_version', 'battle_state']) assert.ok(columns.includes(column));
      for (const column of ['rules_version', 'finished_at', 'round_deadline_at']) assert.ok(!columns.includes(column));
    }
    connection.exec(`INSERT INTO combat_sessions (player_id, mob_id, player_health, mob_health, status, started_at, last_action_at) VALUES (3, 1, 42, 100, 'active', 'now', 'now')`);
    assert.throws(() => connection.exec(`INSERT INTO combat_sessions (player_id, mob_id, player_health, mob_health, status, started_at, last_action_at) VALUES (3, 1, 42, 100, 'active', 'now', 'now')`), /UNIQUE/);
    assert.deepEqual(connection.pragma('foreign_key_check'), []);
    // Running migrations a second time must not close newly started battles.
    migrate(drizzle(connection), { migrationsFolder: source });
    assert.equal(connection.prepare("SELECT count(*) n FROM combat_sessions WHERE status = 'active'").get().n, 1);
  } finally { connection.close(); rmSync(directory, { recursive: true, force: true }); }
});
