import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { and, eq } from "drizzle-orm";

const directory = mkdtempSync(path.join(tmpdir(), "mmobot-weapons-"));
process.env.DATABASE_PATH = path.join(directory, "test.db");
process.env.BOT_TOKEN = "123456:test-token";
process.env.SESSION_SECRET = "weapon-tests";
process.env.ADMIN_IDS = "1";
mock.module("../dist/infrastructure/telegram/notifications.js", { namedExports: { notify: mock.fn() } });
mock.module("../dist/infrastructure/realtime/socket-server.js", { namedExports: {
  isPlayerOnline: () => false, emitToPlayer: mock.fn(), broadcastLocation: mock.fn(), moveSocketToLocation: mock.fn(),
} });

const migrationSource = fileURLToPath(new URL("../drizzle/", import.meta.url));
const oldMigrations = path.join(directory, "old-migrations");
mkdirSync(path.join(oldMigrations, "meta"), { recursive: true });
const journal = JSON.parse(readFileSync(path.join(migrationSource, "meta/_journal.json"), "utf8"));
journal.entries = journal.entries.filter((entry) => entry.idx < 26);
writeFileSync(path.join(oldMigrations, "meta/_journal.json"), JSON.stringify(journal));
for (const entry of journal.entries) copyFileSync(path.join(migrationSource, `${entry.tag}.sql`), path.join(oldMigrations, `${entry.tag}.sql`));
const legacy = new Database(process.env.DATABASE_PATH);
legacy.pragma("foreign_keys = ON");
migrate(drizzle(legacy), { migrationsFolder: oldMigrations });
legacy.exec(`
  INSERT INTO players (id, friend_id, name, money, created_at, last_seen_at, last_regen_time) VALUES
    (1, 1, 'Первый', 987, '2026-01-01', '2026-01-01', '2026-01-01'),
    (2, 2, 'Второй', 654, '2026-01-01', '2026-01-01', '2026-01-01');
  INSERT INTO items (id, name, description, type, damage, price) VALUES
    (40, 'Старое авторское оружие', 'Сохранить', 'weapon', 7, 60),
    (41, 'Старое зелье', 'Сохранить', 'potion', 0, 20),
    (42, 'Старая броня', 'Сохранить', 'armor', 0, 30);
  INSERT INTO inventory_items (id, player_id, item_type, quantity, acquired_at, equiped) VALUES
    (100, 1, 40, 3, '2026-01-01', 1), (101, 1, 41, 5, '2026-01-01', 0), (102, 1, 42, 2, '2026-01-01', 1);
  INSERT INTO trades (id, from_player_id, to_player_id, status, from_offer, from_ready, to_ready, created_at)
    VALUES (1, 1, 2, 'open', '[{"itemType":40,"quantity":2}]', 1, 1, '2026-01-01');
`);
legacy.close();

const { db, initializeDatabase } = await import("../dist/database/index.js");
const { inventoryItems, items, players, trades, mobs, combatSessions, pvpSessions } = await import("../dist/database/schema.js");
const { createShopRoutes } = await import("../dist/modules/shop/routes.js");
const { createItemRoutes } = await import("../dist/modules/items/routes.js");
const { InventoryRoutes } = await import("../dist/modules/inventory/routes.js");
const { createTradeRoutes } = await import("../dist/modules/trades/routes.js");
const { grantItems } = await import("../dist/modules/inventory/store.js");
const { getPlayerStats, startCombat, moveCombatAction, usePotion } = await import("../dist/modules/combat/pve.js");
const { MEME_ITEM_CATALOG } = await import("../dist/modules/items/catalogs/meme-items.js");
const { getPassiveIdsForType } = await import("@mmobot/shared");
const { nowGameTime } = await import("../dist/shared/time.js");
initializeDatabase();
after(() => { db.$client.close(); rmSync(directory, { recursive: true, force: true }); });

const routes = new Map();
const app = Object.fromEntries(["get", "post", "put", "delete"].map((method) => [method, (url, ...handlers) => routes.set(`${method} ${url}`, handlers)]));
for (const register of [createShopRoutes, createItemRoutes, InventoryRoutes, createTradeRoutes]) register(app);
const getPlayer = (id) => db.select().from(players).where(eq(players.id, id)).get();
const getInventory = (id) => db.select().from(inventoryItems).where(eq(inventoryItems.playerId, id)).all();
const catalog = (key) => db.select().from(items).where(eq(items.catalogKey, key)).get();
const rowById = (id) => db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).get();
function request(method, url, { playerId = 1, id, body = {} } = {}) {
  const req = { body, params: { id: String(id) }, player: getPlayer(playerId) };
  const result = { status: 200, body: undefined };
  const res = { status(value) { result.status = value; return this; }, json(value) { result.body = JSON.parse(JSON.stringify(value)); return this; }, end() { return this; } };
  const handlers = routes.get(`${method} ${url}`);
  assert.ok(handlers, `${method} ${url}`);
  let index = 0;
  const next = () => handlers[index++]?.(req, res, next);
  next();
  return result;
}
let nextPlayer = 200;
function player(overrides = {}) {
  const id = nextPlayer++;
  return db.insert(players).values({ id, friendId: id, name: `Игрок ${id}`, money: 2000, currentLocationId: "square", createdAt: nowGameTime(), lastSeenAt: nowGameTime(), ...overrides }).returning().get();
}
function give(playerId, itemType, quantity = 1) {
  db.transaction((tx) => grantItems(tx, playerId, itemType, quantity));
  return getInventory(playerId).filter((row) => row.itemType === itemType);
}
function trade(a, b) {
  return db.insert(trades).values({ fromPlayerId: a, toPlayerId: b, status: "open", createdAt: nowGameTime() }).returning().get();
}
const offer = (row, quantity = 1) => ({ itemType: row.itemType, quantity, ...(row.weaponLevel != null ? { inventoryItemId: row.id } : {}) });
const setOffer = (id, playerId, entries) => request("put", "/trades/:id/offer", { id, playerId, body: { items: entries } });
const ready = (id, playerId) => request("post", "/trades/:id/ready", { id, playerId });

test("migration splits legacy weapon stacks, preserving IDs, equipment, quantities and other inventory", () => {
  const weapons = getInventory(1).filter((row) => row.itemType === 40);
  assert.equal(weapons.length, 3);
  assert.ok(weapons.every((row) => row.quantity === 1 && row.weaponLevel === 1 && row.acquiredAt === "2026-01-01"));
  assert.deepEqual(weapons.filter((row) => row.equiped).map((row) => row.id), [100]);
  assert.equal(rowById(101).quantity, 5);
  assert.equal(rowById(101).weaponLevel, null);
  assert.equal(rowById(102).quantity, 2);
  assert.equal(rowById(102).equiped, true);
  assert.equal(getPlayer(1).money, 987);
  const oldTrade = db.select().from(trades).where(eq(trades.id, 1)).get();
  assert.deepEqual(oldTrade.fromOffer, []);
  assert.equal(oldTrade.fromReady, false);
  assert.equal(oldTrade.toReady, false);
  assert.deepEqual(db.$client.pragma("foreign_key_check"), []);
});

test("database rejects invalid instance levels/quantities and duplicate ordinary stacks", () => {
  for (const weaponLevel of [0, -1, 1.5]) assert.throws(() => db.update(inventoryItems).set({ weaponLevel }).where(eq(inventoryItems.id, 100)).run(), /CHECK/);
  assert.throws(() => db.update(inventoryItems).set({ quantity: 2 }).where(eq(inventoryItems.id, 100)).run(), /CHECK/);
  assert.throws(() => db.insert(inventoryItems).values({ playerId: 1, itemType: 41, quantity: 2, acquiredAt: nowGameTime() }).run(), /UNIQUE/);
});

test("catalog seeds the original weapons and twenty new items without overwriting admin edits on restart", () => {
  const phone = catalog("iphone_9");
  assert.equal(request("put", "/items/:id", { id: phone.id, body: { name: "Айфон 9 — изменён", price: 81, passiveParams: { healthThresholdPercent: 35, damageBonusPercent: 15 } } }).status, 200);
  assert.equal(request("put", "/items/:id", { id: catalog("foil_hat_pro_max").id, body: { name: "Шапочка — изменена", passiveParams: { chancePercent: 30 } } }).status, 200);
  assert.equal(request("put", "/items/:id", { id: catalog("yesterday_deadline_coffee").id, body: { price: 60, passiveParams: { speedBonusPercent: 20, durationRounds: 3, slowdownPercent: 10 } } }).status, 200);
  db.update(inventoryItems).set({ weaponLevel: 5 }).where(eq(inventoryItems.id, 100)).run();
  const before = getInventory(1);
  const beforeItems = db.select().from(items).all();
  initializeDatabase();
  assert.deepEqual(getInventory(1), before);
  assert.deepEqual(db.select().from(items).all(), beforeItems);
  assert.equal(db.select().from(items).all().filter((item) => item.catalogKey !== null).length, 28);
  assert.equal(catalog("iphone_9").name, "Айфон 9 — изменён");
  assert.equal(catalog("iphone_9").price, 81);
  assert.equal(catalog("iphone_9").passiveParams.healthThresholdPercent, 35);
  assert.equal(db.select().from(items).where(eq(items.id, 40)).get().description, "Сохранить");
});

test("new catalog has four items per rarity and all effect definitions round-trip through the admin API", () => {
  const additions = MEME_ITEM_CATALOG.map((item) => catalog(item.catalogKey));
  assert.equal(additions.length, 20);
  assert.equal(new Set(additions.map((item) => item.id)).size, 20);
  for (const rarity of ["common", "uncommon", "rare", "epic", "legendary"]) {
    assert.equal(additions.filter((item) => item.rarity === rarity).length, 4);
  }
  assert.equal(additions.filter((item) => item.type === "weapon").length, 13);
  assert.equal(additions.filter((item) => item.type === "armor").length, 4);
  assert.equal(additions.filter((item) => item.type === "potion").length, 3);
  for (const item of additions) {
    assert.ok(item.icon.startsWith('<svg '));
    assert.ok(getPassiveIdsForType(item.type).includes(item.passiveId));
    const result = request("put", "/items/:id", { id: item.id, body: { description: item.description } });
    assert.equal(result.status, 200, `${item.name}: ${JSON.stringify(result.body)}`);
    assert.deepEqual(result.body.item.passiveParams, item.passiveParams);
    assert.equal(result.body.item.passiveId, item.passiveId);
    if (item.type !== "weapon") assert.equal(result.body.item.damageType, null);
  }
});

test("armor and consumable effect validation rejects incompatible types and preserves edits", () => {
  const created = request("post", "/items", { body: { name: "Тестовая кастрюля", description: "Тест", type: "armor", passiveId: "saved_for_tomorrow" } });
  assert.equal(created.status, 200);
  assert.deepEqual(created.body.item.passiveParams, { damageReductionPercent: 15 });
  const armor = created.body.item;
  for (const body of [{ passiveId: "lifesteal" }, { passiveId: "caffeine_credit" }, { passiveParams: { damageReductionPercent: -1 } }, { passiveParams: { damageReductionPercent: 5, unexpected: 1 } }]) {
    assert.equal(request("put", "/items/:id", { id: armor.id, body }).status, 400);
  }
  assert.equal(request("get", "/items/:id", { id: armor.id }).body.item.passiveId, armor.passiveId);
  const cleared = request("put", "/items/:id", { id: armor.id, body: { passiveId: null } });
  assert.equal(cleared.status, 200);
  assert.deepEqual(cleared.body.item.passiveParams, {});
  const coffee = catalog("yesterday_deadline_coffee");
  assert.equal(request("put", "/items/:id", { id: coffee.id, body: { passiveId: "foil_reflection" } }).status, 400);
  assert.equal(request("put", "/items/:id", { id: coffee.id, body: { passiveParams: { speedBonusPercent: 25, durationRounds: 0, slowdownPercent: 15 } } }).status, 400);
  assert.equal(catalog("yesterday_deadline_coffee").passiveId, "caffeine_credit");
});

test("new shop weapons create level-one instances and armor and consumables stack", () => {
  const p = player({ money: 10000 });
  const shop = request("get", "/shop", { playerId: p.id }).body.items;
  for (const definition of MEME_ITEM_CATALOG) {
    const item = catalog(definition.catalogKey);
    if (definition.catalogKey === "yesterday_deadline_coffee") {
      assert.ok(!shop.some((entry) => entry.id === item.id));
      assert.equal(request("post", "/shop/buy", { playerId: p.id, body: { itemType: item.id, quantity: 1 } }).status, 404);
      continue;
    }
    assert.ok(shop.some((entry) => entry.id === item.id));
    const bought = request("post", "/shop/buy", { playerId: p.id, body: { itemType: item.id, quantity: 2 } });
    assert.equal(bought.status, 200);
    const owned = bought.body.inventory.filter((row) => row.itemType === item.id);
    if (item.type === "weapon") {
      assert.equal(owned.length, 2);
      assert.ok(owned.every((row) => row.weaponLevel === 1 && row.quantity === 1));
    } else {
      assert.equal(owned.length, 1);
      assert.equal(owned[0].weaponLevel, null);
      assert.equal(owned[0].quantity, 2);
    }
  }
  const robe = catalog("entrance_chief_robe");
  const owned = getInventory(p.id).find((row) => row.itemType === robe.id);
  assert.equal(request("post", "/inventory/equip", { playerId: p.id, body: { inventoryItemId: owned.id } }).status, 200);
  assert.equal(getPlayerStats(getPlayer(p.id)).defense, p.defense + robe.defense);
});

test("food restores current flat HP and unfinished coffee cannot be consumed in inventory or combat", () => {
  const p = player({ health: 20 });
  const soup = catalog("mothers_soup"), dumpling = catalog("primordial_dumpling"), coffee = catalog("yesterday_deadline_coffee");
  for (const item of [soup, dumpling, coffee]) give(p.id, item.id, 2);
  const before = getInventory(p.id);
  assert.equal(request("post", "/inventory/use", { playerId: p.id, body: { itemType: coffee.id } }).status, 400);
  assert.deepEqual(getInventory(p.id), before);
  assert.equal(getPlayer(p.id).health, 20);
  for (const [item, hp] of [[soup, 40], [dumpling, 100]]) {
    assert.equal(request("post", "/inventory/use", { playerId: p.id, body: { itemType: item.id } }).status, 200);
    assert.equal(getPlayer(p.id).health, hp);
    assert.equal(getInventory(p.id).find((row) => row.itemType === item.id).quantity, 1);
  }
  const mob = db.select().from(mobs).where(eq(mobs.id, 0)).get();
  startCombat(getPlayer(p.id), mob);
  const session = db.select().from(combatSessions).where(eq(combatSessions.playerId, p.id)).get();
  assert.throws(() => usePotion(getPlayer(p.id), coffee.id, session, mob), /недоступны/);
  assert.equal(getInventory(p.id).find((row) => row.itemType === coffee.id).quantity, 2);
  db.delete(combatSessions).where(eq(combatSessions.id, session.id)).run();
});

test("shop purchases produce individual level-one weapons, ignore forged levels and still stack potions", () => {
  const p = player(), item = catalog("mop");
  const result = request("post", "/shop/buy", { playerId: p.id, body: { itemType: item.id, quantity: 3, weaponLevel: 99 } });
  assert.equal(result.status, 200);
  assert.equal(result.body.inventory.length, 3);
  assert.equal(new Set(result.body.inventory.map((row) => row.id)).size, 3);
  assert.ok(result.body.inventory.every((row) => row.quantity === 1 && row.weaponLevel === 1));
  assert.equal(getPlayer(p.id).money, 2000 - item.price * 3);
  for (const quantity of [2, 3]) assert.equal(request("post", "/shop/buy", { playerId: p.id, body: { itemType: 3, quantity } }).status, 200);
  assert.equal(getInventory(p.id).find((row) => row.itemType === 3).quantity, 5);
  assert.equal(getInventory(p.id).find((row) => row.itemType === 3).weaponLevel, null);
});

test("shop accepts catalog IDs above 99 while limiting purchase quantities and rolling back insufficient funds", () => {
  const p = player({ money: 100 });
  const item = db.insert(items).values({ id: 500, name: "Авторская швабра", description: "Тест", type: "weapon", damage: 1, price: 30, shopAvailable: true }).returning().get();
  assert.equal(request("post", "/shop/buy", { playerId: p.id, body: { itemType: item.id, quantity: 1 } }).status, 200);
  for (const quantity of [100, 3, -1, 1.5]) assert.equal(request("post", "/shop/buy", { playerId: p.id, body: { itemType: item.id, quantity } }).status, 400);
  assert.equal(getPlayer(p.id).money, 70);
  assert.equal(getInventory(p.id).length, 1);
});

test("equipping selects the exact instance without scaling damage by its prepared level", () => {
  const p = player(), item = catalog("soul_vacuum");
  const [first, second] = give(p.id, item.id, 2);
  db.update(inventoryItems).set({ weaponLevel: 6 }).where(eq(inventoryItems.id, second.id)).run();
  for (const row of [first, second]) assert.equal(request("post", "/inventory/equip", { playerId: p.id, body: { inventoryItemId: row.id } }).status, 200);
  assert.equal(rowById(first.id).equiped, false);
  assert.equal(rowById(second.id).equiped, true);
  assert.equal(getPlayerStats(getPlayer(p.id)).strength, p.strength + item.damage);
  assert.equal(request("post", "/inventory/equip", { playerId: p.id, body: { itemType: item.id } }).status, 400);
  const other = player();
  for (const url of ["/inventory/equip", "/inventory/unequip", "/shop/sell"]) assert.equal(request("post", url, { playerId: other.id, body: { inventoryItemId: second.id, itemType: item.id, quantity: 1 } }).status, 400);
  assert.equal(request("post", "/inventory/unequip", { playerId: p.id, body: { inventoryItemId: second.id } }).status, 200);
});

test("selling removes only the selected instance and preserves other levels", () => {
  const p = player(), item = catalog("fate_stapler");
  const [first, second] = give(p.id, item.id, 2);
  db.update(inventoryItems).set({ weaponLevel: 7 }).where(eq(inventoryItems.id, second.id)).run();
  const sale = (body) => request("post", "/shop/sell", { playerId: p.id, body: { itemType: item.id, quantity: 1, ...body } });
  assert.equal(sale({}).status, 400);
  assert.equal(sale({ inventoryItemId: second.id, quantity: 2 }).status, 400);
  assert.equal(sale({ inventoryItemId: second.id, itemType: 3 }).status, 400);
  assert.equal(sale({ inventoryItemId: first.id }).status, 200);
  assert.equal(rowById(first.id), undefined);
  assert.equal(rowById(second.id).weaponLevel, 7);
  assert.equal(getPlayer(p.id).money, p.money + Math.floor(item.price / 2));
  request("post", "/inventory/equip", { playerId: p.id, body: { inventoryItemId: second.id } });
  assert.equal(sale({ inventoryItemId: second.id }).status, 400);
});

test("trade transfers exact weapon IDs and server-owned levels and correctly swaps the same stack type", () => {
  const a = player(), b = player(), weapon = catalog("last_boil_kettle");
  const [a1, a2] = give(a.id, weapon.id, 2), [b1] = give(b.id, weapon.id);
  db.update(inventoryItems).set({ weaponLevel: 4 }).where(eq(inventoryItems.id, a2.id)).run();
  const [ap] = give(a.id, 3, 5), [bp] = give(b.id, 3, 3);
  const t = trade(a.id, b.id);
  assert.equal(setOffer(t.id, a.id, [offer(a1), { ...offer(a2), weaponLevel: 99 }, offer(ap, 2)]).status, 200);
  assert.equal(setOffer(t.id, b.id, [offer(b1), offer(bp)]).status, 200);
  assert.equal(db.select().from(trades).where(eq(trades.id, t.id)).get().fromOffer[1].weaponLevel, 4);
  assert.equal(ready(t.id, a.id).status, 200);
  assert.equal(ready(t.id, b.id).body.status, "accepted");
  assert.equal(rowById(a1.id).playerId, b.id);
  assert.equal(rowById(a2.id).playerId, b.id);
  assert.equal(rowById(a2.id).weaponLevel, 4);
  assert.equal(rowById(b1.id).playerId, a.id);
  assert.equal(getInventory(a.id).find((row) => row.itemType === 3).quantity, 4);
  assert.equal(getInventory(b.id).find((row) => row.itemType === 3).quantity, 4);
  assert.equal(ready(t.id, b.id).status, 409);
});

test("trade rejects duplicate/foreign/equipped instances, bulk weapons and missing instance IDs", () => {
  const a = player(), b = player();
  const [owned] = give(a.id, catalog("mop").id), [foreign] = give(b.id, owned.itemType);
  const t = trade(a.id, b.id);
  for (const invalid of [[offer(owned), offer(owned)], [offer(foreign)], [offer(owned, 2)], [{ itemType: owned.itemType, quantity: 1 }], [offer(owned, 0)]]) {
    assert.equal(setOffer(t.id, a.id, invalid).status, 400);
  }
  request("post", "/inventory/equip", { playerId: a.id, body: { inventoryItemId: owned.id } });
  assert.equal(setOffer(t.id, a.id, [offer(owned)]).status, 400);
});

test("failed trade is atomic when a selected instance disappears or changes level", () => {
  const a = player(), b = player();
  const [a1] = give(a.id, catalog("mop").id), [b1] = give(b.id, a1.itemType);
  const t = trade(a.id, b.id);
  setOffer(t.id, a.id, [offer(a1)]); setOffer(t.id, b.id, [offer(b1)]);
  ready(t.id, a.id);
  db.update(inventoryItems).set({ weaponLevel: 2 }).where(eq(inventoryItems.id, b1.id)).run();
  assert.equal(ready(t.id, b.id).status, 400);
  assert.equal(rowById(a1.id).playerId, a.id);
  assert.equal(rowById(b1.id).playerId, b.id);
  setOffer(t.id, b.id, [offer(b1)]); ready(t.id, a.id);
  db.delete(inventoryItems).where(eq(inventoryItems.id, b1.id)).run();
  assert.equal(ready(t.id, b.id).status, 400);
  assert.equal(rowById(a1.id).playerId, a.id);
  const state = db.select().from(trades).where(eq(trades.id, t.id)).get();
  assert.equal(state.fromReady, false); assert.equal(state.toReady, false);
});

test("weapon changes, selling and trading are blocked during active PvE and PvP", () => {
  const a = player(), b = player(), [weapon] = give(a.id, catalog("mop").id);
  const t = trade(a.id, b.id);
  const check = () => {
    for (const url of ["/inventory/equip", "/inventory/unequip", "/shop/sell"]) assert.equal(request("post", url, { playerId: a.id, body: { inventoryItemId: weapon.id, itemType: weapon.itemType, quantity: 1 } }).status, 400);
    assert.equal(setOffer(t.id, a.id, [offer(weapon)]).status, 400);
  };
  const pve = db.insert(combatSessions).values({ playerId: a.id, mobId: 0, playerHealth: 100, mobHealth: 10, startedAt: nowGameTime(), lastActionAt: nowGameTime() }).returning().get();
  check(); db.delete(combatSessions).where(eq(combatSessions.id, pve.id)).run();
  const pvp = db.insert(pvpSessions).values({ player1Id: a.id, player2Id: b.id, player1Health: 100, player2Health: 100, status: "active", turn: "player1", creadetAt: nowGameTime(), lastActionAt: nowGameTime() }).returning().get();
  check(); db.delete(pvpSessions).where(eq(pvpSessions.id, pvp.id)).run();
});

test("admin validates weapon metadata, clears passive parameters and protects catalog references", () => {
  const item = catalog("soul_vacuum");
  for (const body of [{ rarity: "mythic" }, { weaponFamily: "swords" }, { damageCategory: "physical", damageType: "heat" }, { passiveId: "fake" }, { passiveParams: { chancePercent: 101, healingPercent: 20 } }, { passiveParams: { chancePercent: 20 } }, { damage: -2 }, { damage: 2.5 }]) {
    assert.equal(request("put", "/items/:id", { id: item.id, body }).status, 400);
  }
  assert.equal(request("put", "/items/:id", { id: item.id, body: { type: "potion" } }).status, 400);
  assert.equal(request("delete", "/items/:id", { id: item.id }).status, 409);
  assert.equal(request("delete", "/items/:id", { id: 40 }).status, 409);
  const result = request("post", "/items", { body: { name: "Новый предмет", description: "Тест", type: "weapon", price: 1, passiveId: "lifesteal" } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.item.passiveParams, { chancePercent: 25, healingPercent: 20 });
  const cleared = request("put", "/items/:id", { id: result.body.item.id, body: { passiveId: null } });
  assert.equal(cleared.status, 200);
  assert.deepEqual(cleared.body.item.passiveParams, {});
});

test("repeated combat loot creates separate weapons and keeps potion loot stacked", () => {
  const p = player({ strength: 1000 }), weapon = catalog("mop");
  const mob = db.insert(mobs).values({ name: "Тестовый моб", description: "Лут", level: 1, maxHealth: 1, strength: 1, defense: 0, loot: [{ itemType: weapon.id, chancePercent: 100 }, { itemType: 3, chancePercent: 100 }], pointsReward: 1, locationId: "square", respawnSeconds: 1 }).returning().get();
  for (let i = 0; i < 2; i++) {
    const current = getPlayer(p.id);
    const started = startCombat(current, mob);
    const session = db.select().from(combatSessions).where(eq(combatSessions.id, started.id)).get();
    assert.equal(moveCombatAction(current, mob, session, "attack").status, "victory");
  }
  const inventory = getInventory(p.id);
  assert.equal(inventory.filter((row) => row.itemType === weapon.id).length, 2);
  assert.equal(inventory.find((row) => row.itemType === 3).quantity, 2);
});
