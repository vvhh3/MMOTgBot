import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { and, eq } from 'drizzle-orm';
import { getItemMinLevel } from '@mmobot/shared';

const directory = mkdtempSync(path.join(tmpdir(), 'mmobot-square-'));
process.env.DATABASE_PATH = path.join(directory, 'test.db');
process.env.BOT_TOKEN = '123456:test-token';
process.env.SESSION_SECRET = 'square-tests';
process.env.DEV_BYPASS_AUTH = 'false';
const emit = mock.fn();
mock.module('../dist/infrastructure/telegram/notifications.js', { namedExports: { notify: mock.fn() } });
mock.module('../dist/infrastructure/realtime/socket-server.js', { namedExports: {
  emitToPlayer: emit, broadcastLocation: mock.fn(), moveSocketToLocation: mock.fn(), isPlayerOnline: () => false,
} });
const { nowGameTime, todayGameDate } = await import('../dist/shared/time.js');
const { createBattle } = await import('../dist/modules/combat/battle/engine.js');
const migrationSource = fileURLToPath(new URL('../drizzle/', import.meta.url));
const oldMigrations = path.join(directory, 'old-migrations');
mkdirSync(path.join(oldMigrations, 'meta'), { recursive: true });
const journal = JSON.parse(readFileSync(path.join(migrationSource, 'meta/_journal.json'), 'utf8'));
journal.entries = journal.entries.filter(entry => entry.idx < 33);
writeFileSync(path.join(oldMigrations, 'meta/_journal.json'), JSON.stringify(journal));
for (const entry of journal.entries) copyFileSync(path.join(migrationSource, `${entry.tag}.sql`), path.join(oldMigrations, `${entry.tag}.sql`));
const legacy = new Database(process.env.DATABASE_PATH);
legacy.pragma('foreign_keys = ON');
migrate(drizzle(legacy), { migrationsFolder: oldMigrations });
legacy.exec(`
  INSERT INTO locations (id,name,description,x,y,homeImg,fightImg,is_open) VALUES ('square','Площадь','Площадь',1,1,'a','b',1);
  INSERT INTO players (id,friend_id,name,current_location_id,money,created_at,last_seen_at,last_regen_time)
    VALUES (1,1,'Игрок','square',123,'${nowGameTime()}','${nowGameTime()}','${nowGameTime()}');
  INSERT INTO mobs (id,name,description,level,max_health,strength,defense,loot,points_reward,coin_reward,location_id,respawn_seconds)
    VALUES (0,'Крыса','Старая',1,25,2,0,'[]',10,5,'square',60);
  INSERT INTO quests (id,title,description,difficulty,objective_type,target_id,target_count,target_coins)
    VALUES (900,'Старое поручение','Старая цель','easy','kill','0',2,20),
      (901,'Готовое поручение','Награда ожидает','medium','kill','0',1,25),
      (902,'Полученное поручение','Уже оплачено','hard','kill','0',1,30);
  INSERT INTO player_quests (player_id,quest_id,assigned_day,progress,status) VALUES
    (1,900,'${todayGameDate()}',1,'waiting'),(1,901,'${todayGameDate()}',1,'completed'),(1,902,'${todayGameDate()}',1,'claimed');
`);
const oldState = createBattle([
  { name: 'Игрок', maxHp: 100, strength: 10, defense: 5, moves: [] },
  { name: 'Крыса', maxHp: 25, strength: 2, defense: 0, moves: [{ id: 'mob_attack', name: 'Атака', kind: 'attack', power: 1, accuracy: 100, priority: 0, cooldownRounds: 0 }] },
]);
legacy.prepare('INSERT INTO combat_sessions (player_id,mob_id,player_health,mob_health,started_at,last_action_at,battle_state) VALUES (1,0,77,12,?,?,?)')
  .run(nowGameTime(), nowGameTime(), JSON.stringify(oldState));
legacy.exec('UPDATE players SET id_the_last_action = \'{"id":1,"type":"TakeAWalk"}\' WHERE id = 1');
legacy.close();

const { db, sqlite } = await import('../dist/database/connection.js');
const { initializeDatabase } = await import('../dist/database/initialize.js');
const { mobs, players, items, quests, playerQuests, combatSessions, events } = await import('../dist/database/schema.js');
const { scaleMob, chooseEncounter, chooseMobMove } = await import('../dist/modules/mobs/balance.js');
const { SQUARE_MOBS } = await import('../dist/modules/mobs/catalogs/square.js');
const { createLocationRoutes } = await import('../dist/modules/locations/routes.js');
const { createCombatRoutes } = await import('../dist/modules/combat/routes.js');
const { startCombat, getCombatState, moveCombatAction } = await import('../dist/modules/combat/pve.js');
const { createSessionToken } = await import('../dist/modules/auth/auth.js');
const { buildLocationState } = await import('../dist/modules/locations/state.js');
initializeDatabase();
after(() => { sqlite.close(); rmSync(directory, { recursive: true, force: true }); });
const routes = new Map();
const app = { use() {}, ...Object.fromEntries(['get', 'post'].map(method => [method, (route, ...handlers) => routes.set(`${method} ${route}`, handlers)])) };
createLocationRoutes(app);
createCombatRoutes(app);
const getPlayer = id => db.select().from(players).where(eq(players.id, id)).get();
const profile = key => db.select().from(mobs).where(eq(mobs.catalogKey, key)).get();
const activeMobs = () => db.select().from(mobs).where(eq(mobs.isActive, true)).all();
let nextPlayer = 10;
function player(overrides = {}) {
  const id = nextPlayer++;
  return db.insert(players).values({ id, friendId: id, name: `Игрок ${id}`, currentLocationId: 'square',
    createdAt: nowGameTime(), lastSeenAt: nowGameTime(), lastRegenTime: nowGameTime(), ...overrides }).returning().get();
}
function request(route, id, body = {}, locationId = 'square') {
  const req = { player: getPlayer(id), body, params: { id: locationId }, query: {}, header: () => `Bearer ${createSessionToken(id)}` };
  const result = { status: 200 };
  const res = { status(code) { result.status = code; return this; }, json(value) { result.body = value; return this; } };
  let index = 0;
  const next = () => routes.get(`post ${route}`)[index++]?.(req, res, next);
  next();
  return result;
}

test('upgrade archives old mobs and quests, preserves active battles and earned rewards, replaces only pending assignments', () => {
  assert.equal(db.select().from(mobs).where(eq(mobs.id, 0)).get().isActive, false);
  assert.equal(activeMobs().length, 10);
  assert.ok(activeMobs().every(mob => mob.locationId === 'square'));
  const battle = db.select().from(combatSessions).where(eq(combatSessions.id, 1)).get();
  assert.equal(battle.status, 'active');
  assert.equal(battle.playerHealth, 77);
  assert.equal(battle.mobHealth, 12);
  assert.equal(battle.battleState.encounter.coinReward, 5);
  assert.deepEqual(getPlayer(1).idTheLastAction, { id: 1, type: 'TakeAWalk' });
  const assignments = db.select().from(playerQuests).where(eq(playerQuests.playerId, 1)).all();
  assert.notEqual(assignments[0].questId, 900);
  assert.equal(assignments[0].progress, 0);
  assert.equal(assignments[1].questId, 901);
  assert.equal(assignments[1].status, 'completed');
  assert.equal(assignments[2].questId, 902);
  assert.equal(assignments[2].status, 'claimed');
  assert.equal(getPlayer(1).money, 123);
  assert.deepEqual(sqlite.pragma('foreign_key_check'), []);
});

test('restarts preserve IDs, admin stats, empty loot, archives and existing assignments', () => {
  const target = profile('square_bench');
  const assignments = db.select().from(playerQuests).all();
  db.update(mobs).set({ maxHealth: 70, loot: [] }).where(eq(mobs.id, target.id)).run();
  initializeDatabase();
  assert.equal(profile('square_bench').id, target.id);
  assert.equal(profile('square_bench').maxHealth, 70);
  assert.deepEqual(profile('square_bench').loot, []);
  assert.equal(activeMobs().length, 10);
  assert.deepEqual(db.select().from(playerQuests).all(), assignments);
  db.update(mobs).set({ maxHealth: target.maxHealth, loot: target.loot }).where(eq(mobs.id, target.id)).run();
});

test('weighted encounters have exact rank boundaries and never select archived or off-square mobs', () => {
  const pool = activeMobs();
  for (const [roll, rank] of [[0, 'normal'], [.69999, 'normal'], [.7, 'strong'], [.91999, 'strong'], [.92, 'elite'], [.97999, 'elite'], [.98, 'boss'], [.99999, 'boss']]) {
    const selected = chooseEncounter(pool, () => roll);
    assert.equal(SQUARE_MOBS.find(mob => mob.key === selected.catalogKey).rank, rank);
  }
  assert.equal(chooseEncounter(pool.map(mob => ({ ...mob, isActive: false }))), undefined);
  assert.equal(chooseEncounter(pool.map(mob => ({ ...mob, locationId: 'park' }))), undefined);
});

test('levels 1–8 scale monotonically, gate equipment rarity and never overwrite shared templates', () => {
  const catalog = db.select().from(items).all();
  for (const template of activeMobs()) {
    let previous;
    for (let level = 1; level <= 8; level++) {
      const { mob } = scaleMob(template, level, catalog);
      assert.equal(mob.level, level);
      assert.ok(mob.maxHealth > 0 && mob.strength > 0 && mob.defense >= 0);
      if (previous) assert.ok(mob.maxHealth >= previous.maxHealth && mob.strength >= previous.strength && mob.defense >= previous.defense);
      assert.ok(mob.loot.every(entry => getItemMinLevel(catalog.find(item => item.id === entry.itemType)) <= level));
      previous = mob;
    }
    assert.equal(profile(template.catalogKey).level, 1);
    assert.equal(profile(template.catalogKey).maxHealth, template.maxHealth);
  }
  const dropIds = new Set(activeMobs().flatMap(mob => mob.loot.map(entry => entry.itemType)));
  assert.ok(catalog.every(item => dropIds.has(item.id)), 'every existing catalog item has a source');
});

test('walk chooses a boss on the server, counts the walk once, and two players keep independent battles', () => {
  const first = player({ level: 7, xp: 2200 });
  const second = player({ level: 2, xp: 100 });
  const rng = mock.method(Math, 'random', () => .999);
  try {
    const a = request('/locations/:id/action', first.id, { actionId: 'walk', mobId: profile('square_pigeon').id });
    const b = request('/locations/:id/action', second.id, { actionId: 'walk' });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(b.status, 200, JSON.stringify(b.body));
    assert.equal(a.body.combat.mob.name, 'Четырка');
    assert.equal(a.body.combat.mob.level, 7);
    assert.equal(b.body.combat.mob.level, 2);
    assert.notEqual(a.body.combat.id, b.body.combat.id);
    assert.ok(a.body.combat.mobMaxHp > b.body.combat.mobMaxHp);
    assert.equal(a.body.player.xp, 2202);
    assert.equal(request('/locations/:id/action', first.id, { actionId: 'walk' }).status, 409);
    assert.equal(getPlayer(first.id).xp, 2202);
    assert.equal(db.select().from(events).where(and(eq(events.playerId, first.id), eq(events.type, 'walk'))).all().length, 1);
    assert.ok(emit.mock.calls.some(call => call.arguments[0] === first.id && call.arguments[1] === 'combatState'));
    const target = profile('square_fourteen');
    assert.ok(buildLocationState('square').mobs.some(mob => mob.id === target.id));
    const before = db.select().from(combatSessions).where(eq(combatSessions.id, b.body.combat.id)).get();
    db.update(players).set({ strength: 10000 }).where(eq(players.id, first.id)).run();
    // Modify the existing fighter snapshot only for this isolation assertion.
    const session = db.select().from(combatSessions).where(eq(combatSessions.id, a.body.combat.id)).get();
    session.battleState.fighters[0].strength = 10000;
    db.update(combatSessions).set({ battleState: session.battleState }).where(eq(combatSessions.id, session.id)).run();
    rng.mock.restore();
    const winRng = mock.method(Math, 'random', () => 0);
    try { assert.equal(moveCombatAction(getPlayer(first.id), target, session, 'attack').status, 'victory'); }
    finally { winRng.mock.restore(); }
    assert.ok(buildLocationState('square').mobs.some(mob => mob.id === target.id));
    assert.deepEqual(db.select().from(combatSessions).where(eq(combatSessions.id, before.id)).get(), before);
  } finally { rng.mock.restore(); }
});

test('encounter stats, rewards, loot and chosen action survive template edits, restarts and retries', () => {
  const p = player({ strength: 10000 });
  const target = profile('square_pigeon');
  const state = startCombat(p, target);
  const saved = db.select().from(combatSessions).where(eq(combatSessions.id, state.id)).get();
  db.update(mobs).set({ name: 'Редактирование', strength: 999, maxHealth: 999, pointsReward: 999, coinReward: 999, loot: [] }).where(eq(mobs.id, target.id)).run();
  initializeDatabase();
  const changed = profile('square_pigeon');
  const restored = db.select().from(combatSessions).where(eq(combatSessions.id, state.id)).get();
  const publicState = getCombatState(getPlayer(p.id), restored, changed);
  assert.equal(publicState.mob.name, target.name);
  assert.equal(publicState.mob.maxHealth, target.maxHealth);
  assert.deepEqual(restored.battleState, saved.battleState);
  const rng = mock.method(Math, 'random', () => 0);
  try {
    const command = { sessionId: state.id, round: 1, expectedVersion: 0, requestId: 'snapshot-win' };
    const won = moveCombatAction(getPlayer(p.id), changed, restored, 'attack', command);
    assert.equal(won.status, 'victory');
    assert.equal(getPlayer(p.id).money, target.coinReward);
    const paid = getPlayer(p.id);
    const duplicate = moveCombatAction(paid, changed, restored, 'attack', command);
    assert.deepEqual(duplicate.droppedItems, won.droppedItems);
    assert.equal(getPlayer(p.id).money, paid.money);
    assert.equal(getPlayer(p.id).xp, paid.xp);
  } finally { rng.mock.restore(); db.update(mobs).set(target).where(eq(mobs.id, target.id)).run(); }
});

test('mob AI respects cooldowns and cannot change its committed move when the player chooses', () => {
  const p = player();
  const state = startCombat(p, profile('square_fourteen'));
  const session = db.select().from(combatSessions).where(eq(combatSessions.id, state.id)).get();
  const battle = structuredClone(session.battleState);
  battle.cooldowns[1] = { mob_strong: 4, mob_guard: 4 };
  assert.equal(chooseMobMove(battle, 3, () => 0), 'mob_attack');
  assert.equal(chooseMobMove(battle, 4, () => .3), 'mob_strong');
  const committed = battle.choices[1];
  battle.choices[0] = 'unarmed_strike';
  assert.equal(battle.choices[1], committed);
});

test('manual mob selection, unavailable walks, zero HP and concurrent activities are rejected without rewards', () => {
  const p = player();
  assert.equal(request('/combat/start', p.id, { mobId: profile('square_fourteen').id }).status, 409);
  assert.equal(request('/combat/start', p.id, { mobId: 0 }).status, 409);
  assert.equal(request('/locations/:id/action', p.id, { actionId: 'fight' }).status, 400);
  assert.equal(request('/locations/:id/action', p.id, { actionId: 'walk' }, 'market').status, 409);
  db.update(players).set({ health: 0, lastRegenTime: nowGameTime() }).where(eq(players.id, p.id)).run();
  assert.equal(request('/locations/:id/action', p.id, { actionId: 'walk' }).status, 409);
  db.update(players).set({ health: 100, idTheLastAction: { id: 999, type: 'Trade' } }).where(eq(players.id, p.id)).run();
  assert.equal(request('/locations/:id/action', p.id, { actionId: 'walk' }).status, 409);
  assert.equal(getPlayer(p.id).xp, 0);
  assert.equal(db.select().from(combatSessions).where(eq(combatSessions.playerId, p.id)).get(), undefined);
});

test('a failed battle insert rolls back walk XP, quest progress and the encounter event', () => {
  const p = player();
  const quest = db.insert(quests).values({ title: 'Тест прогулки', description: 'Не засчитывать при ошибке', difficulty: 'easy',
    objectiveType: 'walk', targetId: 'square', targetCount: 1 }).returning().get();
  const assigned = db.insert(playerQuests).values({ playerId: p.id, questId: quest.id, assignedDay: todayGameDate() }).returning().get();
  sqlite.exec(`CREATE TRIGGER reject_walk_battle BEFORE INSERT ON combat_sessions WHEN NEW.player_id = ${p.id}
    BEGIN SELECT RAISE(ABORT, 'blocked battle'); END`);
  try {
    assert.equal(request('/locations/:id/action', p.id, { actionId: 'walk' }).status, 409);
    assert.equal(getPlayer(p.id).xp, 0);
    assert.equal(getPlayer(p.id).points, 0);
    assert.equal(getPlayer(p.id).idTheLastAction, null);
    assert.equal(db.select().from(playerQuests).where(eq(playerQuests.id, assigned.id)).get().progress, 0);
    assert.equal(db.select().from(events).where(eq(events.playerId, p.id)).all().length, 0);
  } finally { sqlite.exec('DROP TRIGGER reject_walk_battle'); }
});

test('the existing two-second walk cooldown survives a server restart and successful fleeing', () => {
  const p = player();
  const rng = mock.method(Math, 'random', () => 0);
  try {
    const walked = request('/locations/:id/action', p.id, { actionId: 'walk' });
    assert.equal(walked.status, 200);
    const session = db.select().from(combatSessions).where(eq(combatSessions.id, walked.body.combat.id)).get();
    assert.equal(moveCombatAction(getPlayer(p.id), profile('square_pigeon'), session, 'flee').status, 'fled');
    initializeDatabase();
    assert.equal(request('/locations/:id/action', p.id, { actionId: 'walk' }).status, 429);
    assert.equal(getPlayer(p.id).xp, 2);
    assert.equal(db.select().from(combatSessions).where(eq(combatSessions.playerId, p.id)).all().length, 1);
  } finally { rng.mock.restore(); }
});
