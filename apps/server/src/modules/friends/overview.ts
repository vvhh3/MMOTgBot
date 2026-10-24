import type { FriendDto,FriendsOverviewResponse } from "@mmobot/shared";
import { eq,inArray,or } from "drizzle-orm";
import { friendships,players } from "../../database/schema.js";
import { isPlayerOnline } from "../../infrastructure/realtime/socket-server.js";

import { db } from "../../database/connection.js";

export function toFriendDto(p: { id: number; friendId: number; name: string; level: number }): FriendDto {
    return { 
      id: p.id, 
      friendId: p.friendId,
      name: p.name, 
      level: p.level,
       online: isPlayerOnline(p.id) 
      }
}

// Собирает полный обзор друзей игрока: принятые друзья + ожидающие заявки
// (входящие/исходящие). Онлайн каждого друга вычисляется через isPlayerOnline.
export function buildFriendsOverview(playerId: number): FriendsOverviewResponse {
  const rows = db.select().from(friendships)
    .where(or(eq(friendships.fromId, playerId), eq(friendships.toId, playerId)))
    .all();
  const accepted = rows.filter((r) => r.status === "accepted");
  const pending = rows.filter((r) => r.status === "pending");

  const friendIds = accepted.map((r) => (r.fromId === playerId ? r.toId : r.fromId));
  const friendRows = friendIds.length
    ? db.select({ id: players.id, friendId: players.friendId, name: players.name, level: players.level })
        .from(players).where(inArray(players.id, friendIds)).all()
    : [];
  const friends: FriendDto[] = friendRows.map((p) => toFriendDto(p));

  const requests = pending.map((r) => {
    const otherId = r.fromId === playerId ? r.toId : r.fromId;
    const other = db.select({ id: players.id, name: players.name, level: players.level })
      .from(players).where(eq(players.id, otherId)).get();
    return {
      id: r.id,
      playerId: other?.id ?? 0,
      name: other?.name ?? "?",
      level: other?.level ?? 1,
      direction: (r.fromId === playerId ? "outgoing" : "incoming") as "incoming" | "outgoing"
    };
  });

  return { friends, requests };
}

