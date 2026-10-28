import { assertOutsideParty, currentPartyMember } from '../group-events/participation.js';
import { GroupEventError } from '../group-events/availability.js';
import type { BattleFinishReason,BattleSide } from '@mmobot/shared';
import { PvpOverviewResponse,PvpStateDto } from "@mmobot/shared";
import { and,eq,or,sql } from "drizzle-orm";
import type { Express,Request,Response } from "express";
import { db } from "../../database/connection.js";
import type { PvpSessionRow } from "../../database/schema.js";
import { combatSessions,players,pvpSessions } from "../../database/schema.js";
import { emitToPlayer } from "../../infrastructure/realtime/socket-server.js";
import { notify } from "../../infrastructure/telegram/notifications.js";
import { nowGameTime,nowGameTimeMs } from "../../shared/time.js";
import type { AuthedRequest } from "../auth/auth.js";
import { assertOutsideCombat } from '../inventory/store.js';
import { addXpForPlayer } from "../players/level.js";
import { availableMove,createBattle,event,resolveRound } from './battle/engine.js';
import { consumePotion,preparePotion } from './battle/potions.js';
import { BattleError,checkRequest,parseBattleRequest,publicBattle,rememberRequest } from './battle/state.js';
import { playerFighter } from './battle/stats.js';

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

// Reward/progress rules are unchanged; callers publish only after the transaction commits.
function finishPvpSession(sessionId: number, winnerId: number | null, reason: BattleFinishReason = 'knockout'): PvpSessionRow {
    return db.transaction(() => {
        const current = db.select().from(pvpSessions).where(eq(pvpSessions.id, sessionId)).get();
        if (!current) throw new BattleError('Дуэль не найдена', 404);
        if (current.status === 'finished') return current;
        const winner = current.status === 'active' ? winnerId : null;
        if (winner !== null && winner !== current.player1Id && winner !== current.player2Id) throw new BattleError('Неверный победитель');
        const state = current.battleState;
        const finished = { ...current, status: 'finished' as const, winnerId: winner, battleState: state,
            stateVersion: current.stateVersion + 1, lastActionAt: nowGameTime() };
        if (winner === current.player1Id) finished.player2Health = 0;
        if (winner === current.player2Id) finished.player1Health = 0;
        if (state) {
            state.finishReason = reason;
            state.statuses = []; state.effects = [];
            event(state, current.roundNumber, 'finish', [finished.player1Health, finished.player2Health], nowGameTime(),
                reason === 'mutual_exit' ? 'Бой завершён по согласию обоих' : reason === 'inactivity' ? 'Бой завершён: оба участника бездействовали' : reason === 'timeout' ? 'Поражение за бездействие' : 'Бой завершён');
        }
        db.update(pvpSessions).set(finished).where(eq(pvpSessions.id, sessionId)).run();
        clearPvpLastAction(current);
        if (current.status === 'active') {
            for (const [id, health] of [[current.player1Id, finished.player1Health], [current.player2Id, finished.player2Health]])
                db.update(players).set({ health, lastRegenTime: nowGameTime() }).where(eq(players.id, id)).run();
        }
        if (winner !== null) {
            addXpForPlayer(winner, 10);
            db.update(players).set({ points: sql`${players.points} + 10` }).where(eq(players.id, winner)).run();
        }
        return finished;
    });
}
export function expireStalePvpSessions(): void {
    const cutoff = new Date(nowGameTimeMs() - STALE_PVP_MS).toISOString();
    const stale = db.select().from(pvpSessions).where(and(
        or(eq(pvpSessions.status, 'pending'), eq(pvpSessions.status, 'active')),
        sql`coalesce(${pvpSessions.roundStartedAt}, ${pvpSessions.lastActionAt}, ${pvpSessions.creadetAt}) <= ${cutoff}`
    )).all();
    for (const candidate of stale) {
        const result = db.transaction(() => {
            const row = db.select().from(pvpSessions).where(eq(pvpSessions.id, candidate.id)).get();
            if (!row || row.status === 'finished' || (row.roundStartedAt ?? row.lastActionAt ?? row.creadetAt) > cutoff) return null;
            const choices = row.battleState?.choices ?? [null, null];
            const winner = row.status === 'active' ? choices[0] ? row.player1Id : choices[1] ? row.player2Id : null : null;
            return finishPvpSession(row.id, winner, winner === null ? 'inactivity' : 'timeout');
        });
        if (result) notifyBoth(result);
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
// HP, доступность действия и журнал выдаются с учётом стороны смотрящего.
// HP в БД хранятся по сторонам (player1Health/player2Health),
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

    const side: BattleSide = role === 'player1' ? 0 : 1;
    return {
        ...publicBattle(pvp.battleState, pvp.roundNumber, pvp.stateVersion, pvp.roundStartedAt, side),
        exitRequested: pvp.battleState?.exitRequested[side] ?? false,
        partnerExitRequested: pvp.battleState?.exitRequested[side === 0 ? 1 : 0] ?? false,
        id: pvp.id,
        status: pvp.status,
        // player1 — тот, кто кинул вызов (outgoing); player2 — получатель (incoming)
        direction: role === "player1" ? "outgoing" : "incoming",
        myName: im.name,
        partnerName: partner.name,
        partnerAvatar: partner.avatar,
        myHp: role === "player1" ? pvp.player1Health : pvp.player2Health,
        myMaxHp: pvp.battleState?.fighters[side].maxHp ?? im.maxHealth,
        partnerMaxHp: pvp.battleState?.fighters[side === 0 ? 1 : 0].maxHp ?? partner.maxHealth,
        partnerHp: role === "player1" ? pvp.player2Health : pvp.player1Health,
        myTurn: pvp.status === "active" && !pvp.battleState?.choices[side],
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
        expireStalePvpSessions();
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

        if (currentPartyMember(db, player.id)) return res.status(409).json({ error: 'Сначала выйдите из группы', code: 'PARTY_EXIT_REQUIRED' });
        if (currentPartyMember(db, toPlayerId)) return res.status(409).json({ error: 'Этот игрок состоит в группе', code: 'PLAYER_BUSY' });
        const target = db.select().from(players).where(eq(players.id, toPlayerId)).get()
        if (!target) return res.status(404).json({ error: "Игрок не найден" })

        // оба должны быть живы (после поражения HP = 0, пока регенерация не поднимет)
        if (player.health <= 0 || target.health <= 0) return res.status(409).json({ error: "Один из игроков мёртв" })

        const inPve = db.select().from(combatSessions).where(and(eq(combatSessions.status, 'active'), or(eq(combatSessions.playerId, player.id), eq(combatSessions.playerId, toPlayerId)))).get();
        if (inPve || hasActivePvp(player.id) || hasActivePvp(toPlayerId)) return res.status(409).json({ error: "Один из игроков уже в бою" })

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

        try {
            const updated = db.transaction(() => {
                assertOutsideParty(db, player.id);
                if (currentPartyMember(db, p1.id)) throw new GroupEventError('Соперник состоит в группе', 'PLAYER_BUSY');
                assertOutsideCombat(db, p1.id); assertOutsideCombat(db, player.id);
                if (hasActivePvp(p1.id, session.id) || hasActivePvp(player.id, session.id)) throw new BattleError('Игрок уже занят');
                const now = nowGameTime();
                const row = { ...session, status: 'active' as const, player1Health: p1.health, player2Health: player.health,
                    roundStartedAt: now, lastActionAt: now, stateVersion: session.stateVersion + 1,
                    battleState: createBattle([playerFighter(p1), playerFighter(player)]) };
                db.update(pvpSessions).set(row).where(eq(pvpSessions.id, session.id)).run();
                for (const id of [p1.id, player.id]) db.update(players).set({ idTheLastAction: { id: session.id, type: 'Fight' } }).where(eq(players.id, id)).run();
                return row;
            });
            notifyBoth(updated);
            res.json({ ok: true, state: buildPvpState(updated, player.id) });
        } catch (error) { if (error instanceof Error) return res.status(409).json({ error: error.message, code: error instanceof GroupEventError ? error.code : undefined }); throw error; }
    });

    // Pending invitations can be cancelled; active battles require mutual exit consent.
    app.delete('/pvp/:id', (req: Request, res: Response) => {
        expireStalePvpSessions();
        const player = (req as AuthedRequest).player;
        const row = db.select().from(pvpSessions).where(eq(pvpSessions.id, Number(req.params.id))).get();
        if (!row || !myRole(row, player.id)) return res.status(404).json({ error: 'Дуэль не найдена' });
        if (row.status === 'active') return res.status(409).json({ error: 'Выход из дуэли требует согласия обоих игроков' });
        const result = row.status === 'pending' ? finishPvpSession(row.id, null, 'aborted') : row;
        notifyBoth(result);
        res.json({ ok: true, state: buildPvpState(result, player.id) });
    });

    function act(req: Request, res: Response, exit: boolean) {
        expireStalePvpSessions();
        const player = (req as AuthedRequest).player;
        try {
            const request = parseBattleRequest(req.body);
            if (request.sessionId !== Number(req.params.id)) throw new BattleError('Неверная сессия', 400);
            if (!exit && req.body.action !== 'attack' && req.body.action !== 'use') throw new BattleError('Предметы и случайный побег в дуэли недоступны', 400);
            if (exit && typeof req.body.requested !== 'boolean') throw new BattleError('Нужно указать согласие на выход', 400);
            const result = db.transaction(() => {
                const row = db.select().from(pvpSessions).where(eq(pvpSessions.id, request.sessionId)).get();
                const role = row && myRole(row, player.id);
                if (!row || !role) throw new BattleError('Дуэль не найдена', 404);
                const side: BattleSide = role === 'player1' ? 0 : 1;
                const state = structuredClone(row.battleState);
                if (!state) throw new BattleError('Обновите бой');
                const command = exit ? `exit:${req.body.requested}` : req.body.action === 'use' ? `use:${request.itemType}` : request.moveId ?? state.fighters[side].moves[0].id;
                if (checkRequest(state, player.id, request, command, row.roundNumber, row.stateVersion)) return row;
                if (row.status !== 'active') throw new BattleError('Бой завершён');
                if (exit) state.exitRequested[side] = req.body.requested;
                else {
                    if (state.choices[side]) throw new BattleError('Действие уже выбрано');
                    const selected = req.body.action === 'use' ? preparePotion(state, side, player.id, request.itemType, side === 0 ? row.player1Health : row.player2Health) : command;
                    const move = availableMove(state, side, selected, row.roundNumber);
                    if (req.body.action === 'attack' && move.itemType !== undefined) throw new BattleError('Используйте предмет через инвентарь', 400);
                    state.choices[side] = selected;
                }
                rememberRequest(state, player.id, request, command);
                let patch = { ...row, battleState: state, stateVersion: row.stateVersion + 1 };
                if (!exit) patch.lastActionAt = nowGameTime();
                if (state.exitRequested.every(Boolean)) {
                    db.update(pvpSessions).set(patch).where(eq(pvpSessions.id, row.id)).run();
                    return finishPvpSession(row.id, null, 'mutual_exit');
                }
                if (state.choices.every(Boolean)) {
                    const resolved = resolveRound(state, [row.player1Health, row.player2Health], row.roundNumber, nowGameTime());
                    for (const consumed of resolved.consumedItems) consumePotion(consumed.side === 0 ? row.player1Id : row.player2Id, consumed.itemType);
                    patch = { ...patch, battleState: resolved.state, player1Health: resolved.hp[0], player2Health: resolved.hp[1] };
                    if (resolved.finished) {
                        db.update(pvpSessions).set(patch).where(eq(pvpSessions.id, row.id)).run();
                        return finishPvpSession(row.id, resolved.winner === null ? null : resolved.winner === 0 ? row.player1Id : row.player2Id);
                    }
                    patch.roundNumber++;
                    patch.roundStartedAt = nowGameTime();
                }
                db.update(pvpSessions).set(patch).where(eq(pvpSessions.id, row.id)).run();
                return patch;
            });
            notifyBoth(result);
            res.json({ ok: true, state: buildPvpState(result, player.id) });
        } catch (error) {
            if (error instanceof BattleError) return res.status(error.status).json({ error: error.message });
            throw error;
        }
    }
    app.post('/pvp/:id/action', (req, res) => act(req, res, false));
    app.post('/pvp/:id/exit-request', (req, res) => act(req, res, true));
}
