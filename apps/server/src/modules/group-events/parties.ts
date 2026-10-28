import { and, eq, inArray, ne, or } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { casinoSessions, eventParties, eventPartyMembers, friendships, players, trades, type EventPartyRow } from '../../database/schema.js';
import { nowGameTime } from '../../shared/time.js';
import { assertOutsideCombat } from '../inventory/store.js';
import { isPlayerOnline } from '../../infrastructure/realtime/socket-server.js';
import { afterGameTime, GroupEventError, requireWindow, requestKey, positiveInt } from './availability.js';
import { currentPartyMember } from './participation.js';

export function resetPartyReady(partyId: number) {
  db.update(eventPartyMembers).set({ ready: false }).where(eq(eventPartyMembers.partyId, partyId)).run();
}
export function touchParty(party: EventPartyRow) {
  db.update(eventParties).set({ version: party.version + 1, updatedAt: nowGameTime(), processedRequests: party.processedRequests }).where(eq(eventParties.id, party.id)).run();
}
export function partyCommand(party: EventPartyRow, playerId: number, key: unknown, command: unknown): boolean {
  const requestId = requestKey(key), fingerprint = JSON.stringify(command);
  const old = party.processedRequests.find(r => r.playerId === playerId && r.requestId === requestId);
  if (old) {
    if (old.fingerprint !== fingerprint) throw new GroupEventError('Этот ID запроса уже использован');
    return true;
  }
  party.processedRequests.push({ playerId, requestId, fingerprint });
  return false;
}
export function assertPlayerFree(playerId: number, ownParty?: number) {
  const p = db.select().from(players).where(eq(players.id, playerId)).get();
  if (!p || !p.isCreated || p.tutorialStep !== 'done' || p.health <= 0) throw new GroupEventError('Игрок должен завершить обучение и восстановить здоровье');
  const membership = currentPartyMember(db, playerId);
  if (membership && membership.party.id !== ownParty) throw new GroupEventError('Игрок уже состоит в группе');
  assertOutsideCombat(db, playerId);
  if (p.idTheLastAction && !(p.idTheLastAction.type === 'GroupEventLobby' && p.idTheLastAction.id === ownParty)) throw new GroupEventError('Игрок занят другим действием');
  const trade = db.select().from(trades).where(and(eq(trades.status, 'open'), or(eq(trades.fromPlayerId, playerId), eq(trades.toPlayerId, playerId)))).get();
  const casino = db.select().from(casinoSessions).where(and(eq(casinoSessions.playerId, playerId), eq(casinoSessions.status, 'active'))).get();
  if (trade || casino) throw new GroupEventError('Игрок занят другим действием');
  return p;
}
function checkFriend(from: number, target: number) {
  if (from === target || !db.select().from(friendships).where(and(eq(friendships.status, 'accepted'),
    or(and(eq(friendships.fromId, from), eq(friendships.toId, target)), and(eq(friendships.fromId, target), eq(friendships.toId, from))))).get())
    throw new GroupEventError('Пригласить можно только своего друга', 'FRIEND_REQUIRED');
}
function invite(party: EventPartyRow, from: number, target: number, requestedSlot?: unknown) {
  const window = requireWindow(party.eventWindowId);
  checkFriend(from, target);
  const p = assertPlayerFree(target);
  if (p.currentLocationId !== 'square' || !isPlayerOnline(target) || p.level < window.minLevel) throw new GroupEventError('Друг должен быть в сети, на Площади и подходить по уровню');
  const members = db.select().from(eventPartyMembers).where(and(eq(eventPartyMembers.partyId, party.id), inArray(eventPartyMembers.status, ['invited','joined','active']))).all();
  if (members.some(m => m.playerId === target)) throw new GroupEventError('Друг уже приглашён или состоит в группе');
  if (requestedSlot !== undefined && ![0,1,2].includes(requestedSlot as number)) throw new GroupEventError('Некорректное место');
  const slot = (requestedSlot === undefined ? [0,1,2] : [Number(requestedSlot)]).find(n => !members.some(m => m.slot === n));
  if (slot === undefined) throw new GroupEventError('В группе нет свободных мест', 'PARTY_FULL');
  db.insert(eventPartyMembers).values({ partyId: party.id, playerId: target, invitedByPlayerId: from, slot,
    status: 'invited', createdAt: nowGameTime(), inviteExpiresAt: afterGameTime(2 * 60000) }).run();
  resetPartyReady(party.id);
}
export function createParty(playerId: number, windowId: number, targetId: number, key: unknown, slot?: unknown) {
  return db.transaction(() => {
    const requestId = requestKey(key), fingerprint = JSON.stringify([windowId, targetId, slot]);
    const old = db.select().from(eventParties).where(and(eq(eventParties.leaderPlayerId, playerId), eq(eventParties.creationRequestId, requestId))).get();
    if (old) { if (old.creationFingerprint !== fingerprint) throw new GroupEventError('Этот ID запроса уже использован'); return old.id; }
    const window = requireWindow(windowId), p = assertPlayerFree(playerId);
    if (p.currentLocationId !== 'square' || p.level < window.minLevel || !isPlayerOnline(playerId)) throw new GroupEventError('Для сбора группы перейдите на Площадь и проверьте уровень');
    const party = db.insert(eventParties).values({ eventWindowId: window.id, leaderPlayerId: playerId,
      creationRequestId: requestId, creationFingerprint: fingerprint, createdAt: nowGameTime(), updatedAt: nowGameTime(), expiresAt: afterGameTime(10 * 60000) }).returning().get();
    db.insert(eventPartyMembers).values({ partyId: party.id, playerId, slot: 0, status: 'joined', createdAt: nowGameTime(), joinedAt: nowGameTime() }).run();
    invite(party, playerId, targetId, slot);
    db.update(players).set({ idTheLastAction: { type: 'GroupEventLobby', id: party.id } }).where(eq(players.id, playerId)).run();
    return party.id;
  });
}
export function mutateParty(playerId: number, partyId: number, action: 'invite' | 'respond' | 'ready' | 'leave' | 'remove', body: Record<string, unknown>) {
  return db.transaction(() => {
    const party = db.select().from(eventParties).where(eq(eventParties.id, partyId)).get();
    if (!party) throw new GroupEventError('Группа не найдена', 'PARTY_NOT_FOUND', 404);
    const me = db.select().from(eventPartyMembers).where(and(eq(eventPartyMembers.partyId, partyId), eq(eventPartyMembers.playerId, playerId)))
      .all().find(m => ['joined','active','invited'].includes(m.status));
    const historical = db.select().from(eventPartyMembers).where(and(eq(eventPartyMembers.partyId, partyId), eq(eventPartyMembers.playerId, playerId))).get();
    if (!historical) throw new GroupEventError('Группа не найдена', 'PARTY_NOT_FOUND', 404);
    if (partyCommand(party, playerId, body.requestId, [action, body.targetId, body.memberId, body.accept, body.ready, body.slot])) return partyId;
    if (party.status !== 'forming' || !me) throw new GroupEventError('Состав группы изменился. Обновите состояние', 'PARTY_CHANGED');
    if (action !== 'leave' && action !== 'remove') requireWindow(party.eventWindowId);
    if (action === 'respond') {
      if (me.status !== 'invited' || !me.inviteExpiresAt || me.inviteExpiresAt <= nowGameTime() || typeof body.accept !== 'boolean') throw new GroupEventError('Приглашение недействительно');
      if (body.accept) {
        checkFriend(me.invitedByPlayerId!, playerId);
        const p = assertPlayerFree(playerId);
        if (p.currentLocationId !== 'square' || !isPlayerOnline(playerId) || p.level < requireWindow(party.eventWindowId).minLevel) throw new GroupEventError('Для вступления перейдите на Площадь и проверьте уровень');
        const otherInvites = db.select().from(eventPartyMembers).where(and(eq(eventPartyMembers.playerId, playerId), eq(eventPartyMembers.status, 'invited'), ne(eventPartyMembers.id, me.id))).all();
        db.update(eventPartyMembers).set({ status: 'cancelled', endedAt: nowGameTime() }).where(and(eq(eventPartyMembers.playerId, playerId), eq(eventPartyMembers.status, 'invited'), ne(eventPartyMembers.id, me.id))).run();
        for (const other of otherInvites) {
          resetPartyReady(other.partyId);
          const otherParty = db.select().from(eventParties).where(eq(eventParties.id, other.partyId)).get();
          if (otherParty) touchParty(otherParty);
        }
        db.update(players).set({ idTheLastAction: { type: 'GroupEventLobby', id: partyId } }).where(eq(players.id, playerId)).run();
      }
      db.update(eventPartyMembers).set({ status: body.accept ? 'joined' : 'declined', joinedAt: body.accept ? nowGameTime() : null }).where(eq(eventPartyMembers.id, me.id)).run();
      resetPartyReady(partyId);
    } else {
      if (me.status !== 'joined') throw new GroupEventError('Сначала примите приглашение');
      if (action === 'invite') {
        const p = assertPlayerFree(playerId, partyId);
        if (p.currentLocationId !== 'square' || p.level < requireWindow(party.eventWindowId).minLevel) throw new GroupEventError('Для приглашения перейдите на Площадь и проверьте уровень');
        invite(party, playerId, positiveInt(body.targetId), body.slot);
      }
      else if (action === 'ready') {
        if (typeof body.ready !== 'boolean') throw new GroupEventError('Некорректная готовность', 'INVALID_REQUEST', 400);
        assertPlayerFree(playerId, partyId);
        db.update(eventPartyMembers).set({ ready: body.ready }).where(eq(eventPartyMembers.id, me.id)).run();
      } else {
        const member = action === 'leave' ? me : db.select().from(eventPartyMembers).where(and(eq(eventPartyMembers.id, positiveInt(body.memberId)), eq(eventPartyMembers.partyId, partyId))).get();
        if (!member || (action === 'remove' && party.leaderPlayerId !== playerId && !(member.status === 'invited' && member.invitedByPlayerId === playerId))) throw new GroupEventError('Недостаточно прав', 'FORBIDDEN', 403);
        if (member.playerId === party.leaderPlayerId) closeParty(partyId, 'disbanded');
        else {
          db.update(eventPartyMembers).set({ status: member.status === 'invited' ? 'cancelled' : 'left', ready: false, endedAt: nowGameTime() }).where(eq(eventPartyMembers.id, member.id)).run();
          db.update(eventPartyMembers).set({ status: 'cancelled', endedAt: nowGameTime() }).where(and(eq(eventPartyMembers.partyId, partyId), eq(eventPartyMembers.invitedByPlayerId, member.playerId), eq(eventPartyMembers.status, 'invited'))).run();
          clearGroupAction(member.playerId, partyId, 'GroupEventLobby'); resetPartyReady(partyId);
        }
      }
    }
    touchParty(party);
    return partyId;
  });
}
export function clearGroupAction(playerId: number, id: number, type: 'GroupEventLobby' | 'GroupEvent') {
  const p = db.select().from(players).where(eq(players.id, playerId)).get();
  if (p?.idTheLastAction?.type === type && p.idTheLastAction.id === id) db.update(players).set({ idTheLastAction: null }).where(eq(players.id, playerId)).run();
}
export function closeParty(partyId: number, status: 'expired' | 'disbanded') {
  const members = db.select().from(eventPartyMembers).where(eq(eventPartyMembers.partyId, partyId)).all();
  for (const m of members) clearGroupAction(m.playerId, partyId, 'GroupEventLobby');
  db.update(eventPartyMembers).set({ status: 'expired', ready: false, endedAt: nowGameTime() }).where(and(eq(eventPartyMembers.partyId, partyId), inArray(eventPartyMembers.status, ['joined','invited']))).run();
  db.update(eventParties).set({ status, updatedAt: nowGameTime() }).where(eq(eventParties.id, partyId)).run();
}

// Called inside equipment/stat transactions; publication happens after commit.
export function invalidatePartyReady(playerId: number): number | null {
  const membership = currentPartyMember(db, playerId);
  if (!membership || membership.party.status !== 'forming') return null;
  resetPartyReady(membership.party.id); touchParty(membership.party);
  return membership.party.id;
}
