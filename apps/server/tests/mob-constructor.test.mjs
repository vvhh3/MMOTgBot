import assert from 'node:assert/strict';
import { after,mock,test } from 'node:test';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { calculateMobStats,createMobCombatProfile,createMobMoves,recommendedMobStats } from '@mmobot/shared';

const directory = mkdtempSync(path.join(tmpdir(), 'mmobot-mob-constructor-'));
process.env.DATABASE_PATH = path.join(directory, 'test.db');
process.env.BOT_TOKEN = '123456:test-token';
process.env.SESSION_SECRET = 'mob-constructor-tests';
mock.module('../dist/infrastructure/telegram/notifications.js', { namedExports: { notify: mock.fn() } });
mock.module('../dist/infrastructure/realtime/socket-server.js', { namedExports: {
  emitToPlayer: mock.fn(), broadcastLocation: mock.fn(), moveSocketToLocation: mock.fn(), isPlayerOnline: () => false,
} });
const { db,sqlite } = await import('../dist/database/connection.js');
const { initializeDatabase } = await import('../dist/database/initialize.js');
const { mobs,items,players,combatSessions,quests,playerQuests } = await import('../dist/database/schema.js');
const { createMobRoutes } = await import('../dist/modules/mobs/routes.js');
const { createQuestRoutes } = await import('../dist/modules/quests/routes.js');
const { chooseEncounter,scaleMob,mobMoves } = await import('../dist/modules/mobs/balance.js');
const { startCombat,getCombatState,moveCombatAction } = await import('../dist/modules/combat/pve.js');
const { nowGameTime,todayGameDate } = await import('../dist/shared/time.js');
initializeDatabase();
after(() => { sqlite.close(); rmSync(directory, { recursive: true, force: true }); });
const routes = new Map();
const app = Object.fromEntries(['get','post','put','delete'].map(method => [method, (route,...handlers) => routes.set(`${method} ${route}`, handlers)]));
createMobRoutes(app);
createQuestRoutes(app);
let nextName = 1, nextPlayer = 10;
const stored = id => db.select().from(mobs).where(eq(mobs.id, id)).get();
function player() {
  const id = nextPlayer++;
  return db.insert(players).values({ id, friendId: id, name: `Игрок ${id}`, level: 6, xp: 1600,
    currentLocationId: 'square', createdAt: nowGameTime(), lastSeenAt: nowGameTime() }).returning().get();
}
function request(method,route,body = {},id = '',p = undefined) {
  const req = { body, params: { id: String(id) }, player: p };
  const result = { status: 200 };
  const res = { status(code) { result.status = code; return this; }, json(value) { result.body = value; return this; }, end() { return this; } };
  let index = 0;
  const next = () => routes.get(`${method} ${route}`)[index++]?.(req, res, next);
  next();
  return result;
}
function create(overrides = {}) {
  const result = request('post', '/mobs', { name: `Авторский моб ${nextName++}`, description: 'Создан в конструкторе', ...overrides });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body.mob;
}

test('new mobs get usable balanced defaults; an explicit class determines defaults at its base level', () => {
  const normal = create();
  assert.equal(normal.catalogKey, null);
  assert.deepEqual(normal.combatProfile, createMobCombatProfile());
  for (const [key,value] of Object.entries(recommendedMobStats('normal'))) assert.equal(normal[key], value);
  const boss = create({ level: 5, combatProfile: createMobCombatProfile('boss') });
  for (const [key,value] of Object.entries(recommendedMobStats('boss', 5))) assert.equal(boss[key], value);
  assert.equal(boss.rank, 'boss');
});

test('custom attacks, protection and fractional loot chances round-trip through create, read and partial edit', () => {
  const profile = createMobCombatProfile('boss');
  profile.encounterWeight = .25;
  profile.attack = { name: 'Удар дверью', accuracy: 93.5 };
  profile.strongAttack = { name: 'Последний рейс', accuracy: 72.25, power: 1.75, cooldownRounds: 3 };
  profile.guard = { name: 'Закрыто на обед', cooldownRounds: 2, fullBlockChance: 25, partialBlockChance: 55, partialMultiplier: .4, reflectChance: 15 };
  const loot = [{ itemType: 3, chancePercent: .125 }, { itemType: 3, chancePercent: 25 }, { itemType: 1, chancePercent: 100 }];
  const created = create({ combatProfile: profile, loot });
  assert.deepEqual(created.combatProfile, profile);
  assert.deepEqual(stored(created.id).loot, loot);
  assert.deepEqual(request('get', '/mobs/:id', {}, created.id).body.mob.combatProfile, profile);
  assert.equal(request('put', '/mobs/:id', { name: 'Новое имя', catalogKey: 'square_pigeon' }, created.id).status, 200);
  assert.equal(stored(created.id).catalogKey, null);
  assert.deepEqual(stored(created.id).combatProfile, profile);
  assert.deepEqual(mobMoves(stored(created.id)), createMobMoves(profile));
});

test('all eight preview levels equal encounter stats and high-rarity loot is gated for custom mobs', () => {
  const profile = createMobCombatProfile('elite');
  const legendary = db.select().from(items).where(eq(items.catalogKey, 'soul_vacuum')).get();
  const created = create({ combatProfile: profile, loot: [{ itemType: legendary.id, chancePercent: .2 }] });
  const row = stored(created.id), catalog = db.select().from(items).all();
  for (let level = 1; level <= 8; level++) {
    const preview = calculateMobStats(created, level, profile);
    const encounter = scaleMob(row, level, catalog);
    for (const [key,value] of Object.entries(preview)) assert.equal(encounter.mob[key], value);
    assert.equal(encounter.rank, 'elite');
    assert.equal(encounter.mob.loot.length, level >= 7 ? 1 : 0);
  }
  assert.equal(stored(created.id).level, 1);
});

test('fixed-level mobs keep their chosen level, stats and available loot at every player level', () => {
  const profile = { ...createMobCombatProfile('strong'), scaleToPlayer: false };
  const created = create({ level: 4, maxHealth: 90, strength: 12, defense: 6, combatProfile: profile });
  for (let level = 1; level <= 8; level++) {
    const encounter = scaleMob(stored(created.id), level, []);
    assert.equal(encounter.mob.level, 4);
    assert.equal(encounter.mob.maxHealth, 90);
    assert.equal(encounter.mob.strength, 12);
    assert.equal(encounter.mob.defense, 6);
  }
});

test('recommended balance stays consistent when its reference level is changed from 1 through 8', () => {
  for (const rank of ['normal', 'strong', 'elite', 'boss']) {
    const profile = createMobCombatProfile(rank);
    for (let baseLevel = 1; baseLevel <= 8; baseLevel++) {
      const base = recommendedMobStats(rank, baseLevel);
      assert.deepEqual(calculateMobStats(base, baseLevel, profile), base);
      for (let target = 1; target <= 8; target++) {
        const actual = calculateMobStats(base, target, profile);
        const expected = recommendedMobStats(rank, target);
        assert.equal(actual.strength, expected.strength);
        assert.equal(actual.defense, expected.defense);
        for (const key of ['maxHealth', 'pointsReward', 'coinReward']) assert.ok(Math.abs(actual[key] - expected[key]) <= 1, `${rank}: ${baseLevel} -> ${target}, ${key}`);
      }
    }
  }
});

test('encounters use custom weights, including fractions; zero excludes a template', () => {
  const first = create({ combatProfile: { ...createMobCombatProfile(), encounterWeight: .5 } });
  const second = create({ combatProfile: { ...createMobCombatProfile('boss'), encounterWeight: 1.5 } });
  const disabled = create({ combatProfile: { ...createMobCombatProfile(), encounterWeight: 0 } });
  const pool = [first, second, disabled].map(mob => stored(mob.id));
  assert.equal(chooseEncounter(pool, () => .24999).id, first.id);
  assert.equal(chooseEncounter(pool, () => .25).id, second.id);
  assert.equal(chooseEncounter(pool, () => .99999).id, second.id);
  assert.equal(chooseEncounter([stored(disabled.id)]), undefined);
});

test('invalid profiles are rejected without changing the existing record or creating partial mobs', () => {
  const created = create();
  const original = stored(created.id);
  const invalid = [null, [], {}, { ...createMobCombatProfile(), rank: 'mythic' },
    { ...createMobCombatProfile(), scaleToPlayer: 'true' },
    ...[-1, 10001, NaN, Infinity, '1'].map(encounterWeight => ({ ...createMobCombatProfile(), encounterWeight })),
    ...[-1, 101, '95'].map(accuracy => ({ ...createMobCombatProfile(), attack: { name: 'Атака', accuracy } })),
    { ...createMobCombatProfile(), attack: { name: ' ', accuracy: 95 } },
    { ...createMobCombatProfile(), strongAttack: { name: 'Сильный', power: 0, accuracy: 80, cooldownRounds: 2 } },
    { ...createMobCombatProfile(), strongAttack: { name: 'Сильный', power: 1.5, accuracy: 80, cooldownRounds: 1.5 } },
    { ...createMobCombatProfile('boss'), guard: { ...createMobCombatProfile('boss').guard, fullBlockChance: 80, partialBlockChance: 30 } },
    { ...createMobCombatProfile('boss'), guard: { ...createMobCombatProfile('boss').guard, partialMultiplier: 2 } },
    { ...createMobCombatProfile('boss'), guard: { ...createMobCombatProfile('boss').guard, reflectChance: -1 } },
  ];
  const count = db.select().from(mobs).all().length;
  for (const combatProfile of invalid) {
    assert.equal(request('put', '/mobs/:id', { combatProfile }, created.id).status, 400);
    assert.deepEqual(stored(created.id), original);
    assert.equal(request('post', '/mobs', { name: 'Некорректный', description: 'Не сохранять', combatProfile }).status, 400);
  }
  assert.equal(db.select().from(mobs).all().length, count);
});

test('constructor changes survive restart without overwriting existing profiles or inventory', () => {
  const stock = db.select().from(mobs).where(eq(mobs.catalogKey, 'square_pigeon')).get();
  const profile = { ...stock.combatProfile, encounterWeight: .75, strongAttack: null, guard: null,
    attack: { name: 'Изменённый клюв', accuracy: 88.25 } };
  assert.equal(request('put', '/mobs/:id', { combatProfile: profile, loot: [] }, stock.id).status, 200);
  const created = create({ combatProfile: createMobCombatProfile('boss') });
  const inventoryBefore = sqlite.prepare('SELECT * FROM inventory_items').all();
  initializeDatabase();
  assert.deepEqual(stored(stock.id).combatProfile, profile);
  assert.deepEqual(stored(stock.id).loot, []);
  assert.deepEqual(stored(created.id).combatProfile, created.combatProfile);
  assert.deepEqual(sqlite.prepare('SELECT * FROM inventory_items').all(), inventoryBefore);
  assert.deepEqual(sqlite.pragma('foreign_key_check'), []);
  assert.equal(sqlite.pragma('table_info(mobs)').filter(column => column.name === 'combat_profile').length, 1);
});

test('editing a profile does not rewrite already committed moves, stats or rewards of an active battle', () => {
  const profile = createMobCombatProfile('boss');
  profile.strongAttack.name = 'Старый сильный удар';
  const created = create({ maxHealth: 1000, strength: 0, defense: 0, combatProfile: profile });
  const p = player();
  const state = startCombat(p, stored(created.id));
  const before = db.select().from(combatSessions).where(eq(combatSessions.id, state.id)).get();
  const edited = { ...profile, rank: 'normal', scaleToPlayer: false, strongAttack: null, guard: null,
    attack: { name: 'Новый удар', accuracy: 50 } };
  assert.equal(request('put', '/mobs/:id', { strength: 999, coinReward: 999, maxHealth: 1, combatProfile: edited }, created.id).status, 200);
  const after = db.select().from(combatSessions).where(eq(combatSessions.id, state.id)).get();
  assert.deepEqual(after, before);
  const publicState = getCombatState(p, after, stored(created.id));
  assert.equal(publicState.mobMaxHp, before.battleState.fighters[1].maxHp);
  assert.equal(publicState.mob.rank, 'boss');
  assert.equal(publicState.mob.combatProfile, undefined);
  const rng = mock.method(Math, 'random', () => .9);
  try {
    const continued = moveCombatAction(p, stored(created.id), after, 'attack');
    assert.equal(continued.status, 'active');
    const saved = db.select().from(combatSessions).where(eq(combatSessions.id, state.id)).get();
    assert.deepEqual(saved.battleState.fighters[1], before.battleState.fighters[1]);
    assert.deepEqual(saved.battleState.encounter, before.battleState.encounter);
  } finally { rng.mock.restore(); }
});

test('daily quests stop targeting a mob with zero encounter weight and replace only pending assignments', () => {
  const created = create({ combatProfile: { ...createMobCombatProfile(), encounterWeight: 0 } });
  const p = player();
  const quest = db.insert(quests).values({ title: 'Недоступная цель', description: 'Не выдавать', difficulty: 'easy',
    objectiveType: 'kill', targetId: String(created.id), targetCount: 1 }).returning().get();
  const pending = db.insert(playerQuests).values({ playerId: p.id, questId: quest.id, assignedDay: todayGameDate(), progress: 0 }).returning().get();
  const result = request('get', '/quests/daily', {}, '', p);
  assert.equal(result.status, 200);
  assert.equal(result.body.quests.length, 1);
  assert.notEqual(db.select().from(playerQuests).where(eq(playerQuests.id, pending.id)).get().questId, quest.id);
  assert.ok(!result.body.quests.some(row => row.quest.id === quest.id));
});
