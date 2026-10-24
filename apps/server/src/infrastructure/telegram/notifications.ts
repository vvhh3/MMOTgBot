
import { eq } from "drizzle-orm";
import { Bot } from "grammy";
import { config } from "../../config/env.js";
import { db } from "../../database/connection.js";
import { players } from "../../database/schema.js";


const bot = new Bot(config.botToken)

let queue: Promise<void> = Promise.resolve()
const delay_ms = 100

const enqueue = (chatId: number,text:string) => {
    queue = queue.then(async () => {
        await bot.api.sendMessage(chatId,text)
        await new Promise((r) => setTimeout(r,delay_ms))
    }).catch((error) => {
        const msg = error instanceof Error ? error.message: String(error)
        if(!msg.includes("403") && !msg.includes("chat not found")){
            console.error("notify error",msg)
        }
    })
}


export const notify = (playerId:number,text: string) => {
    const player = db.select().from(players).where(eq(players.id,playerId)).get()
    if(!player) return
    enqueue(playerId,text)
}