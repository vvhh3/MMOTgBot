import { toPlayerDtoEquipped, toInventoryItemDto } from '../../database/mappers.js';
import { eq } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { eventPartyMembers, players, inventoryItems } from '../../database/schema.js';
import { emitToPlayer } from '../../infrastructure/realtime/socket-server.js';
import { groupOverview } from './state.js';

export function publishGroup(partyId: number) {
  const members = db.select().from(eventPartyMembers).where(eq(eventPartyMembers.partyId, partyId)).all();
  for (const playerId of new Set(members.map(m => m.playerId))) {
    emitToPlayer(playerId, 'groupEventUpdate', groupOverview(playerId));
    const player = db.select().from(players).where(eq(players.id, playerId)).get();
    if (player) emitToPlayer(playerId, 'player', toPlayerDtoEquipped(player));
    emitToPlayer(playerId, 'inventory', db.select().from(inventoryItems).where(eq(inventoryItems.playerId, playerId)).all().map(toInventoryItemDto));
  }
}
