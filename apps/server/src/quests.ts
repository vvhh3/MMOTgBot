import type { Express, Request, Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import type {
  ClaimQuestResponse,
  DailyQuestsResponse,
  QuestResponse,
  QuestsDto,
  QuestsObjectiveType,
  QuestsResponse
} from "@mmobot/shared";
import type { AuthedRequest } from "./auth.js";
import { requireAdmin } from "./auth.js";
import { db, toPlayerDtoEquipped, toQuestDto } from "./db.js";
import { playerQuests, players, quests } from "./db/schema.js";
import { addXpForPlayer } from "./level.js";
import { nowGameTime, todayGameDate } from "./time.js";

const DIFFICULTIES = ["easy", "medium", "hard"] as const;

// Выдаёт игроку дневные квесты (по 1 на каждую сложность, случайный выбор),
// если на сегодня их ещё нет. Вызывается при запросе GET /quests/daily.
function assignDailyQuests(playerId: number): void {
  const day = todayGameDate();
  const existing = db
    .select()
    .from(playerQuests)
    .where(and(eq(playerQuests.playerId, playerId), eq(playerQuests.assignedDay, day)))
    .all();
  if (existing.length > 0) return;

  db.transaction((tx) => {
    for (const difficulty of DIFFICULTIES) {
      const pool = tx.select().from(quests).where(eq(quests.difficulty, difficulty)).all();
      if (pool.length === 0) continue; // квестов такой сложности ещё нет в каталоге
      const quest = pool[Math.floor(Math.random() * pool.length)];
      tx.insert(playerQuests)
        .values({ playerId, questId: quest.id, assignedDay: day, progress: 0, status: "waiting" })
        .run();
    }
  });
}

// Прогресс по квестам. Вызывай везде, где игрок что-то делает:
// progressQuests(playerId, "kill", mob.id) — убил моба
// progressQuests(playerId, "walk")        — прогулялся по локации
// progressQuests(playerId, "collect", itemType) — получил предмет
// progressQuests(playerId, "visit", location.id) — вошёл в локацию
export function progressQuests(
  playerId: number,
  objectiveType: QuestsObjectiveType,
  targetId?: string | number
): void {
  const rows = db
    .select()
    .from(playerQuests)
    .where(and(eq(playerQuests.playerId, playerId), eq(playerQuests.status, "waiting")))
    .all();

  for (const pq of rows) {
    const quest = db.select().from(quests).where(eq(quests.id, pq.questId)).get();
    if (!quest || quest.objectiveType !== objectiveType) continue;
    if (quest.targetId !== null && String(quest.targetId) !== String(targetId)) continue;

    const progress = Math.min(pq.progress + 1, quest.targetCount);
    const done = progress >= quest.targetCount;
    db.update(playerQuests)
      .set({
        progress,
        status: done ? "completed" : "waiting",
        completedAt: done ? nowGameTime() : null
      })
      .where(eq(playerQuests.id, pq.id))
      .run();
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
    db.transaction((tx) => {
      tx.update(playerQuests)
        .set({ status: "claimed", claimedAt: now })
        .where(eq(playerQuests.id, pq.id))
        .run();

      tx.update(players)
        .set({ points: sql`${players.points} + ${quest.targetPoints}` })
        .where(eq(players.id, player.id))
        .run();

      addXpForPlayer(player.id, quest.targetXp);
    });

    const updatedPlayer = db.select().from(players).where(eq(players.id, player.id)).get()!;
    const response: ClaimQuestResponse = { player: toPlayerDtoEquipped(updatedPlayer), claimed: true };
    res.json(response);
  });

  // ==== CRUD КАТАЛОГА КВЕСТОВ (только админ) ====

  app.get("/quests", requireAdmin, (req: Request, res: Response) => {
    const rows = db.select().from(quests).all();
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
    const state = req.body as QuestsDto;

    if (!state.title || !state.description || !state.difficulty ||
        !state.objectiveType || !state.targetCount) {
      res.status(400).json({ error: "Data is failed" });
      return;
    }

    const create = db.insert(quests).values({
      title: state.title,
      description: state.description,
      difficulty: state.difficulty,
      objectiveType: state.objectiveType,
      targetId: state.targetId ?? null,
      targetCount: state.targetCount,
      targetXp: state.targetXp ?? 0,
      targetPoints: state.targetPoints ?? 0,
    }).returning().get();

    const response: QuestResponse = { quest: toQuestDto(create) };
    res.status(200).json(response);
  });

  app.put("/quests/:id", requireAdmin, (req: Request, res: Response) => {
    const quest = db.select().from(quests).where(eq(quests.id, Number(req.params.id))).get();
    if (!quest) {
      res.status(400).json({ error: "Quest not found" });
      return;
    }
    const state = req.body as Partial<QuestsDto>;

    const update = db.update(quests).set({
      title: state.title ?? quest.title,
      description: state.description ?? quest.description,
      difficulty: state.difficulty ?? quest.difficulty,
      objectiveType: state.objectiveType ?? quest.objectiveType,
      targetId: state.targetId ?? quest.targetId,
      targetCount: state.targetCount ?? quest.targetCount,
      targetXp: state.targetXp ?? quest.targetXp,
      targetPoints: state.targetPoints ?? quest.targetPoints,
    }).where(eq(quests.id, quest.id)).returning().get();

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
    db.delete(quests).where(eq(quests.id, quest.id)).run();
    res.status(200).end();
  });
};