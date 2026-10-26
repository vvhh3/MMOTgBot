import type { CombatStateResponse,ItemDto } from "@mmobot/shared";
import { TUTORIAL_MOB_ID,TUTORIAL_REWARD_KEY } from "@mmobot/shared";
import { and,eq,lt,sql } from "drizzle-orm";
import { db } from "../../database/connection.js";
import { toItemDto,toMobDto,toPlayerDto } from "../../database/mappers.js";
import type { CombatSessionRow,MobRow,PlayerRow } from "../../database/schema.js";
import { combatSessions,events,inventoryItems,items,players } from "../../database/schema.js";
import { nowGameTime,nowGameTimeMs } from "../../shared/time.js";
import { grantItems } from "../inventory/store.js";
import { movePlayer } from "../locations/presence.js";
import { addXpForPlayer } from "../players/level.js";
import { progressQuests } from "../quests/routes.js";
import { consumePotion,preparePotion } from './battle/potions.js';
import { rollLoot } from "./loot.js";

import type { BattleRequest,BattleState } from '@mmobot/shared';
import { randomUUID } from 'node:crypto';
import { assertOutsideCombat } from '../inventory/store.js';
import { createBattle,event,resolveRound } from './battle/engine.js';
import { BattleError,checkRequest,parseBattleRequest,publicBattle,rememberRequest } from './battle/state.js';
import { getEquippedItems,mobFighter,playerFighter } from './battle/stats.js';
import { chooseMobMove,scaleMob } from '../mobs/balance.js';

export const STALE_SESSION_MS = 5 * 60 * 1000;

function clearCombatAction(playerId: number, sessionId: number) {
    const p = db.select().from(players).where(eq(players.id, playerId)).get();
    if (p?.idTheLastAction?.type === 'TakeAWalk' && p.idTheLastAction.id === sessionId)
        db.update(players).set({ idTheLastAction: null }).where(eq(players.id, playerId)).run();
}
export function expireStaleCombatSessions(): void {
    const cutoff = new Date(nowGameTimeMs() - STALE_SESSION_MS).toISOString();
    const stale = db.select().from(combatSessions).where(and(eq(combatSessions.status, 'active'), lt(combatSessions.lastActionAt, cutoff))).all();
    for (const candidate of stale) db.transaction(() => {
        const session = db.select().from(combatSessions).where(eq(combatSessions.id, candidate.id)).get();
        if (!session || session.status !== 'active' || session.lastActionAt >= cutoff) return;
        const state = session.battleState;
        if (state) {
            state.finishReason = 'aborted';
            event(state, session.roundNumber, 'finish', [session.playerHealth, session.mobHealth], nowGameTime(), 'Бой прекращён из-за бездействия');
        }
        db.update(combatSessions).set({ status: 'aborted', battleState: state, stateVersion: session.stateVersion + 1, lastActionAt: nowGameTime() }).where(eq(combatSessions.id, session.id)).run();
        clearCombatAction(session.playerId, session.id);
    });
}
export function startCombat(player: PlayerRow, mob: MobRow): CombatStateResponse {
    const session = db.transaction(() => {
        assertOutsideCombat(db, player.id);
        if (!mob.isActive) throw new BattleError('Противник больше не встречается', 409);
        if (player.health <= 0) throw new BattleError('Восстановите здоровье перед боем', 409);
        const encounter = scaleMob(mob, player.level, db.select().from(items).all());
        const now = nowGameTime();
        const state = createBattle([playerFighter(player), mobFighter(encounter.mob)]);
        state.encounter = { level: encounter.mob.level, rank: encounter.rank, locationId: mob.locationId,
            pointsReward: encounter.mob.pointsReward, coinReward: encounter.mob.coinReward, loot: structuredClone(encounter.mob.loot) };
        // Mob commits before the player's hidden choice is received.
        state.choices[1] = chooseMobMove(state, 1);
        const row = db.insert(combatSessions).values({ playerId: player.id, mobId: mob.id, playerHealth: player.health,
            mobHealth: encounter.mob.maxHealth, status: 'active', startedAt: now, lastActionAt: now,
            roundStartedAt: now, battleState: state }).returning().get();
        db.update(players).set({ idTheLastAction: { id: row.id, type: 'TakeAWalk' } }).where(eq(players.id, player.id)).run();
        return row;
    });
    return getCombatState(player, session, mob);
}
export function moveCombatAction(player: PlayerRow, mob: MobRow, session: CombatSessionRow, action: 'attack' | 'flee' | 'use', input?: BattleRequest): CombatStateResponse {
    let changed = false;
    const result = db.transaction(() => {
        const current = db.select().from(combatSessions).where(and(eq(combatSessions.id, session.id), eq(combatSessions.playerId, player.id))).get();
        if (!current || current.mobId !== mob.id) throw new BattleError('Бой не найден', 404);
        const state: BattleState = structuredClone(current.battleState ?? createBattle([playerFighter(player), mobFighter(mob)]));
        const request = input ? parseBattleRequest(input) : { sessionId: current.id, round: current.roundNumber, expectedVersion: current.stateVersion, requestId: randomUUID() };
        if (request.sessionId !== current.id) throw new BattleError('Чужая сессия');
        const moveId = request.moveId ?? state.fighters[0].moves[0].id;
        const command = action === 'use' ? `use:${request.itemType}` : action === 'flee' ? 'flee' : moveId;
        if (checkRequest(state, player.id, request, command, current.roundNumber, current.stateVersion)) return getCombatState(player, current, mob);
        if (current.status !== 'active') throw new BattleError('Бой уже завершён');
        const now = nowGameTime();
        let hp: [number, number] = [current.playerHealth, current.mobHealth];
        let status: CombatSessionRow['status'] = 'active';
        let next = state;
        if (action === 'flee') {
            if (Math.random() < .5) {
                status = 'fled'; state.finishReason = 'fled';
                event(state, current.roundNumber, 'flee', hp, now, 'Вы убежали с поля боя', 0);
            } else {
                hp[0] = Math.max(0, hp[0] - Math.max(1, state.fighters[1].strength - state.fighters[0].defense));
                event(state, current.roundNumber, 'flee', hp, now, 'Побег не удался, моб наносит удар', 1);
                if (!hp[0]) { status = 'defeat'; state.finishReason = 'knockout'; }
            }
        } else {
            const selected = action === 'use' ? preparePotion(state, 0, player.id, request.itemType, hp[0]) : moveId;
            if (action === 'attack' && state.fighters[0].moves.find(m => m.id === selected)?.itemType !== undefined) throw new BattleError('Используйте предмет через инвентарь', 400);
            state.choices = [selected, state.choices[1] ?? chooseMobMove(state, current.roundNumber)];
            const resolved = resolveRound(state, hp, current.roundNumber, now);
            for (const consumed of resolved.consumedItems) consumePotion(player.id, consumed.itemType);
            next = resolved.state; hp = resolved.hp;
            if (resolved.finished) status = resolved.winner === 0 ? 'victory' : 'defeat';
        }
        rememberRequest(next, player.id, request, command);
        const roundNumber = current.roundNumber + (status === 'active' ? 1 : 0);
        if (status === 'active') next.choices = [null, chooseMobMove(next, roundNumber)];
        const updated = { ...current, playerHealth: hp[0], mobHealth: hp[1], status, battleState: next,
            roundNumber, roundStartedAt: now, stateVersion: current.stateVersion + 1, lastActionAt: now };
        db.update(combatSessions).set(updated).where(eq(combatSessions.id, current.id)).run();
        db.update(players).set({ health: hp[0], lastRegenTime: now }).where(eq(players.id, player.id)).run();
        if (status !== 'active') {
            clearCombatAction(player.id, current.id);
            next.droppedItems = endCombatSession(status, player, encounterMob(mob, next), current.id);
            db.update(combatSessions).set({ battleState: next }).where(eq(combatSessions.id, current.id)).run();
        }
        changed = true;
        return getCombatState(player, updated, mob);
    });
    if (changed && result.status === 'defeat') movePlayer(toPlayerDto({ ...player, currentLocationId: 'square' }), 'square');
    return result;
}
export function usePotion(player: PlayerRow, itemType: number, session: CombatSessionRow, mob: MobRow, input?: BattleRequest) {
    return moveCombatAction(player, mob, session, 'use', { sessionId: session.id, round: session.roundNumber, expectedVersion: session.stateVersion, requestId: randomUUID(), ...input, itemType });
}
export function getCombatState(player: PlayerRow, session: CombatSessionRow, mob: MobRow): CombatStateResponse {
    const state = session.battleState;
    return { ...publicBattle(state, session.roundNumber, session.stateVersion, session.roundStartedAt, 0),
        id: session.id, mob: { ...toMobDto(encounterMob(mob, state)), rank: state?.encounter?.rank }, playerHp: session.playerHealth,
        playerMaxHp: state?.fighters[0].maxHp ?? player.maxHealth, mobHp: session.mobHealth,
        mobMaxHp: state?.fighters[1].maxHp ?? mob.maxHealth, status: session.status,
        droppedItems: state?.droppedItems ?? [], log: state?.events.map(e => ({ text: e.text, at: e.at })) ?? [] };
}
function encounterMob(mob: MobRow, state: BattleState | null): MobRow {
    if (!state) return mob;
    return { ...mob, ...state.encounter, name: state.fighters[1].name,
        maxHealth: state.fighters[1].maxHp, strength: state.fighters[1].strength, defense: state.fighters[1].defense };
}
function endCombatSession(status: "victory" | "defeat" | "fled" | "aborted", player: PlayerRow, mob: MobRow, sessionId: number): ItemDto[] {
    const now = nowGameTime();
    const droppedItems: ItemDto[] = [];

    if (status === "victory") {
        if (mob.id === TUTORIAL_MOB_ID) {
            const fresh = db.select().from(players).where(eq(players.id, player.id)).get()!;
            if (fresh.tutorialStep !== "battle") throw new BattleError("Награда обучения уже получена", 409);
            const reward = db.select().from(items).where(eq(items.catalogKey, TUTORIAL_REWARD_KEY)).get();
            if (!reward || reward.type !== "weapon") throw new BattleError("Награда обучения недоступна", 409);
            grantItems(db, player.id, reward.id, 1, now);
            droppedItems.push(toItemDto(reward));
            db.update(players).set({ tutorialStep: "equip" }).where(eq(players.id, player.id)).run();
        }
        // Один розыгрыш при победе. Выдача, квесты и завершение боя — в транзакции хода.
        for (const item of rollLoot(mob.loot)) {
            grantItems(db, player.id, item, 1, now);
            droppedItems.push(toItemDto(db.select().from(items).where(eq(items.id, item)).get()!));
            progressQuests(player.id, "collect", item);
            progressQuests(player.id, "loot", item);
        }

        addXpForPlayer(player.id, mob.pointsReward) // добавить опыт
        db.update(players)
            .set({
                points: sql`${players.points} + ${mob.pointsReward}`,
                money: sql`${players.money} + ${mob.coinReward}`
            })
            .where(eq(players.id, player.id))
            .run();

        progressQuests(player.id, "kill", mob.id)

        db.insert(events)
            .values({ playerId: player.id, locationId: mob.locationId, type: "kill", createdAt: now })
            .run();

    } else if (status === "defeat") {

        db.update(players)
            .set({
                health: 0,
                currentLocationId: "square",
                lastSeenAt: now
            })
            .where(eq(players.id, player.id))
            .run();

        db.insert(events)
            .values({ playerId: player.id, locationId: mob.locationId, type: "death", createdAt: now })
            .run();

    }

    return droppedItems;
}


export function isMobAlive(mob: MobRow): boolean {
    return mob.isActive;
}

export const getPlayerStats = (player: PlayerRow) => {

    const catalog = getEquippedItems(player)

    return {
        strength: player.strength + catalog.reduce((acc, item) => acc + item.damage, 0),
        defense: player.defense + catalog.reduce((acc, item) => acc + item.defense, 0)
    }
}
