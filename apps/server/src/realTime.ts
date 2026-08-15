import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { eq } from "drizzle-orm";
import { config } from "./config.js";
import { verifySessionToken } from "./auth.js";
import { db } from "./db.js";
import { players } from "./db/schema.js";
import { buildLocationState } from "./state.js";


let io: Server | null = null

export function initRealTime(httpServer: HttpServer) {
    io = new Server(httpServer, {
        cors: {
            origin(origin, callback) {
                if(!origin|| config.devBypassAuth || origin === config.clientUrl || config.corsOrigins.includes(origin)){
                    callback(null,true)
                    return
                }callback(null,false)
            }
        }
    })
}

io!.use((socket,next) => {
    const token = socket.handshake.auth?.token as string| undefined
    if(!token){
        next(new Error("Error Bearer token"))
        return
    }
    try{
        const playerId = verifySessionToken(token)
        const player = db.select().from(players).where(eq(players.id,playerId)).get()
        if(!player){
            next(new Error("player not found"))
            return
        }
        socket.data.playerId = player.id
        socket.join(`player:${player.id}`)
        next()
    }catch{
        next(new Error("Error bearer token"))
    }
})