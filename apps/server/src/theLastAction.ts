import type { Express, Request, Response } from "express"
import { inventoryItems, items, players, pvpSessions,combatSessions, mobs, trades } from "./db/schema.js";
import { db } from "./db.js";
import { eq, sql, and, or, lt } from "drizzle-orm"
import { addXpForPlayer } from "./level.js";
import { nowGameTime, nowGameTimeMs } from "./time.js";


export const receivingTheLastAction =(app: Express) => {
    app.post("/theLastAction", (req: Request, res: Response) => {
            const id = Number(req.body.id);
            const player1 = db.select().from(players).where(eq(players.id,id)).get()
            if(player1?.idTheLastAction !=null){
                if(player1?.idTheLastAction?.type=="Fight"){
                    const infoPvp = db.select().from(pvpSessions).where(eq(pvpSessions.id,player1?.idTheLastAction.id)).get();
                    if(!infoPvp) return
                    if(!infoPvp?.lastActionAt && Date.now() >= new Date(infoPvp.creadetAt).getTime() + 2 * 60 * 1000){
                        db.update(pvpSessions).set({ ...infoPvp, status: "finished", winnerId:null, lastActionAt:null }).where(eq(pvpSessions.id, infoPvp.id)).run();
                        db.update(players).set({idTheLastAction:null}).where(eq(players.id,infoPvp.player1Id)).run()
                        db.update(players).set({idTheLastAction:null}).where(eq(players.id,infoPvp.player2Id)).run()
                    }
                    else if (infoPvp.lastActionAt && Date.now() >= new Date(infoPvp.lastActionAt).getTime() + 2 * 60 * 1000){
                        const loserId = infoPvp.turn == "player1" ? infoPvp.player1Id : infoPvp.player2Id
                        const winnerId = infoPvp.turn != "player1" ? infoPvp.player1Id : infoPvp.player2Id
                        addXpForPlayer(winnerId, 10);
                        db.update(players).set({ points: sql`${players.points} + 10` }).where(eq(players.id, winnerId)).run();
                        db.update(players).set({ health: 0 }).where(eq(players.id, loserId)).run();
                        db.update(players).set({idTheLastAction:null}).where(eq(players.id,infoPvp.player1Id)).run()
                        db.update(players).set({idTheLastAction:null}).where(eq(players.id,infoPvp.player2Id)).run()
    
                    }
                    else{
                        if(player1.id == infoPvp?.player1Id){
                            const player2 = db.select().from(players).where(eq(players.id,infoPvp.player2Id)).get()
                            const info={
                                id: infoPvp.id,
                                status: infoPvp.status,
                                direction: "incoming",
                                myName: player1.name,
                                partnerName: player2?.name,
                                myHp: infoPvp.player1Health,
                                myMaxHp: player1.maxHealth,
                                partnerHp: infoPvp.player2Health,
                                partnerMaxHp: player2?.maxHealth,
                                myTurn: infoPvp.turn == "player1" ? true : false,
                                finished: false,
                                isWon: null,
                            }
                            res.json({info})
                        }
                        else if (player1.id == infoPvp?.player2Id){
                            const player2 = db.select().from(players).where(eq(players.id,infoPvp.player1Id)).get()
                            const info={
                                id: infoPvp.id,
                                status: infoPvp.status,
                                direction: "incoming",
                                myName: player1.name,
                                partnerName: player2?.name,
                                myHp: infoPvp.player1Health,
                                myMaxHp: player1.maxHealth,
                                partnerHp: infoPvp.player2Health,
                                partnerMaxHp: player2?.maxHealth,
                                myTurn: infoPvp.turn == "player2" ? true : false,
                                finished: false,
                                isWon: null,
                            }
                            res.json({info})
                        }
                    }
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
            }
            
        })
}