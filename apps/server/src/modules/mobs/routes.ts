import { and,asc,eq,inArray } from "drizzle-orm";
import { TUTORIAL_MOB_ID } from "@mmobot/shared";
import type { Express } from "express";
import { db } from "../../database/connection.js";
import { toMobDto } from "../../database/mappers.js";
import { items,locations,mobs,quests,type MobRow } from "../../database/schema.js";
import { parseLoot } from "../combat/loot.js";

function parseMob(body: unknown, previous?: MobRow): typeof mobs.$inferInsert {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Ожидаются параметры монстра");
  const value = { ...previous, ...body } as Record<string, unknown>;
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
