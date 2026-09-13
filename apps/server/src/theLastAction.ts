import { TradeItem ,PlayerDto,LastAction} from "@mmobot/shared"
import { db } from "./db.js"
import { players } from "./db/schema.js"
import { eq, sql } from "drizzle-orm"
type Type = "Fight" | "TakeAWalk" | "Trade"


export const lastActionFight = (playerInitiator1:PlayerDto,playerVictim2:PlayerDto)=>{

    const actionPlayer1:LastAction = {
        lastActionBool:true,
        typeAction:"Fight",
        health:playerInitiator1.health,
        opponent:playerVictim2.id,
        healthOpponent:playerVictim2.health,
        exitTime:new Date().toISOString(),
        motion:playerInitiator1.id
    }
    const actionPlayer2:LastAction = {
        lastActionBool:true,
        typeAction:"Fight",
        health:playerVictim2.health,
        opponent:playerInitiator1.id,
        healthOpponent:playerInitiator1.health,
        exitTime:new Date().toISOString(),
        motion:playerInitiator1.id
    }
    db.update(players).set({theLastAction:actionPlayer1}).where(eq(players.id,playerInitiator1.id))
    db.update(players).set({theLastAction:actionPlayer2}).where(eq(players.id,playerVictim2.id))
    
}
const lastActionTakeAWalk = (playerId:number,opponent:number,health:number,healthOpponent:number)=>{
    const action:LastAction = {
        lastActionBool:true,
        typeAction:"TakeAWalk",
        health:health,
        opponent:opponent,
        healthOpponent:healthOpponent,
        motion:opponent
    }
    db.update(players).set({theLastAction:action}).where(eq(players.id,playerId))
}
const lastActionTrade = (opponent:TradeItem,player:TradeItem,playerId:number)=>{
    const action:LastAction = {
        lastActionBool:true,
        entriesOpponent:opponent,
        entries:player,
        exitTime:new Date().toISOString()
    }
    db.update(players).set({theLastAction:action}).where(eq(players.id,playerId))
}
 

