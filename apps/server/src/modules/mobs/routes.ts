import { and,asc,eq,inArray } from "drizzle-orm";
import { createMobCombatProfile,MOB_RANK_LABELS,recommendedMobStats,TUTORIAL_MOB_ID,type MobCombatProfile,type MobRank } from "@mmobot/shared";
import type { Express } from "express";
import { db } from "../../database/connection.js";
import { toMobDto } from "../../database/mappers.js";
import { items,locations,mobs,quests,type MobRow } from "../../database/schema.js";
import { parseLoot } from "../combat/loot.js";
import { mobProfile } from './balance.js';

function parseProfile(input: unknown): MobCombatProfile {
  const object = (value: unknown, label: string): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: укажите настройки`);
    return value as Record<string, unknown>;
  };
  const number = (value: unknown, label: string, min: number, max: number, integer = false): number => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value)))
      throw new Error(`${label}: требуется ${integer ? 'целое ' : ''}число от ${min} до ${max}`);
    return value;
  };
  const name = (value: unknown): string => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) throw new Error('Название приёма: от 1 до 100 символов');
    return value.trim();
  };
  const value = object(input, 'Боевой профиль');
  if (typeof value.rank !== 'string' || !Object.hasOwn(MOB_RANK_LABELS, value.rank)) throw new Error('Выберите класс сложности');
  if (typeof value.scaleToPlayer !== 'boolean') throw new Error('Укажите режим подстройки уровня');
  const attack = object(value.attack, 'Обычная атака');
  const profile: MobCombatProfile = { rank: value.rank as MobRank, scaleToPlayer: value.scaleToPlayer,
    encounterWeight: number(value.encounterWeight, 'Вес встречи', 0, 10000),
    attack: { name: name(attack.name), accuracy: number(attack.accuracy, 'Точность обычной атаки', 0, 100) },
    strongAttack: null, guard: null };
  if (value.strongAttack !== null) {
    const strong = object(value.strongAttack, 'Сильная атака');
    profile.strongAttack = { name: name(strong.name), accuracy: number(strong.accuracy, 'Точность сильной атаки', 0, 100),
      power: number(strong.power, 'Мощность сильной атаки', .1, 5), cooldownRounds: number(strong.cooldownRounds, 'Перезарядка сильной атаки', 0, 20, true) };
  }
  if (value.guard !== null) {
    const guard = object(value.guard, 'Защита');
    profile.guard = { name: name(guard.name), cooldownRounds: number(guard.cooldownRounds, 'Перезарядка защиты', 0, 20, true),
      fullBlockChance: number(guard.fullBlockChance, 'Шанс полного блока', 0, 100),
      partialBlockChance: number(guard.partialBlockChance, 'Шанс частичного блока', 0, 100),
      partialMultiplier: number(guard.partialMultiplier, 'Доля урона при частичном блоке', 0, 1),
      reflectChance: number(guard.reflectChance, 'Шанс отражения', 0, 100) };
    if (profile.guard.fullBlockChance + profile.guard.partialBlockChance > 100) throw new Error('Сумма шансов полного и частичного блока не должна превышать 100%');
  }
  return profile;
}

function parseMob(body: unknown, previous?: MobRow): typeof mobs.$inferInsert {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Ожидаются параметры монстра");
  const input = body as Record<string, unknown>;
  const combatProfile = parseProfile(Object.hasOwn(input, 'combatProfile') ? input.combatProfile : previous ? mobProfile(previous) : createMobCombatProfile());
  const requestedLevel = input.level ?? previous?.level ?? 1;
  const defaultLevel = typeof requestedLevel === 'number' && Number.isSafeInteger(requestedLevel) && requestedLevel >= 1 ? requestedLevel : 1;
  const value = { ...recommendedMobStats(combatProfile.rank, defaultLevel), locationId: 'square', respawnSeconds: 1, loot: [], ...previous, ...body } as Record<string, unknown>;
  for (const key of ["name", "description", "locationId"] as const) {
    if (typeof value[key] !== "string" || !(value[key] as string).trim()) throw new Error(`Поле ${key} обязательно`);
  }
  for (const [key, min] of Object.entries({ level: 1, maxHealth: 1, strength: 0, defense: 0, pointsReward: 0, coinReward: 0, respawnSeconds: 1 })) {
    if (!Number.isSafeInteger(value[key]) || (value[key] as number) < min) throw new Error(`${key}: требуется целое число не меньше ${min}`);
  }
  const locationId = value.locationId as string;
  if (!db.select({ id: locations.id }).from(locations).where(eq(locations.id, locationId)).get()) throw new Error("Локация не найдена");
  const loot = parseLoot(value.loot);
  const ids = [...new Set(loot.map((entry) => entry.itemType))];
  const existing = ids.length ? db.select({ id: items.id }).from(items).where(inArray(items.id, ids)).all() : [];
  const found = new Set(existing.map((item) => item.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) throw new Error(`Предметы лута не найдены: ${missing.join(", ")}`);
  return {
    combatProfile,
    name: (value.name as string).trim(), description: (value.description as string).trim(), locationId, loot,
    level: value.level as number, maxHealth: value.maxHealth as number, strength: value.strength as number,
    defense: value.defense as number, pointsReward: value.pointsReward as number,
    coinReward: value.coinReward as number, respawnSeconds: value.respawnSeconds as number,
  };
}

export const createMobRoutes = (app: Express) => {
  app.get("/mobs", (_req, res) => {
    res.json({ mobs: db.select().from(mobs).where(eq(mobs.isActive, true)).orderBy(asc(mobs.level)).all().filter((mob) => mob.id !== TUTORIAL_MOB_ID).map(toMobDto) });
  });
  app.get("/mobs/:id", (req, res) => {
    const mob = db.select().from(mobs).where(eq(mobs.id, Number(req.params.id))).get();
    if (!mob) return res.status(404).json({ error: "Монстр не найден" });
    res.json({ mob: toMobDto(mob) });
  });
  app.post("/mobs", (req, res) => {
    try {
      const mob = db.insert(mobs).values(parseMob(req.body)).returning().get();
      res.json({ mob: toMobDto(mob) });
    } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Не удалось создать монстра" }); }
  });
  app.put("/mobs/:id", (req, res) => {
    if (Number(req.params.id) === TUTORIAL_MOB_ID) return res.status(409).json({ error: "Учебный противник не редактируется" });
    const previous = db.select().from(mobs).where(and(eq(mobs.id, Number(req.params.id)), eq(mobs.isActive, true))).get();
    if (!previous) return res.status(404).json({ error: "Монстр не найден" });
    try {
      const mob = db.update(mobs).set(parseMob(req.body, previous)).where(eq(mobs.id, previous.id)).returning().get();
      res.json({ mob: toMobDto(mob) });
    } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Не удалось сохранить монстра" }); }
  });
  app.delete("/mobs/:id", (req, res) => {
    if (Number(req.params.id) === TUTORIAL_MOB_ID) return res.status(409).json({ error: "Учебный противник не удаляется" });
    const mob = db.select().from(mobs).where(eq(mobs.id, Number(req.params.id))).get();
    if (!mob) return res.status(404).json({ error: "Монстр не найден" });
    db.transaction(tx => {
      tx.update(mobs).set({ isActive: false }).where(eq(mobs.id, mob.id)).run();
      tx.update(quests).set({ isActive: false }).where(and(eq(quests.objectiveType, 'kill'), eq(quests.targetId, String(mob.id)))).run();
    });
    res.status(200).end();
  });
};
