// ============================================================================
// ДРУЗЬЯ
// ============================================================================
//
// Флоу добавления в друзья (как в соцсетях):
//
//   1. POST   /friends/request   { friendId } — игрок A шлёт заявку игроку B
//   2. POST   /friends/:id/accept               — B принимает → дружба
//   2b. POST  /friends/:id/decline              — B отклоняет
//   3. DELETE /friends/:id                      — удалить друга / отозвать заявку
//   *  GET    /friends                          — мои друзья + заявки
//   *  GET    /friends/search?q=                — поиск игроков по коду/имени
//
// Заявка и дружба хранятся в одной таблице friendships:
//   status = pending   — заявка ждёт ответа
//   status = accepted  — игроки друзья
//   status = declined  — отклонено
//   status = removed   — удалено (не удаляем строку, чтобы не создать дубль)
//
// Уникальный индекс (fromId, toId) не даёт отправить одну и ту
// же заявку дважды и не даёт существовать зеркальной паре A→B и B→A:
// вторая заявка от B к A просто принимается как встречная.

import type { Express } from "express"
import type { AuthedRequest } from "./auth.js"
import { db, toFriendDto } from "./db.js"
import { friendships, players } from "./db/schema.js"
import { and, eq, inArray, or, sql } from "drizzle-orm"
import { nowGameTime } from "./time.js"
import { notify } from "./notification.js"
import { isPlayerOnline } from "./realTime.js"
import type { FriendDto, FriendRequestDto, FriendsOverviewResponse } from "@mmobot/shared"

export const createAddFriend = (app: Express) => {

  // Поиск игроков: по 5-значному коду друга (friendId) и по имени
  // Самого себя не возвращаем. Результат — массив FriendDto (online вычисляем)
  app.get("/friends/search", (req: AuthedRequest extends never ? never : any, res: any) => {
    const player = (req as AuthedRequest).player
    const q = String((req as any).query?.q ?? "").trim()
    if (!q) {
      res.json({ players: [] })
      return
    }

    const byCode = db.select().from(players).where(eq(players.friendId, Number(q))).all()
    const byName = q.length >= 2
      ? db.select().from(players)
        .where(and(sql`${players.name} LIKE ${"%" + q + "%"}`, sql`${players.id} != ${player.id}`))
        .limit(20).all()
      : []

    const map = new Map<number, typeof players.$inferSelect>()
    for (const p of [...byCode, ...byName]) {
      if (p.id === player.id) continue
      map.set(p.id, p)
    }

    const players_dto: FriendDto[] = [...map.values()].map((p) => toFriendDto(p))
    const response: { players: FriendDto[] } = { players: players_dto }
    res.json(response)
  })

  // ШАГ 1: отправить заявку в друзья по коду (friendId)
  app.post("/friends/request", (req: any, res: any) => {
    const player = (req as AuthedRequest).player
    const friendId = Number(req.body?.friendId)

    const target = db.select().from(players).where(eq(players.friendId, friendId)).get()
    if (!target) {
      res.status(404).json({ error: "Игрок не найден" })
      return
    }
    if (target.id === player.id) {
      res.status(400).json({ error: "Нельзя добавить себя в друзья" })
      return
    }

    // Ищем уже существующую связь между нами (в любую сторону)
    const existing = db.select().from(friendships)
      .where(or(
        and(eq(friendships.fromId, player.id), eq(friendships.toId, target.id)),
        and(eq(friendships.fromId, target.id), eq(friendships.toId, player.id))
      ))
      .get()

    if (existing) {
      if (existing.status === "accepted") {
        res.status(409).json({ error: "Уже в друзьях" })
        return
      }
      // Встречная заявка от него ко мне — сразу принимаем, оба довольны
      if (existing.status === "pending" && existing.fromId === target.id) {
        db.update(friendships)
          .set({ status: "accepted", updatedAt: nowGameTime() })
          .where(eq(friendships.id, existing.id)).run()
        res.status(201).json({ ok: true, status: "accepted" })
        return
      }
      if (existing.status === "pending" && existing.fromId === player.id) {
        res.status(409).json({ error: "Заявка уже отправлена" })
        return
      }
      // declined/removed — превращаем в новую исходящую заявку
      db.update(friendships)
        .set({
          status: "pending",
          fromId: player.id,
          toId: target.id,
          createdAt: nowGameTime(),
          updatedAt: nowGameTime()
        })
        .where(eq(friendships.id, existing.id)).run()
      notify(target.id, `${player.name} хочет добавить вас в друзья`)
      res.status(201).json({ ok: true, status: "pending" })
      return
    }

    db.insert(friendships).values({
      fromId: player.id,
      toId: target.id,
      status: "pending",
      createdAt: nowGameTime(),
      updatedAt: nowGameTime()
    }).run()

    notify(target.id, `${player.name} хочет добавить вас в друзья`)
    res.status(201).json({ ok: true, status: "pending" })
  })

  // СПИСОК: друзья + входящие/исходящие заявки
  app.get("/friends", (req: any, res: any) => {
    const player = (req as AuthedRequest).player

    const rows = db.select().from(friendships)
      .where(or(eq(friendships.fromId, player.id), eq(friendships.toId, player.id)))
      .all()

    const accepted = rows.filter((r) => r.status === "accepted")
    const pending = rows.filter((r) => r.status === "pending")

    // Друзья: собираем id "другого" игрока из принятых заявок
    const friendIds = accepted.map((r) => r.fromId === player.id ? r.toId : r.fromId)
    const friendRows = friendIds.length
      ? db.select({ id: players.id, name: players.name, level: players.level })
        .from(players).where(inArray(players.id, friendIds)).all(): []
    const friends: FriendDto[] = friendRows.map(toFriendDto)

    // Заявки: определяем направление по тому, кто requester
    const requests: FriendRequestDto[] = pending.map((r) => {
      const otherId = r.fromId === player.id ? r.toId : r.fromId
      const other = db.select({ id: players.id, name: players.name, level: players.level })
        .from(players).where(eq(players.id, otherId)).get()
      return {
        id: r.id,
        playerId: other?.id ?? 0,
        name: other?.name ?? "?",
        level: other?.level ?? 1,
        direction: r.fromId === player.id ? "outgoing" : "incoming"
      }
    })

    const response: FriendsOverviewResponse = { friends, requests }
    res.json(response)
  })

  // ШАГ 2: принять входящую заявку (только адресат)
  app.post("/friends/:id/accept", (req: any, res: any) => {
    const player = (req as AuthedRequest).player
    const fr = db.select().from(friendships).where(eq(friendships.id, Number(req.params.id))).get()

    if (!fr || fr.toId !== player.id || fr.status !== "pending") {
      res.status(404).json({ error: "Заявка не найдена" })
      return
    }

    db.update(friendships)
      .set({ status: "accepted", updatedAt: nowGameTime() })
      .where(eq(friendships.id, fr.id)).run()

    res.json({ ok: true })
  })

  // ШАГ 2b: отклонить входящую заявку (только адресат)
  app.post("/friends/:id/decline", (req: any, res: any) => {
    const player = (req as AuthedRequest).player
    const fr = db.select().from(friendships).where(eq(friendships.id, Number(req.params.id))).get()

    if (!fr || fr.toId !== player.id || fr.status !== "pending") {
      res.status(404).json({ error: "Заявка не найдена" })
      return
    }

    db.update(friendships)
      .set({ status: "declined", updatedAt: nowGameTime() })
      .where(eq(friendships.id, fr.id)).run()

    res.json({ ok: true })
  })

  // ШАГ 3: удалить друга или отозвать/отклонить свою заявку (любой участник)
  app.delete("/friends/:id", (req: any, res: any) => {
    const player = (req as AuthedRequest).player
    const fr = db.select().from(friendships).where(eq(friendships.id, Number(req.params.id))).get()

    if (!fr || (fr.fromId !== player.id && fr.toId !== player.id)) {
      res.status(404).json({ error: "Не найдено" })
      return
    }

    db.update(friendships)
      .set({ status: "removed", updatedAt: nowGameTime() })
      .where(eq(friendships.id, fr.id)).run()

    res.json({ ok: true })
  })
}
