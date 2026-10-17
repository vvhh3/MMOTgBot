import type { Express, Request, Response } from "express";
import { asc, eq } from "drizzle-orm";
import {
  DAMAGE_CATEGORIES, DAMAGE_TYPES, DAMAGE_TYPES_BY_CATEGORY, ITEM_RARITIES,
  WEAPON_FAMILIES, getPassiveIdsForType, getDefaultPassiveParams, getPassiveDefinition,
} from "@mmobot/shared";
import { db, toItemDto } from "./db.js";
import { inventoryItems, items, mobs, quests } from "./db/schema.js";
import type { ItemRow } from "./db/schema.js";

function member<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new Error(`Некорректное поле: ${label}`);
  return value as T;
}
function parseItem(body: unknown, previous?: ItemRow): typeof items.$inferInsert {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Ожидается описание предмета");
  const input = body as Record<string, unknown>;
  const value: Record<string, unknown> = { damage: 0, defense: 0, healAmount: 0, price: 0, icon: "", shopAvailable: false, rarity: "common", ...previous, ...input };
  for (const key of ["name", "description"] as const) {
    if (typeof value[key] !== "string" || !(value[key] as string).trim()) throw new Error("Название и описание обязательны");
  }
  for (const key of ["damage", "defense", "healAmount", "price"] as const) {
    if (!Number.isSafeInteger(value[key]) || (value[key] as number) < 0) throw new Error(`${key}: требуется целое неотрицательное число`);
  }
  if (typeof value.shopAvailable !== "boolean" || typeof value.icon !== "string") throw new Error("Некорректные настройки магазина или иконки");
  const type = member(value.type, ["weapon", "armor", "potion", "material", "other"] as const, "Тип");
  const result: typeof items.$inferInsert = {
    name: (value.name as string).trim(), description: (value.description as string).trim(), type,
    damage: value.damage as number, defense: value.defense as number, healAmount: value.healAmount as number,
    price: value.price as number, shopAvailable: value.shopAvailable, icon: value.icon,
    rarity: member(value.rarity, ITEM_RARITIES, "Редкость"),
    weaponFamily: null, damageCategory: null, damageType: null, passiveId: null, passiveParams: {},
  };
  if (type === "weapon") {
    result.weaponFamily = member(value.weaponFamily ?? "legacy", WEAPON_FAMILIES, "Семейство оружия");
    result.damageCategory = member(value.damageCategory ?? "physical", DAMAGE_CATEGORIES, "Категория урона");
    result.damageType = member(value.damageType ?? (result.damageCategory === "physical" ? "blunt" : "electric"), DAMAGE_TYPES, "Тип урона");
    if (!DAMAGE_TYPES_BY_CATEGORY[result.damageCategory].includes(result.damageType)) throw new Error("Тип урона не соответствует категории");
  }
  if (value.passiveId != null) {
    const id = member(value.passiveId, getPassiveIdsForType(type), "Эффект для выбранного типа предмета");
    const params = input.passiveParams ?? (previous?.passiveId === id ? previous.passiveParams : getDefaultPassiveParams(id));
    if (!params || typeof params !== "object" || Array.isArray(params)) throw new Error("Некорректные параметры пассивки");
    const definition = getPassiveDefinition(id);
    if (Object.keys(params).some((key) => !(key in definition.parameters))) throw new Error("Неизвестный параметр пассивки");
    const parsed: Record<string, number> = {};
    for (const [key, rule] of Object.entries(definition.parameters)) {
      const number = (params as Record<string, unknown>)[key];
      if (typeof number !== "number" || !Number.isSafeInteger(number) || number < rule.min || number > rule.max) {
        throw new Error(`${rule.label}: целое число от ${rule.min} до ${rule.max}`);
      }
      parsed[key] = number;
    }
    result.passiveId = id;
    result.passiveParams = parsed;
  }
  return result;
}

export const createItemRoutes = (app: Express) => {
  app.get("/items", (_req, res) => res.json({ items: db.select().from(items).orderBy(asc(items.id)).all().map(toItemDto) }));
  app.get("/items/:id", (req, res) => {
    const item = db.select().from(items).where(eq(items.id, Number(req.params.id))).get();
    if (!item) return res.status(404).json({ error: "Предмет не найден" });
    res.json({ item: toItemDto(item) });
  });
  app.post("/items", (req: Request, res: Response) => {
    try {
      const item = db.insert(items).values(parseItem(req.body)).returning().get();
      res.json({ item: toItemDto(item) });
    } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Не удалось создать предмет" }); }
  });
  app.put("/items/:id", (req, res) => {
    const previous = db.select().from(items).where(eq(items.id, Number(req.params.id))).get();
    if (!previous) return res.status(404).json({ error: "Предмет не найден" });
    try {
      const values = parseItem(req.body, previous);
      if (values.type !== previous.type && (previous.type === "weapon" || values.type === "weapon")) {
        return res.status(400).json({ error: "Для смены оружия на другой тип создайте новый предмет: экземпляры и стопки устроены по-разному" });
      }
      const item = db.update(items).set(values).where(eq(items.id, previous.id)).returning().get();
      res.json({ item: toItemDto(item) });
    } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Не удалось сохранить предмет" }); }
  });
  app.delete("/items/:id", (req, res) => {
    const item = db.select().from(items).where(eq(items.id, Number(req.params.id))).get();
    if (!item) return res.status(404).json({ error: "Предмет не найден" });
    const owned = db.select({ id: inventoryItems.id }).from(inventoryItems).where(eq(inventoryItems.itemType, item.id)).get();
    const inLoot = db.select({ loot: mobs.loot }).from(mobs).all().some((mob) => mob.loot.some((entry) => entry.itemType === item.id));
    const inQuest = db.select().from(quests).all().some((q) => ["collect", "loot"].includes(q.objectiveType) && q.targetId === String(item.id));
    if (owned || inLoot || inQuest || item.catalogKey) return res.status(409).json({ error: "Предмет используется в игре. Его можно отредактировать или убрать из магазина" });
    db.delete(items).where(eq(items.id, item.id)).run();
    res.status(200).end();
  });
};
