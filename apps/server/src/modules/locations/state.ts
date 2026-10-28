import { currentGroupEvent } from '../group-events/availability.js';
import type { LocationStateResponse } from "@mmobot/shared";
import { TUTORIAL_MOB_ID } from "@mmobot/shared";
import { desc,eq } from "drizzle-orm";
import { db } from "../../database/connection.js";
import { toEventDto,toLocationDto,toMobDto } from "../../database/mappers.js";
import { events,locations,mobs,players } from "../../database/schema.js";
import { nowGameTime } from "../../shared/time.js";
import { isMobAlive } from "../combat/pve.js";
import { getPlayersInLocation } from "./presence.js";

const actions = [
    { id: "special_walk", label: "Особая прогулка с компанией", description: "Зачистка волн втроём во время события" },
    {
        id: "fight",
        label: "Сражаться",
        description: "Сразиться с другим игроком"
    },
    {
        id: "walk",
        label: "Прогуляться",
        description: "Прогуляться по локации"
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
    const aliveMobs = locationMobs.filter((mob) => mob.id !== TUTORIAL_MOB_ID && isMobAlive(mob));
    return {
        location: toLocationDto(location),
        groupEvent: locationId === 'square' ? currentGroupEvent() : null,
        players: getPlayersInLocation(locationId),
        actions: actions.filter((action) => location.actions.includes(action.id)),
        mobs: aliveMobs.map(toMobDto),
        recentEvents: recentEvents.map(toEventDto),
        serverTime: nowGameTime()
    };
}
