import type { CharacterCreateRequest,CharacterCreateResponse,CharacterSkinsResponse,MeResponse,SpendStatPointRequest } from "@mmobot/shared";
import { isFactionId } from "@mmobot/shared";
import { and,asc,desc,eq } from "drizzle-orm";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../../config/env.js";
import { db } from "../../database/connection.js";
import { toInventoryItemDto,toPlayerDto,toPlayerDtoEquipped } from "../../database/mappers.js";
import { characterSkins,inventoryItems,players } from "../../database/schema.js";
import { emitToPlayer } from "../../infrastructure/realtime/socket-server.js";
import { requireAuth,type AuthedRequest } from "../auth/auth.js";
import { assertOutsideCombat } from "../inventory/store.js";
import { STAT_GAIN } from "./level.js";

export function createPlayerRoutes(app: express.Express): void {
  app.get("/me", requireAuth, (req, res) => {
    const player = (req as AuthedRequest).player;
    const inventory = db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.playerId, player.id))
      .orderBy(desc(inventoryItems.acquiredAt))
      .all();

    const response: MeResponse = {
      player: toPlayerDtoEquipped(player),
      inventory: inventory.map(toInventoryItemDto)
    };
    res.json(response);
  });

  // ПОТРАТИТЬ ОЧКО ХАРАКТЕРИСТИК: POST /me/stats
  // Очки выдаются за уровни (level.ts). За одно очко:
  // maxHealth +5 | strength +2 | defense +1 (см. STAT_GAIN).
  // При прокачке maxHealth текущий HP тоже растёт на +5 — иначе очко
  // в максимальное здоровье не давало бы ничего, пока игрок не полный.
  app.post("/me/stats", requireAuth, (req, res) => {
    const player = (req as AuthedRequest).player;
    const body = req.body as SpendStatPointRequest;
    try { assertOutsideCombat(db, player.id); } catch { return res.status(409).json({ error: 'Дождитесь окончания боя' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.entries(body).some(([k, v]) =>
      !Object.hasOwn(STAT_GAIN, k) || !Number.isSafeInteger(v) || v < 0)) return res.status(400).json({ error: 'Некорректные очки характеристик' });
    // 1. Есть что тратить? (перечитываем из БД — req.player мог устареть)
    const fresh = db.select().from(players).where(eq(players.id, player.id)).get()!;
    if (fresh.statPoints < 1) {
      res.status(409).json({ error: "Нет свободных очков характеристик" });
      return;
    }

    // 2. Тратим очко и поднимаем стат. health тоже поднимаем при maxHealth,
    //    но не выше нового максимума.
    const totalPoints = Object.values(body).reduce((a, b) => a + b, 0);

    if (totalPoints > fresh.statPoints) {
      return res.status(400).json({ error: "Недостаточно очков" });
    }

    const next = {
      statPoints: fresh.statPoints - totalPoints,
      maxHealth: fresh.maxHealth,
      health: fresh.health,
      strength: fresh.strength,
      defense: fresh.defense,
    };

    for (const [stat, points] of Object.entries(body)) {
      const gain = STAT_GAIN[stat as keyof typeof STAT_GAIN] * points;

      if (stat === "maxHealth") {
        next.maxHealth += gain;
        next.health = Math.min(next.maxHealth, next.health + gain);
      } else if (stat === "strength") {
        next.strength += gain;
      } else if (stat === "defense") {
        next.defense += gain;
      }
    }

    db.update(players).set(next).where(eq(players.id, player.id)).run();
    const updated = db.select().from(players).where(eq(players.id, player.id)).get()!;
    emitToPlayer(player.id, "player", toPlayerDto(updated));
    res.json({ player: toPlayerDtoEquipped(updated) });
  });

  // КОНСТРУКТОР ПЕРСОНАЖА: POST /me/character
  // Имя, группировка и аватар выбираются только при создании персонажа.
  app.get("/character-skins", requireAuth, (_req, res) => {
    const skins = db
      .select({
        id: characterSkins.id,
        name: characterSkins.name,
        imageUrl: characterSkins.imageUrl,
        sortOrder: characterSkins.sortOrder,
      })
      .from(characterSkins)
      .where(eq(characterSkins.enabled, true))
      .orderBy(asc(characterSkins.sortOrder))
      .all();
    const response: CharacterSkinsResponse = { skins };
    res.json(response);
  });

  app.use(
    "/character-images",
    express.static(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../data/characters"), {
      maxAge: "1y",
      immutable: true,
    }),
  );

  app.post("/me/character", requireAuth, (req, res) => {
    const player = (req as AuthedRequest).player;
    if (player.isCreated) return res.status(409).json({ error: "Персонаж уже создан" });
    const body = (req.body ?? {}) as Partial<CharacterCreateRequest>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const factionId = body.factionId;
    const avatar = typeof body.avatar === "string" ? body.avatar : "";

    if (name.length < 2 || name.length > 20) {
      res.status(400).json({ error: "Имя должно быть от 2 до 20 символов" });
      return;
    }
    if (!isFactionId(factionId)) {
      res.status(400).json({ error: "Выберите доступную группировку" });
      return;
    }
    const selectedSkin = avatar
      ? db.select({ id: characterSkins.id }).from(characterSkins)
          .where(and(eq(characterSkins.imageUrl, avatar), eq(characterSkins.enabled, true)))
          .get()
      : undefined;
    if (!selectedSkin) {
      res.status(400).json({ error: "Выберите аватар" });
      return;
    }

    db.update(players)
      .set({ name, factionId, avatar, isCreated: true })
      .where(and(eq(players.id, player.id), eq(players.isCreated, false)))
      .run();
    const updated = db.select().from(players).where(eq(players.id, player.id)).get()!;
    emitToPlayer(player.id, "player", toPlayerDto(updated));
    const response: CharacterCreateResponse = { player: toPlayerDtoEquipped(updated) };
    res.json(response);
  });

  // DEV: сброс конструктора персонажа. Доступен только когда включён DEV_BYPASS_AUTH,
  // чтобы на тестовом можно было заново пройти создание персонажа.
  app.post("/me/character/reset", requireAuth, (req, res) => {
    if (!config.devBypassAuth) {
      res.status(403).json({ error: "Доступно только в dev-режиме" });
      return;
    }
    const player = (req as AuthedRequest).player;
    db.update(players)
      .set({ isCreated: false, factionId: null, avatar: null })
      .where(eq(players.id, player.id))
      .run();
    const updated = db.select().from(players).where(eq(players.id, player.id)).get()!;
    emitToPlayer(player.id, "player", toPlayerDto(updated));
    const response: CharacterCreateResponse = { player: toPlayerDtoEquipped(updated) };
    res.json(response);
  });
}
