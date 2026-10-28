import { groupOverview } from '../group-events/state.js';
import { expireGroupEvents } from '../group-events/runs.js';
import { and,eq } from "drizzle-orm";
import type { Express,Request,Response } from "express";
import { db } from "../../database/connection.js";
import { combatSessions,mobs,players,trades } from "../../database/schema.js";
import type { AuthedRequest } from "../auth/auth.js";
import { getCasinoSessionForPlayer } from "../casino/routes.js";
import { getCombatState } from "../combat/pve.js";
import { expireStalePvpSessions,getPvpStateForPlayer } from "../combat/pvp.js";


export const receivingTheLastAction =(app: Express) => {
    app.post("/theLastAction", (req: Request, res: Response) => {
            const id = (req as AuthedRequest).player.id;
            const player1 = db.select().from(players).where(eq(players.id,id)).get()
            if (player1?.idTheLastAction?.type === 'GroupEvent' || player1?.idTheLastAction?.type === 'GroupEventLobby') {
                expireGroupEvents();
                const overview = groupOverview(id);
                return res.json({ info: player1.idTheLastAction.type === 'GroupEvent' ? overview.run : overview.party });
            }
            if(player1?.idTheLastAction !=null){
                if(player1.idTheLastAction.type === "Fight"){
                    // Восстановление использует те же HP, сторону и признак завершения, что и сокет.
                    expireStalePvpSessions();
                    const info = getPvpStateForPlayer(player1.idTheLastAction.id, player1.id);
                    if (!info) {
                        db.update(players).set({ idTheLastAction: null }).where(eq(players.id, player1.id)).run();
                    }
                    return res.json({ info });
                }
                else if (player1.idTheLastAction.type=="TakeAWalk"){
                    const session = db.select().from(combatSessions).where(and(eq(combatSessions.id, player1.idTheLastAction.id), eq(combatSessions.playerId, player1.id))).get();
                    const mob = session && db.select().from(mobs).where(eq(mobs.id, session.mobId)).get();
                    if (!session || !mob || session.status !== 'active') {
                        db.update(players).set({ idTheLastAction: null }).where(eq(players.id, player1.id)).run();
                        return res.json({ info: null });
                    }
                    return res.json({ info: getCombatState(player1, session, mob) });
                }
                else if(player1.idTheLastAction.type=="Trade"){
                    const session = db.select().from(trades).where(eq(trades.id,player1.idTheLastAction.id)).get()
                    if(!session) return
                    const player2Id = player1.id == session.toPlayerId ? session.fromPlayerId : session.toPlayerId;
                    const player2 = db.select().from(players).where(eq(players.id,player2Id)).get()
                    if(session?.status == "open"){
                        if(player1.id == session.fromPlayerId){
                            const info = {
                                id: session.id,
                                status: session.status,
                                myOffer: session.fromOffer,
                                partnerOffer: session.toOffer,
                                iAmReady: session.fromReady,
                                partnerIsReady: session.toReady,
                                partnerName:player2?.name,
                                direction:"incoming"
                            }
                            res.json({info})
                        }
                        else if(player1.id == session.toPlayerId){
                            const info = {
                                id: session.id,
                                status: session.status,
                                myOffer: session.toOffer,
                                partnerOffer: session.fromOffer,
                                iAmReady: session.toReady,
                                partnerIsReady: session.fromReady,
                                partnerName:player2?.name,
                                direction:"incoming"
                            }
                            res.json({info})
                        }
                    }
                }
                else if (["Mines", "Blackjack", "Ladder"].includes(player1.idTheLastAction.type)) {
                    const info = getCasinoSessionForPlayer(player1.id, player1.idTheLastAction.id);
                    if (!info || info.status !== "active") {
                        db.update(players).set({ idTheLastAction: null }).where(eq(players.id, player1.id)).run();
                        return res.status(404).json({ error: "Активная игра не найдена" });
                    }
                    return res.json({ info });
                }
            }
            if (!res.headersSent) return res.json({ info: null });
        })
}
