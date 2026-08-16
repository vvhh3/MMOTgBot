import { desc, eq } from "drizzle-orm";
import type { LocationStateResponse } from "@mmobot/shared";
import { db, toEventDto, toLocationDto, toMobDto } from "./db.js";
import { events, locations, mobs, players } from "./db/schema.js";
import { isMobAlive } from "./combat.js";
import { getPlayersInLocation } from "./presence.js";

const actions = [
    {
        id: "scavenge",
        label: "Выполнить действие",
        description: "Найти припасы в текущей локации."
    }
] as const;

export function buildLocationState(locationId: string): LocationStateResponse | null {
    const location = db.select().from(locations).where(eq(locations.id, locationId)).get();
    if (!location) {
        return null;
    }

    const recentEvents = db
        .select({
            id: events.id,
            playerId: events.playerId,
            playerName: players.name,
            locationId: events.locationId,
            type: events.type,
            createdAt: events.createdAt
        })
        .from(events)
        .innerJoin(players, eq(events.playerId, players.id))
        .where(eq(events.locationId, locationId))
        .orderBy(desc(events.createdAt), desc(events.id))
        .limit(10)
        .all()
        
    const locationMobs = db.select().from(mobs).where(eq(mobs.locationId, locationId)).all();
    const aliveMobs = locationMobs.filter(isMobAlive);
    return {
        location: toLocationDto(location),
        players: getPlayersInLocation(locationId),
        actions: [...actions],
        mobs: aliveMobs.map(toMobDto),
        recentEvents: recentEvents.map(toEventDto),
        serverTime: new Date().toISOString()
    };
}