import type {
ClaimQuestResponse,
DailyQuestsResponse,
QuestResponse,
QuestsDto,
QuestsObjectiveType,
QuestsResponse
} from "@mmobot/shared";
import { and,eq,sql } from "drizzle-orm";
import type { Express,Request,Response } from "express";
import { db } from "../../database/connection.js";
import { toPlayerDtoEquipped,toQuestDto } from "../../database/mappers.js";
import { items,locations,mobs,playerQuests,players,quests,type QuestsRow } from "../../database/schema.js";
import { notify } from "../../infrastructure/telegram/notifications.js";
import { nowGameTime,todayGameDate } from "../../shared/time.js";
import type { AuthedRequest } from "../auth/auth.js";
import { requireAdmin } from "../auth/auth.js";
import { addXpForPlayer } from "../players/level.js";

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const OBJECTIVES: QuestsObjectiveType[] = ["kill", "walk", "collect", "visit", "loot", "casino_win"];

function parseQuestInput(body: unknown, current?: QuestsRow): { data: Omit<QuestsDto, "id"> } | { error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Ожидаются данные задания" };
  }
  const state = { targetId: null, targetXp: 0, targetPoints: 0, targetCoins: 0, ...current, ...body } as QuestsDto;
  if (typeof state.title !== "string" || !state.title.trim() ||
      typeof state.description !== "string" || !state.description.trim()) {
    return { error: "Укажите название и описание задания" };
  }
  if (!DIFFICULTIES.includes(state.difficulty) || !OBJECTIVES.includes(state.objectiveType)) {
    return { error: "Неизвестная сложность или тип задания" };
  }
  if (!Number.isSafeInteger(state.targetCount) || state.targetCount < 1) {
    return { error: "Количество для выполнения должно быть целым положительным числом" };
  }
  if ([state.targetXp, state.targetPoints, state.targetCoins].some((value) => !Number.isSafeInteger(value) || value < 0)) {
    return { error: "Награды должны быть целыми неотрицательными числами" };
  }
  if (state.targetId !== null && typeof state.targetId !== "string") {
    return { error: "Цель должна быть строкой или null" };
  }
  const targetId = state.targetId?.trim() || null;
  if (targetId !== null) {
    if (state.objectiveType === "casino_win") {
      if (!["mines", "blackjack", "ladder"].includes(targetId)) return { error: "Выберите игру казино: mines, blackjack или ladder" };
    } else if (state.objectiveType === "walk" || state.objectiveType === "visit") {
      if (!db.select().from(locations).where(eq(locations.id, targetId)).get()) return { error: "Локация не найдена" };
    } else {
      const catalog = state.objectiveType === "kill" ? mobs : items;
      const id = Number(targetId);
      if (!Number.isSafeInteger(id) || id < 0 || String(id) !== targetId ||
          !db.select({ id: catalog.id }).from(catalog).where(eq(catalog.id, id)).get()) {
        return { error: state.objectiveType === "kill" ? "Моб не найден" : "Предмет не найден" };
      }
      if (state.objectiveType === 'kill' && !db.select().from(mobs).where(eq(mobs.id, id)).get()?.isActive)
        return { error: 'Этот противник больше не встречается' };
    }
  }
  return { data: {
    title: state.title.trim(), description: state.description.trim(),
    difficulty: state.difficulty, objectiveType: state.objectiveType,
    targetId, targetCount: state.targetCount,
    targetXp: state.targetXp, targetPoints: state.targetPoints, targetCoins: state.targetCoins,
  } };
}

// Выдаёт игроку дневные квесты (по 1 на каждую сложность, случайный выбор),
// если на сегодня их ещё нет. Вызывается при запросе GET /quests/daily.
function assignDailyQuests(playerId: number): void {
  replaceArchivedDailyQuests(playerId);
  const day = todayGameDate();
  const existing = db
    .select()
    .from(playerQuests)
    .where(and(eq(playerQuests.playerId, playerId), eq(playerQuests.assignedDay, day)))
    .all();
  if (existing.length > 0) return;

  db.transaction((tx) => {
    for (const difficulty of DIFFICULTIES) {
      const pool = tx.select().from(quests).where(and(eq(quests.difficulty, difficulty), eq(quests.isActive, true))).all();
      if (pool.length === 0) continue; // квестов такой сложности ещё нет в каталоге
      const quest = pool[Math.floor(Math.random() * pool.length)];
      tx.insert(playerQuests)
        .values({ playerId, questId: quest.id, assignedDay: day, progress: 0, status: "waiting" })
        .run();
    }
  });
}

export function replaceArchivedDailyQuests(playerId?: number): void {
  db.transaction((tx) => {
    const pending = tx.select({ assignment: playerQuests, quest: quests }).from(playerQuests)
      .innerJoin(quests, eq(playerQuests.questId, quests.id)).where(and(
        eq(playerQuests.assignedDay, todayGameDate()), eq(playerQuests.status, 'waiting'), eq(quests.isActive, false),
        playerId === undefined ? undefined : eq(playerQuests.playerId, playerId),
      )).all();
    for (const { assignment, quest } of pending) {
      const assigned = new Set(tx.select().from(playerQuests).where(and(
        eq(playerQuests.playerId, assignment.playerId), eq(playerQuests.assignedDay, assignment.assignedDay),
      )).all().map(row => row.questId));
      const replacement = tx.select().from(quests).where(and(eq(quests.isActive, true), eq(quests.difficulty, quest.difficulty)))
        .all().find(row => !assigned.has(row.id));
      if (replacement) tx.update(playerQuests).set({ questId: replacement.id, progress: 0, completedAt: null })
        .where(eq(playerQuests.id, assignment.id)).run();
    }
  });
}

// Прогресс по квестам. Вызывай везде, где игрок что-то делает:
// progressQuests(playerId, "kill", mob.id) — убил моба
// progressQuests(playerId, "walk", location.id) — прогулялся по локации
// progressQuests(playerId, "collect", itemType) — нашёл предмет на прогулке или в бою
// progressQuests(playerId, "loot", itemType) — получил предмет с побеждённого моба
// progressQuests(playerId, "visit", location.id) — вошёл в локацию
// progressQuests(playerId, "casino_win", game, profit) — получил прибыль в казино
export function progressQuests(
  playerId: number,
  objectiveType: QuestsObjectiveType,
  targetId?: string | number,
  amount = 1
): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) return;
  const rows = db
    .select({ pq: playerQuests, quest: quests })
    .from(playerQuests)
    .innerJoin(quests, eq(quests.id, playerQuests.questId))
    .where(and(
      eq(playerQuests.playerId, playerId),
      eq(playerQuests.status, "waiting"),
      eq(playerQuests.assignedDay, todayGameDate()),
      eq(quests.objectiveType, objectiveType),
      eq(quests.isActive, true)
    ))
    .all();

  for (const { pq, quest } of rows) {
    if (quest.targetId !== null && String(quest.targetId) !== String(targetId)) continue;

    const progress = pq.progress + Math.min(amount, quest.targetCount - pq.progress);
    const done = progress >= quest.targetCount;

    db.update(playerQuests)
      .set({
        progress,
        status: done ? "completed" : "waiting",
        completedAt: done ? nowGameTime() : null
      })
      .where(eq(playerQuests.id, pq.id))
      .run();
    if (done) notify(playerId, `Вы выполнили квест: ${quest.title}`);
  }
}

export const createQuestRoutes = (app: Express) => {

  // ==== ДЛЯ ИГРОКОВ ====

  // Дневные квесты: 1 лёгкий + 1 средний + 1 тяжёлый (рандом)
  app.get("/quests/daily", (req: Request, res: Response) => {
    const player = (req as AuthedRequest).player;
    assignDailyQuests(player.id);

    const rows = db
      .select()
      .from(playerQuests)
      .where(and(eq(playerQuests.playerId, player.id), eq(playerQuests.assignedDay, todayGameDate())))
      .all();

    const response: DailyQuestsResponse = {
      quests: rows.map((row) => {
        const quest = db.select().from(quests).where(eq(quests.id, row.questId)).get()!;
        return {
          id: row.id,
          quest: toQuestDto(quest),
          progress: row.progress,
          status: row.status,
          assignedDay: row.assignedDay
        };
      })
    };
    res.json(response);
  });

  // Забрать награду за выполненный квест
  app.post("/quests/:id/claim", (req: Request, res: Response) => {
    const player = (req as AuthedRequest).player;
    const pq = db
      .select()
      .from(playerQuests)
      .where(and(
        eq(playerQuests.id, Number(req.params.id)),
        eq(playerQuests.playerId, player.id)
      ))
      .get();
    if (!pq) {
      res.status(404).json({ error: "Quest not found" });
      return;
    }
    if (pq.status === "claimed") {
      res.status(409).json({ error: "Already claimed" });
      return;
    }
    if (pq.status !== "completed") {
      res.status(409).json({ error: "Quest is not completed" });
      return;
    }

    const quest = db.select().from(quests).where(eq(quests.id, pq.questId)).get();
    if (!quest) {
      res.status(404).json({ error: "Quest template not found" });
      return;
    }

    const now = nowGameTime();
    const claimed = db.transaction((tx) => {
      const result = tx.update(playerQuests)
        .set({ status: "claimed", claimedAt: now })
        .where(and(eq(playerQuests.id, pq.id), eq(playerQuests.status, "completed")))
        .run();
      if (result.changes !== 1) return false;

      tx.update(players)
        .set({
          points: sql`${players.points} + ${quest.targetPoints}`,
          money: sql`${players.money} + ${quest.targetCoins}`
        })
        .where(eq(players.id, player.id))
        .run();

      addXpForPlayer(player.id, quest.targetXp);
      return true;
    });
    if (!claimed) {
      res.status(409).json({ error: "Already claimed" });
      return;
    }

    const updatedPlayer = db.select().from(players).where(eq(players.id, player.id)).get()!;
    const response: ClaimQuestResponse = { player: toPlayerDtoEquipped(updatedPlayer), claimed: true };
    res.json(response);
  });

  // ==== CRUD КАТАЛОГА КВЕСТОВ (только админ) ====

  app.get("/quests", requireAdmin, (req: Request, res: Response) => {
    const rows = db.select().from(quests).where(eq(quests.isActive, true)).all();
    const response: QuestsResponse = { quests: rows.map(toQuestDto) };
    res.json(response);
  });

  app.get("/quests/:id", requireAdmin, (req: Request, res: Response) => {
    const quest = db.select().from(quests).where(eq(quests.id, Number(req.params.id))).get();
    if (!quest) {
      res.status(400).json({ error: "Quest not found" });
      return;
    }
    const response: QuestResponse = { quest: toQuestDto(quest) };
    res.json(response);
  });

//Создать квест
  app.post("/quests", requireAdmin, (req: Request, res: Response) => {
    const parsed = parseQuestInput(req.body);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const create = db.insert(quests).values(parsed.data).returning().get();

    const response: QuestResponse = { quest: toQuestDto(create) };
    res.status(200).json(response);
  });

  app.put("/quests/:id", requireAdmin, (req: Request, res: Response) => {
    const quest = db.select().from(quests).where(eq(quests.id, Number(req.params.id))).get();
    if (!quest) {
      res.status(400).json({ error: "Quest not found" });
      return;
    }
    const parsed = parseQuestInput(req.body, quest);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const update = db.update(quests).set(parsed.data).where(eq(quests.id, quest.id)).returning().get();

    const response: QuestResponse = { quest: toQuestDto(update) };
    res.status(200).json(response);
  });
  
  //Удалить
  app.delete("/quests/:id", requireAdmin, (req: Request, res: Response) => {
    const quest = db.select().from(quests).where(eq(quests.id, Number(req.params.id))).get();
    if (!quest) {
      res.status(400).json({ error: "Quest not found" });
      return;
    }
    db.update(quests).set({ isActive: false }).where(eq(quests.id, quest.id)).run();
    res.status(200).end();
  });
};
