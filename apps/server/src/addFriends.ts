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
//   *  GET    /friends/search?q=                — поиск игрока по коду (friendId)
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
import { db, buildFriendsOverview, toFriendDto } from "./db.js"
import { friendships, players } from "./db/schema.js"
import { and, eq, inArray, or } from "drizzle-orm"
import { nowGameTime } from "./time.js"
import { notify } from "./notification.js"
import { isPlayerOnline } from "./realTime.js"
import type { FriendDto, FriendRequestDto, FriendsOverviewResponse } from "@mmobot/shared"

export const createAddFriend = (app: Express) => {

    // Собрать DTO друга/игрока со статусом онлайна
    function toFriendDto(p: { id: number; name: string; level: number }): FriendDto {
        return { id: p.id, name: p.name, level: p.level, online: isPlayerOnline(p.id) }
    }

    // Поиск игрока ТОЛЬКО по 5-значному коду друга (friendId).
    // Самого себя не возвращаем. Результат — массив FriendDto (online вычисляем)
    app.get("/friends/search", (req: any, res: any) => {
        const player = (req as AuthedRequest).player
        const friendId = Number(String((req as any).query?.q ?? "").trim())
        console.log(`[friends] GET /friends/search q=${friendId} от player ${player.id}`)

        if (!Number.isInteger(friendId)) {
            res.json({ players: [] })
            return
        }

        const found = db.select().from(players).where(eq(players.friendId, friendId)).all()
        const players_dto: FriendDto[] = found
            .filter((p) => p.id !== player.id)
            .map((p) => toFriendDto(p))

        const response: { players: FriendDto[] } = { players: players_dto }
        res.json(response)
    })

    // ШАГ 1: отправить заявку в друзья по коду (friendId)
    app.post("/friends/request", (req: any, res: any) => {
        const player = (req as AuthedRequest).player
        const friendId = Number(req.body?.friendId)
        console.log(`[friends] POST /friends/request friendId=${friendId} от player ${player.id}`)

        if (!Number.isInteger(friendId)) {
            res.status(400).json({ error: "friendId должен быть числом" })
            return
        }

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
        console.log(`[friends] GET /friends от player ${player.id}`)
        res.json(buildFriendsOverview(player.id))
    })

    // ШАГ 2: принять входящую заявку (только получатель)
    app.post("/friends/:id/accept", (req: any, res: any) => {
        const player = (req as AuthedRequest).player
        const fr = db.select().from(friendships).where(eq(friendships.id, Number(req.params.id))).get()
        console.log(`[friends] POST /friends/${req.params.id}/accept от player ${player.id}`)

        if (!fr || fr.toId !== player.id || fr.status !== "pending") {
            res.status(404).json({ error: "Заявка не найдена" })
            return
        }

        db.update(friendships)
            .set({ status: "accepted", updatedAt: nowGameTime() })
            .where(eq(friendships.id, fr.id)).run()
        notify(fr.fromId, `${player.name} принял вашу заявку на дружбу!`)
        console.log(`[friends] accept ok: friendship ${fr.id}`)
        res.json({ ok: true })
    })

    // ШАГ 2b: отклонить входящую заявку (только получатель)
    app.post("/friends/:id/decline", (req: any, res: any) => {
        const player = (req as AuthedRequest).player
        const fr = db.select().from(friendships).where(eq(friendships.id, Number(req.params.id))).get()
        console.log(`[friends] POST /friends/${req.params.id}/decline от player ${player.id}`)

        if (!fr || fr.toId !== player.id || fr.status !== "pending") {
            res.status(404).json({ error: "Заявка не найдена" })
            return
        }

        db.update(friendships)
            .set({ status: "declined", updatedAt: nowGameTime() })
            .where(eq(friendships.id, fr.id)).run()
        notify(fr.fromId, `${player.name} отклонил вашу заявку на дружбу!`)
        res.json({ ok: true })
    })

    // ШАГ 3: удалить друга или отозвать/отклонить свою заявку (любой участник)
    // :id здесь — id игрока-друга (так приходит с клиента), ищем связь по паре игроков.
    app.delete("/friends/:id", (req: any, res: any) => {
        const player = (req as AuthedRequest).player
        const otherId = Number(req.params.id)
        console.log(`[friends] DELETE /friends/${otherId} от player ${player.id}`)

        const fr = db.select().from(friendships)
            .where(or(
                and(eq(friendships.fromId, player.id), eq(friendships.toId, otherId)),
                and(eq(friendships.fromId, otherId), eq(friendships.toId, player.id))
            )).get()

        if (!fr) {
            console.log(`[friends] DELETE не найдено: связь player ${player.id} <-> ${otherId}`)
            res.status(404).json({ error: "Не найдено" })
            return
        }

        db.update(friendships)
            .set({ status: "removed", updatedAt: nowGameTime() })
            .where(eq(friendships.id, fr.id)).run()

        console.log(`[friends] DELETE ok: friendship ${fr.id}`)
        res.json({ ok: true })
    })
}