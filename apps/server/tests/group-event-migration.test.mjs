import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

test('co-op migration only adds five tables and preserves existing players, battles and retention indexes', () => {
  const directory = mkdtempSync(path.join(tmpdir(),'mmobot-group-migration-'));
  const source = fileURLToPath(new URL('../drizzle/',import.meta.url)), old = path.join(directory,'old');
  mkdirSync(path.join(old,'meta'),{recursive:true});
  const journal = JSON.parse(readFileSync(path.join(source,'meta/_journal.json'),'utf8'));
  journal.entries = journal.entries.filter(e=>e.idx<36);
  writeFileSync(path.join(old,'meta/_journal.json'),JSON.stringify(journal));
  for(const e of journal.entries) copyFileSync(path.join(source,`${e.tag}.sql`),path.join(old,`${e.tag}.sql`));
  const connection = new Database(path.join(directory,'test.db'));
  try {
    connection.pragma('foreign_keys=ON'); migrate(drizzle(connection),{migrationsFolder:old});
    connection.exec(`INSERT INTO locations (id,name,description,x,y,homeImg,fightImg) VALUES ('square','Площадь','Тест',0,0,'a','b');
      INSERT INTO players(id,friend_id,name,health,xp,money,created_at,last_seen_at,last_regen_time) VALUES (1,1,'Игрок',72,123,456,'now','now','now'),(2,2,'Друг',90,1,2,'now','now','now');
      INSERT INTO mobs(id,name,description,level,max_health,strength,defense,loot,points_reward,location_id,respawn_seconds) VALUES (1,'Моб','Моб',1,100,10,5,'[]',1,'square',1);
      INSERT INTO combat_sessions(player_id,mob_id,player_health,mob_health,status,started_at,last_action_at) VALUES (1,1,72,42,'active','now','now');`);
    const before = connection.prepare('SELECT * FROM players ORDER BY id').all();
    const battle = connection.prepare('SELECT * FROM combat_sessions').get();
    const tables = connection.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name);
    migrate(drizzle(connection),{migrationsFolder:source});
    assert.deepEqual(connection.prepare('SELECT * FROM players ORDER BY id').all(),before);
    assert.deepEqual(connection.prepare('SELECT * FROM combat_sessions').get(),battle);
    assert.deepEqual(connection.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name).filter(n=>!tables.includes(n)).sort(),['event_parties','event_party_members','group_event_rewards','group_event_runs','group_event_windows']);
    assert.ok(connection.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='combat_sessions_status_last_action_idx'").get());
    connection.exec(`INSERT INTO group_event_windows(id,location_id,starts_at,ends_at,config,created_at,updated_at) VALUES(1,'square','2026-10-27T10:00:00Z','2026-10-27T11:00:00Z','{}','now','now');
      INSERT INTO event_parties(id,event_window_id,leader_player_id,creation_request_id,creation_fingerprint,created_at,updated_at,expires_at) VALUES(1,1,1,'a','a','now','now','later'),(2,1,2,'b','b','now','now','later');
      INSERT INTO event_party_members(party_id,player_id,slot,status,created_at) VALUES(1,1,0,'joined','now');`);
    assert.throws(()=>connection.exec("INSERT INTO event_party_members(party_id,player_id,slot,status,created_at) VALUES(2,1,0,'joined','now')"),/UNIQUE/);
    assert.throws(()=>connection.exec("INSERT INTO event_party_members(party_id,player_id,slot,status,created_at) VALUES(1,2,0,'invited','now')"),/UNIQUE/);
    assert.throws(()=>connection.exec("INSERT INTO event_party_members(party_id,player_id,slot,status,created_at) VALUES(1,2,3,'invited','now')"),/CHECK/);
    assert.throws(()=>connection.exec("UPDATE event_party_members SET status='forged'"),/CHECK/);
    assert.throws(()=>connection.exec("UPDATE group_event_windows SET min_level=1.5"),/CHECK/);
    migrate(drizzle(connection),{migrationsFolder:source});
    assert.equal(connection.prepare('SELECT status FROM combat_sessions').get().status,'active');
    assert.deepEqual(connection.pragma('foreign_key_check'),[]);
  } finally { connection.close(); rmSync(directory,{recursive:true,force:true}); }
});
