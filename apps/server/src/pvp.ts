// ============================================================================
// PVP — ДУЭЛИ МЕЖДУ ИГРОКАМИ (поочерёдные ходы)
// ============================================================================
//
// Флоу дуэли:
//
//   1. POST   /pvp            — игрок A вызывает игрока B на дуэль
//   2. POST   /pvp/:id/accept — B принимает → бой активен, ход у A (player1)
//   3. POST   /pvp/:id/action — участники бьют по очереди: attack | flee
//   *  DELETE /pvp/:id        — отклонить приглашение / сдаться на любом шаге
//
// Роли в сессии:
//
//   player1 — тот, кто КИНУЛ вызов (ходит первым)
//   player2 — тот, кто вызов ПОЛУЧИЛ и принял
//
// Ключевые принципы безопасности:
//
//   - Один активный PvP-контент на игрока (hasActivePvp): нельзя драться
//     в двух дуэлях одновременно.
//   - Ходить может ТОЛЬКО тот, чей ход (поле turn в БД) — проверяется
//     перед каждым действием.
//   - Урон считается через getPlayerStats() — учитывается экипировка.
//   - HP обоих бойцов фиксируется в момент ПРИНЯТИЯ дуэли (accept),
//     чтобы нельзя было "подлечиться" посреди чужого хода.
//   - Зависшие дуэли (нет ходов дольше STALE_PVP_MS) чистит maintenance.ts.
//
// Статусы сессии:
//   pending  — вызов отправлен, ждёт ответа
//   active   — бой идёт, участники ходят по очереди
//   finished — бой завершён; winnerId = null только при отмене непринятого вызова

import type { Express, Request, Response } from "express"
import type { AuthedRequest } from "./auth.js"
import { inventoryItems, items, players, pvpSessions,combatSessions, mobs, trades } from "./db/schema.js";
import type { PvpSessionRow } from "./db/schema.js";
import { emitToPlayer } from "./realTime.js";
import { CombatLogEntry, PvpStateDto, PvpOverviewResponse } from "@mmobot/shared";
import { db } from "./db.js";
import { eq, sql, and, or } from "drizzle-orm"
import { notify } from "./notification.js";
import { getPlayerStats } from "./combat.js";
import { addXpForPlayer } from "./level.js";
import { nowGameTime, nowGameTimeMs } from "./time.js";
import { session } from "grammy";

// Дуэль считается заброшенной после пяти минут без ходов; просмотр не продлевает срок.
export const STALE_PVP_MS = 5 * 60 * 1000;

// Очищаем только ссылку на эту дуэль: у игрока уже могло появиться другое занятие.
function clearPvpLastAction(pvp: PvpSessionRow): void {
    for (const id of [pvp.player1Id, pvp.player2Id]) {
        const player = db.select().from(players).where(eq(players.id, id)).get();
        if (player?.idTheLastAction?.type === "Fight" && player.idTheLastAction.id === pvp.id) {
            db.update(players).set({ idTheLastAction: null }).where(eq(players.id, id)).run();
        }
    }
}

// лог дуэли по сессиям (хранится в памяти, в БД его нет —
// как combatSessionsLogs в combat.ts; сбрасывается при перезапуске сервера)
const combatSessionsLogs = new Map<number, CombatLogEntry[]>();

// Фиксируем исход и награду одной транзакцией, независимо от причины завершения.
// Повторный запрос возвращает прежний результат и не начисляет награду заново.
function finishPvpSession(
    sessionId: number,
    winnerId: number | null,
    health: Partial<Pick<PvpSessionRow, "player1Health" | "player2Health">> = {},
): PvpSessionRow {
    let changed = false;
    const result = db.transaction(() => {
        const current = db.select().from(pvpSessions).where(eq(pvpSessions.id, sessionId)).get();
        if (!current) throw new Error("Дуэль не найдена");
        if (current.status === "finished") {
            clearPvpLastAction(current);
            return current;
        }

        // Непринятое приглашение можно отменить без победителя и штрафов.
        const winner = current.status === "active" ? winnerId : null;
        if (current.status === "active" && winner !== current.player1Id && winner !== current.player2Id) {
            throw new Error("Для завершённой дуэли нужен победитель");
        }
        const loser = winner === null ? null : winner === current.player1Id ? current.player2Id : current.player1Id;
        const finished: PvpSessionRow = {
            ...current,
            ...health,
            status: "finished",
            winnerId: winner,
            lastActionAt: nowGameTime(),
        };
        if (loser === current.player1Id) finished.player1Health = 0;
        if (loser === current.player2Id) finished.player2Health = 0;

        db.update(pvpSessions).set({
            status: finished.status, winnerId: winner, lastActionAt: finished.lastActionAt,
            player1Health: finished.player1Health, player2Health: finished.player2Health,
        }).where(eq(pvpSessions.id, sessionId)).run();
        clearPvpLastAction(current);
        if (winner !== null) {
            addXpForPlayer(winner, 10);
            db.update(players).set({ points: sql`${players.points} + 10` }).where(eq(players.id, winner)).run();
        }
        if (loser !== null) {
            // Одинаковые последствия поражения от удара, сдачи, побега и бездействия.
            db.update(players).set({ health: 0 }).where(eq(players.id, loser)).run();
        }
        changed = true;
        return finished;
    });
    if (changed) {
        combatSessionsLogs.delete(sessionId);
        notifyBoth(result);
    }
    return result;
}

// Завершает зависшие дуэли (игрок принял вызов и закрыл приложение / ушёл).
// Без этого сессия навсегда блокирует обоим участникам новые дуэли
// (см. hasActivePvp). Проигрывает игрок, не сделавший свой ход за пять минут.
// Вызывается при старте сервера и по таймеру из maintenance.ts.
export function expireStalePvpSessions(): void {
  const cutoff = new Date(nowGameTimeMs() - STALE_PVP_MS).toISOString();
  const stale = db.select().from(pvpSessions)
    .where(and(
      or(eq(pvpSessions.status, "pending"), eq(pvpSessions.status, "active")),
      sql`coalesce(${pvpSessions.lastActionAt}, ${pvpSessions.creadetAt}) <= ${cutoff}`
    ))
    .all();

  for (const session of stale) {
    const winnerId = session.status === "active"
      ? session.turn === "player1" ? session.player2Id : session.player1Id
      : null;
    finishPvpSession(session.id, winnerId);
  }

  if (stale.length > 0) {
    console.log(`[pvp] expired ${stale.length} stale session(s)`);
  }
}

// Отправляет обоим участникам свежее состояние их дуэли через сокет
// Вызывается после КАЖДОГО изменения сессии, чтобы клиенту не нужен был поллинг
// Каждый получит свою версию DTO (со своей стороны)
function notifyBoth(pvp: PvpSessionRow): void {
    emitToPlayer(pvp.player1Id, "pvpState", buildPvpState(pvp, pvp.player1Id))
    emitToPlayer(pvp.player2Id, "pvpState", buildPvpState(pvp, pvp.player2Id))
}

// Определяет, чью сторону в дуэли занимает игрок
// "player1" — тот, кто кинул приглашение; "player2" — тот, кто его получил
// null — игрок вообще не участник этой битвы (чужая битва, доступ запрещён).
function myRole(pvp: PvpSessionRow, playerId: number): "player1" | "player2" | null {
    if (pvp.player1Id === playerId) return "player1"
    if (pvp.player2Id === playerId) return "player2"
    return null;
}

// Есть ли у игрока незавершённая дуэль (приглашение или активный бой).
// excludePvpId — дуэль, которую НЕ учитываем (нужно в accept, иначе
// само принимаемое приглашение заблокировало бы собственное принятие).
const hasActivePvp = (playerId: number, excludePvpId?: number): boolean => {
    const rows = db.select().from(pvpSessions)
        .where(and(
            or(eq(pvpSessions.player1Id, playerId), eq(pvpSessions.player2Id, playerId)),
            or(eq(pvpSessions.status, "pending"), eq(pvpSessions.status, "active"))
        )).all()
    return rows.some((s) => s.id !== excludePvpId)
}

// Собирает состояние дуэли С ТОЧКИ ЗРЕНИЯ КОНКРЕТНОГО игрока:
// myHp/partnerHp/myTurn — всё перевёрнуто под роль смотрящего.
// В БД всё хранится по сторонам (player1Health/player2Health, turn),
// но игроку удобнее думать "моё / его" — здесь мы переворачиваем данные.
//
// isWon: null = бой не завершён или вызов отменён; true/false — только для
// завершённой дуэли с определённым победителем.
function buildPvpState(pvp: PvpSessionRow, playerId: number): PvpStateDto | null {
    const role = myRole(pvp, playerId);
    if (!role) return null;

    // имя партнёра — для заголовка окна ("Дуэль с Иваном")
    const partnerId = role === "player1" ? pvp.player2Id : pvp.player1Id
    const myId = role === "player1" ? pvp.player1Id : pvp.player2Id

    const im = db.select({ name: players.name, maxHealth: players.maxHealth }).from(players).where(eq(players.id, myId)).get();
    const partner = db.select({ name: players.name, maxHealth: players.maxHealth, avatar: players.avatar }).from(players).where(eq(players.id, partnerId)).get();

    if (!im || !partner) return null

    return {
        id: pvp.id,
        status: pvp.status,
        // player1 — тот, кто кинул вызов (outgoing); player2 — получатель (incoming)
        direction: role === "player1" ? "outgoing" : "incoming",
        myName: im.name,
        partnerName: partner.name,
        partnerAvatar: partner.avatar,
        myHp: role === "player1" ? pvp.player1Health : pvp.player2Health,
        myMaxHp: im.maxHealth,
        partnerMaxHp: partner.maxHealth,
        partnerHp: role === "player1" ? pvp.player2Health : pvp.player1Health,
        myTurn: pvp.turn === role,
        finished: pvp.status === "finished",
        isWon: pvp.status !== "finished" || pvp.winnerId === null ? null : pvp.winnerId === myId
    }
}

// Единое представление состояния для сокета, HTTP и восстановления после перезагрузки.
export function getPvpStateForPlayer(sessionId: number, playerId: number): PvpStateDto | null {
    const pvp = db.select().from(pvpSessions).where(eq(pvpSessions.id, sessionId)).get();
    if (!pvp || !myRole(pvp, playerId)) return null;
    if (pvp.status === "finished") clearPvpLastAction(pvp);
    return buildPvpState(pvp, playerId);
}

export const createPvpRoutes = (app: Express) => {

    // Антифарм/антиспам: минимальная пауза между вызовами одного игрока.
    // Вызов шлёт socket + Telegram-уведомление — без кулдауна можно
    // завалить жертву сотнями приглашений и уведомлений.
    const PVP_INVITE_COOLDOWN_MS = 15 * 1000;
    const lastInviteAt = new Map<number, number>();

    app.get("/pvp/:id", (req: Request, res: Response) => {
        expireStalePvpSessions();
        const state = getPvpStateForPlayer(Number(req.params.id), (req as AuthedRequest).player.id);
        if (!state) return res.status(404).json({ error: "Дуэль не найдена" });
        return res.json(state);
    });

    // --- СПИСОК: мои приглашения + активная дуэль ---
    // Разовый запрос (открытие экрана / реконнект). Живые обновления
    // приходят через socket-событие "pvpState".
    app.get("/pvp", (req: Request, res: Response) => {
        const player = (req as AuthedRequest).player

        // все незавершённые сессии с моим участием (и приглашения, и активный бой)
        const rows = db.select().from(pvpSessions)
            .where(and(
                or(eq(pvpSessions.player1Id, player.id), eq(pvpSessions.player2Id, player.id)),
                or(eq(pvpSessions.status, "pending"), eq(pvpSessions.status, "active"))
            )).all()

        const response: PvpOverviewResponse = {
            invites: rows
                .filter((s) => s.status === "pending")
                .map((s) => {
                    const partnerId = s.player1Id === player.id ? s.player2Id : s.player1Id;
                    const partner = db.select({ name: players.name }).from(players).where(eq(players.id, partnerId)).get();
                    return {
                        id: s.id,
                        partnerName: partner?.name ?? "?",
                        direction: s.player2Id === player.id ? ("incoming" as const) : ("outgoing" as const)
                    };
                }),
            active: rows.find((s) => s.status === "active")
                ? buildPvpState(rows.find((s) => s.status === "active")!, player.id)
                : null
        };
        res.json(response);
    })

    // --- ШАГ 1: вызвать игрока на дуэль ---
    app.post("/pvp", (req: Request, res: Response) => {
        const player = (req as AuthedRequest).player
        const toPlayerId = Number(req.body.toPlayerId)

        if (!Number.isInteger(toPlayerId)) return res.status(400).json({ error: "toPlayerId error" })
        if (toPlayerId === player.id) return res.status(400).json({ error: "Нельзя драться с самим собой" })

        const target = db.select().from(players).where(eq(players.id, toPlayerId)).get()
        if (!target) return res.status(404).json({ error: "Игрок не найден" })

        // оба должны быть живы (после поражения HP = 0, пока регенерация не поднимет)
        if (player.health <= 0 || target.health <= 0) return res.status(409).json({ error: "Один из игроков мёртв" })

        if (hasActivePvp(player.id) || hasActivePvp(toPlayerId)) return res.status(409).json({ error: "Один из игроков уже в бою" })

        // кулдаун: не чаще одного вызова в PVP_INVITE_COOLDOWN_MS
        const nowMs = Date.now();
        const lastAt = lastInviteAt.get(player.id) ?? 0;
        if (nowMs - lastAt < PVP_INVITE_COOLDOWN_MS) {
            return res.status(429).json({ error: "Слишком часто, подождите немного" });
        }
        lastInviteAt.set(player.id, nowMs);

        const result = db.insert(pvpSessions).values({
            player1Id: player.id,
            player2Id: toPlayerId,
            status: "pending",
            player1Health: player.health,   // HP зафиксируем при accept
            player2Health: target.health,
            turn: "player1",
            creadetAt: nowGameTime(),       // опечатка осталась из схемы ("creadetAt"), пишем как есть
            lastActionAt: null
        }).run();

        const session = db.select().from(pvpSessions).where(eq(pvpSessions.id, Number(result.lastInsertRowid))).get()!
        notifyBoth(session)
        notify(toPlayerId, `${player.name} вызывает тебя на бой!`)
        res.status(201).json({ ok: true })
    })

    // --- ШАГ 2: принять приглашение → бой активен ---
    app.post("/pvp/:id/accept", (req: Request, res: Response) => {
        const player = (req as AuthedRequest).player;

        const session = db.select().from(pvpSessions).where(eq(pvpSessions.id, Number(req.params.id))).get();
        // принять может ТОЛЬКО player2 (получатель вызова)
        if (!session || session.player2Id !== player.id || session.status !== "pending") {
            return res.status(404).json({ error: "Приглашение не найдено" });
        }

        const p1 = db.select().from(players).where(eq(players.id, session.player1Id)).get()!;
        if (p1.health <= 0 || player.health <= 0) return res.status(409).json({ error: "Один из игроков мёртв" });

        // HP фиксируем на момент старта боя
        const updated: PvpSessionRow = {
            ...session,
            status: "active",
            player1Health: p1.health,
            player2Health: player.health,
            turn: "player1",
            lastActionAt: nowGameTime()
        };
        db.update(pvpSessions)
            .set({ status: "active", player1Health: p1.health, player2Health: player.health, turn: "player1", lastActionAt: updated.lastActionAt,})
            .where(eq(pvpSessions.id, session.id)).run();
        notifyBoth(updated);
        db.update(players).set({idTheLastAction:{id:session.id,type:'Fight'}}).where(eq(players.id,p1.id)).run()
        db.update(players).set({idTheLastAction:{id:session.id,type:'Fight'}}).where(eq(players.id,player.id)).run()
        res.json({ ok: true });
    });

    // --- Отклонить приглашение или сдаться в дуэли (любой участник) ---
    // Работает и для pending (отказ от вызова), и для active (сдача).
    // В активном бою вышедший проигрывает, соперник получает победу.
    app.delete("/pvp/:id", (req: Request, res: Response) => {
        const player = (req as AuthedRequest).player;
        const session = db.select().from(pvpSessions).where(eq(pvpSessions.id, Number(req.params.id))).get();
        if (!session || !myRole(session, player.id)) return res.status(404).json({ error: "Дуэль не найдена" });
        if (session.status === "finished") {
            clearPvpLastAction(session);
            return res.json({ ok: true, state: buildPvpState(session, player.id) });
        }

        const winnerId = player.id === session.player1Id ? session.player2Id : session.player1Id;
        const finished = finishPvpSession(session.id, winnerId);
        res.json({ ok: true, state: buildPvpState(finished, player.id) });
    })

    // --- ХОД: attack | flee | use (зелье) ---
    // Главная проверка перед действием: session.status === "active"
    // и turn === моя роль. Без этого можно было бы бить вне очереди.
    app.post("/pvp/:id/action", (req: Request, res: Response) => {
        const player = (req as AuthedRequest).player;
        const action: "attack" | "flee" | "use" = req.body?.action;

        const session = db.select().from(pvpSessions).where(eq(pvpSessions.id, Number(req.params.id))).get();
        const role = session ? myRole(session, player.id) : null;
        if (!session || !role || session.status !== "active") {
            return res.status(404).json({ error: "Активная дуэль не найдена" });
        }
        if (session.turn !== role) return res.status(409).json({ error: "Сейчас не ваш ход" });

        const now = nowGameTime();
        const log = combatSessionsLogs.get(session.id) ?? [];
        const opponentRole = role === "player1" ? "player2" : "player1";
        const me = db.select().from(players).where(eq(players.id, role === "player1" ? session.player1Id : session.player2Id)).get()!;
        const opp = db.select().from(players).where(eq(players.id, opponentRole === "player1" ? session.player1Id : session.player2Id)).get()!;

        let myHp = role === "player1" ? session.player1Health : session.player2Health;
        let oppHp = role === "player1" ? session.player2Health : session.player1Health;
        let finished = false, winnerId: number | null = null;

        if (action === "attack") {
            // урон считается так же, как в PvE (combat.ts), НО через
            // getPlayerStats — учитываются надетые оружие/броня обоих бойцов.
            // Формула: strength + rand(0..strength) - defense, минимум 1.
            const myStats = getPlayerStats(me);
            const oppStats = getPlayerStats(opp);

            const dmg = Math.max(1, myStats.strength + Math.floor(Math.random() * (myStats.strength + 1)) - oppStats.defense);
            oppHp = Math.max(0, oppHp - dmg);
            log.push({ text: `Вы нанесли ${dmg} урона ${opp.name}`, at: now });

            if (oppHp <= 0) {
                // HP противника упало до нуля → я победил
                finished = true
                winnerId = me.id
            } else {
                log.push({ text: `${opp.name}: ${oppHp}/${opp.maxHealth} HP`, at: now });
            }
        } else if (action === "flee") {
            // Побег = 50/50: удалось → поражение вышедшего; не удалось → ответный удар.
            if (Math.random() < 0.5) {
                finished = true;
                winnerId = opp.id;
                log.push({ text: "Вы убежали с дуэли", at: now });
            } else {
                const oppStats = getPlayerStats(opp);
                const dmg = Math.max(1, oppStats.strength - getPlayerStats(me).defense);
                myHp = Math.max(0, myHp - dmg);
                log.push({ text: `Побег не удался, вы получили ${dmg} урона`, at: now });
                if (myHp <= 0) { finished = true; winnerId = opp.id; }
            }
        } else if (action === "use") {
            // ЗЕЛЬЕ. Важно: выпить можно ТОЛЬКО в свой ход, и зелье
            // СЖИГАЕТ ход (ниже turn уйдёт сопернику) — иначе можно было бы
            // безнаказанно отхиливаться до бесконечности.
            const itemType = Number(req.body?.itemType);
            if (!Number.isInteger(itemType)) return res.status(400).json({ error: "itemType обязателен" });

            // стек предмета в инвентаре (у игрока максимум один стек на тип)
            const invRow = db.select().from(inventoryItems)
                .where(and(eq(inventoryItems.playerId, me.id), eq(inventoryItems.itemType, itemType)))
                .get();
            if (!invRow || invRow.quantity < 1) return res.status(400).json({ error: "Зелья нет в инвентаре" });

            const potion = db.select().from(items).where(eq(items.id, itemType)).get();
            if (!potion || potion.type !== "potion" || potion.healAmount <= 0) {
                return res.status(400).json({ error: "Это не зелье" });
            }

            // лечим HP СЕССИИ, а не players.health: во время дуэли источник
            // правды — сессия (HP зафиксирован при accept). Лечит и выше
            // максимума нельзя.
            const healed = Math.min(potion.healAmount, me.maxHealth - myHp);
            myHp = Math.min(me.maxHealth, myHp + potion.healAmount);
            log.push({ text: `Вы выпили ${potion.name}: +${healed} HP (${myHp}/${me.maxHealth})`, at: now });

            // списываем одну единицу (как usePotion в combat.ts)
            if (invRow.quantity - 1 <= 0) {
                db.delete(inventoryItems).where(eq(inventoryItems.id, invRow.id)).run();
            } else {
                db.update(inventoryItems)
                    .set({ quantity: invRow.quantity - 1 })
                    .where(eq(inventoryItems.id, invRow.id)).run();
            }
        } else {
            return res.status(400).json({ error: "action должен быть attack, flee или use" });
        }

        // собираем обновления по сторонам БД (player1/player2), а не "я/он"
        const patch = role === "player1"
            ? { player1Health: myHp, player2Health: oppHp }
            : { player1Health: oppHp, player2Health: myHp };

        if (!finished) {
            // ход переходит к противнику
            db.update(pvpSessions)
                .set({ ...patch, turn: opponentRole, lastActionAt: now,})
                .where(eq(pvpSessions.id, session.id)).run();
            combatSessionsLogs.set(session.id, log);
            notifyBoth({ ...session, ...patch, turn: opponentRole });
            return res.json({ ok: true, state: buildPvpState({ ...session, ...patch, turn: opponentRole }, player.id) });
        }

        const result = finishPvpSession(session.id, winnerId, patch);
        res.json({ ok: true, winnerId: result.winnerId, state: buildPvpState(result, player.id) });
    })
    
}

