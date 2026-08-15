import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { eq } from "drizzle-orm";
import { config } from "./config.js";
import { verifySessionToken } from "./auth.js";
import { db } from "./db.js";
import { players } from "./db/schema.js";
import { buildLocationState } from "./state.js";

let io: Server | null = null;

export function initRealTime(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin || config.devBypassAuth || origin === config.clientUrl || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      }
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error("Missing bearer token"));
      return;
    }
    try {
      const playerId = verifySessionToken(token);
      const player = db.select().from(players).where(eq(players.id, playerId)).get();
      if (!player) {
        next(new Error("Player not found"));
        return;
      }
      socket.data.playerId = player.id;
      socket.join(`player:${player.id}`);
      next();
    } catch {
      next(new Error("Invalid bearer token"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("joinLocation", (locationId: string) => {
      socket.join(`location:${locationId}`);
    });
    socket.on("leaveLocation", (locationId: string) => {
      socket.leave(`location:${locationId}`);
    });
  });

  return io;
}

export function getIo(): Server {
  if (!io) {
    throw new Error("Realtime not initialized");
  }
  return io;
}

// Отправка события конкретному игроку (например, состояние боя)
export function emitToPlayer(playerId: number, event: string, payload: unknown): void {
  getIo().to(`player:${playerId}`).emit(event, payload);
}

// Рассылка актуального состояния локации всем, кто в неё вошёл
export function broadcastLocation(locationId: string): void {
  const state = buildLocationState(locationId);
  if (state) {
    getIo().to(`location:${locationId}`).emit("locationState", state);
  }
}