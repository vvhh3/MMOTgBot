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
//   finished — бой завершён (победа/ничья/отмена); winnerId = null → ничья

import type { Express, Request, Response } from "express"
import type { AuthedRequest } from "./auth.js"
import { inventoryItems, items, players, pvpSessions } from "./db/schema.js";
import type { PvpSessionRow } from "./db/schema.js";
import { emitToPlayer } from "./realTime.js";
import { CombatLogEntry, PvpStateDto, PvpOverviewResponse } from "@mmobot/shared";
import { db } from "./db.js";
import { eq, sql, and, or, lt } from "drizzle-orm"
import { notify } from "./notification.js";
import { getPlayerStats } from "./combat.js";
import { addXpForPlayer } from "./level.js";
import { nowGameTime, nowGameTimeMs } from "./time.js";

// дуэль считается заброшенной, если никто не ходил дольше этого времени (10 минут)
export const STALE_PVP_MS = 10 * 60 * 1000;

// лог дуэли по сессиям (хранится в памяти, в БД его нет —
// как combatSessionsLogs в combat.ts; сбрасывается при перезапуске сервера)
const combatSessionsLogs = new Map<number, CombatLogEntry[]>();

// Завершает зависшие дуэли (игрок принял вызов и закрыл приложение / ушёл).
// Без этого сессия навсегда блокирует обоим участникам новые дуэли
// (см. hasActivePvp). winnerId = null → ничья, наказаний нет.
// Вызывается при старте сервера и по таймеру из maintenance.ts.
export function expireStalePvpSessions(): void {
  const cutoff = new Date(nowGameTimeMs() - STALE_PVP_MS).toISOString();
  const stale = db.select().from(pvpSessions)
    .where(and(
      or(eq(pvpSessions.status, "pending"), eq(pvpSessions.status, "active")),
      lt(pvpSessions.lastActionAt, cutoff)
    ))
    .all();

  for (const session of stale) {
    db.update(pvpSessions)
      .set({ status: "finished", winnerId: null })
      .where(eq(pvpSessions.id, session.id))
      .run();
    combatSessionsLogs.delete(session.id);
    notifyBoth({ ...session, status: "finished", winnerId: null });
  }

  if (stale.length > 0) {
    console.log(`[pvp] expired ${stale.length} stale session(s)`);
  }
}

// Отправляет обоим участникам свежее состояние их дуэли через сокет.
// Вызывается после КАЖДОГО изменения сессии, чтобы клиенту не нужен был поллинг.
// Каждый получит свою версию DTO (со своей стороны).
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
// isWon: null = бой не завершён ИЛИ ничья; true/false — только для
// завершённой дуэли с определённым победителем.
function buildPvpState(pvp: PvpSessionRow, playerId: number): PvpStateDto | null {
    const role = myRole(pvp, playerId);
    if (!role) return null;

    // имя партнёра — для заголовка окна ("Дуэль с Иваном")
    const partnerId = role === "player1" ? pvp.player2Id : pvp.player1Id
    const myId = role === "player1" ? pvp.player1Id : pvp.player2Id

    const im = db.select({ name: players.name, maxHealth: players.maxHealth }).from(players).where(eq(players.id, myId)).get();
    const partner = db.select({ name: players.name, maxHealth: players.maxHealth }).from(players).where(eq(players.id, partnerId)).get();

    if (!im || !partner) return null

    return {
        id: pvp.id,
        status: pvp.status,
        myName: im.name,
        partnerName: partner.name,
        myHp: role === "player1" ? pvp.player1Health : pvp.player2Health,
        myMaxHp: im.maxHealth,
        partnerMaxHp: partner.maxHealth,
        partnerHp: role === "player1" ? pvp.player2Health : pvp.player1Health,
        myTurn: pvp.turn === role,
        finished: pvp.status === "finished",
        isWon: pvp.status !== "finished" || pvp.winnerId === null ? null : pvp.winnerId === myId
    }
}


export const createPvpRoutes = (app: Express) => {

    // Антифарм/антиспам: минимальная пауза между вызовами одного игрока.
    // Вызов шлёт socket + Telegram-уведомление — без кулдауна можно
    // завалить жертву сотнями приглашений и уведомлений.
    const PVP_INVITE_COOLDOWN_MS = 15 * 1000;
    const lastInviteAt = new Map<number, number>();

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
            lastActionAt: nowGameTime()
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
            .set({ status: "active", player1Health: p1.health, player2Health: player.health, turn: "player1", lastActionAt: updated.lastActionAt })
            .where(eq(pvpSessions.id, session.id)).run();
        notifyBoth(updated);
        res.json({ ok: true });
    });

    // --- Отклонить приглашение или отменить дуэль (любой участник) ---
    // Работает и для pending (отказ от вызова), и для active (сдача).
    // winnerId = null → в DTO обоих придёт isWon: null ("ничья").
    app.delete("/pvp/:id", (req: Request, res: Response) => {
        const player = (req as AuthedRequest).player;
        const session = db.select().from(pvpSessions).where(eq(pvpSessions.id, Number(req.params.id))).get();
        if (!session || !myRole(session, player.id)) return res.status(404).json({ error: "Дуэль не найдена" });
        if (session.status === "finished") return res.status(409).json({ error: "Дуэль уже завершена" });

        db.update(pvpSessions).set({ status: "finished", winnerId: null }).where(eq(pvpSessions.id, session.id)).run();
        combatSessionsLogs.delete(session.id);
        notifyBoth({ ...session, status: "finished", winnerId: null });
        res.json({ ok: true });
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
            // побег = 50/50: удалось → ничья; не удалось → пропущенный удар
            if (Math.random() < 0.5) {
                finished = true;                       // сбежал → ничья
                winnerId = null;
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
                .set({ ...patch, turn: opponentRole, lastActionAt: now })
                .where(eq(pvpSessions.id, session.id)).run();
            combatSessionsLogs.set(session.id, log);
            notifyBoth({ ...session, ...patch, turn: opponentRole });
            return res.json({ ok: true });
        }

        // === ДУЭЛЬ ЗАВЕРШЕНА ===
        // winnerId: id победителя | null (ничья — оба сбежали/отменили)
        db.update(pvpSessions)
            .set({ ...patch, status: "finished", winnerId, lastActionAt: now })
            .where(eq(pvpSessions.id, session.id)).run();

        // проигравший = тот из сторон БД, кто НЕ победитель (при ничьей его нет)
        const loserId = winnerId === null ? null : (winnerId === session.player1Id ? session.player2Id : session.player1Id);

        if (winnerId !== null) {
            // награда победителю: +10 XP и +10 очков в лидерборд
            addXpForPlayer(winnerId, 10);
            db.update(players).set({ points: sql`${players.points} + 10` }).where(eq(players.id, winnerId)).run();
        }
        if (loserId !== null) {
            // HP проигравшего = 0; дальше поднимется регенерацией (regen.ts).
            // Телепорт на "square" НЕ делаем — отличие от PvE-поражения.
            db.update(players).set({ health: 0 }).where(eq(players.id, loserId)).run();
        }

        notifyBoth({ ...session, ...patch, status: "finished", winnerId });
        res.json({ ok: true, winnerId });

        // лог больше не нужен — освобождаем память
        combatSessionsLogs.delete(session.id);
    })
}
