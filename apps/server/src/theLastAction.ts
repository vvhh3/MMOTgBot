import type { Express, Request, Response } from "express"
import { inventoryItems, items, players, pvpSessions,combatSessions, mobs, trades } from "./db/schema.js";
import { db } from "./db.js";
import { eq, sql, and, or, lt } from "drizzle-orm"
import { addXpForPlayer } from "./level.js";
import { nowGameTime, nowGameTimeMs } from "./time.js";
import type { AuthedRequest } from "./auth.js";
import { getCasinoSessionForPlayer } from "./casino.js";
import { expireStalePvpSessions, getPvpStateForPlayer } from "./pvp.js";


export const receivingTheLastAction =(app: Express) => {
    app.post("/theLastAction", (req: Request, res: Response) => {
            const id = (req as AuthedRequest).player.id;
            const player1 = db.select().from(players).where(eq(players.id,id)).get()
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
                    const session = db.select().from(combatSessions).where(eq(combatSessions.playerId,player1.id)).get();
                    if(session == null){
                        db.update(players).set({idTheLastAction:null}).where(eq(players.id,player1.id)).run()
                    }
                    else if (session != null){
                        const mobInfo =db.select().from(mobs).where(eq(mobs.id,session.mobId)).get();
                        const now = nowGameTime();
                        const info = {
                            mob: mobInfo,
                            playerHp: session.playerHealth,
                            playerMaxHp: player1.maxHealth,
                            mobHp: session.mobHealth,
                            mobMaxHp: mobInfo?.maxHealth,
                            status:"active",
                            log: { text: `Ваш ход ${player1.name}`, at: now }
                        }
                        res.json({info})
                    }
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
