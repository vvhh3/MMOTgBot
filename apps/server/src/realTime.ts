import type { Server as HttpServer } from "node:http"
import { Server, type Socket } from "socket.io"
import { eq } from "drizzle-orm"
import type { ClientToServerEvents, ServerToClientEvents } from "@mmobot/shared"

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>

import { config } from "./config.js"
import { verifySessionToken } from "./auth.js"
import { db } from "./db.js"
import { players } from "./db/schema.js"
import { buildLocationState } from "./state.js"
import { removePlayerFromLocation } from "./presence.js"

// Глобальный экземпляр Socket.IO сервера
// До вызова initRealTime() здесь null
let io: AppServer | null = null

// Храним все сокеты каждого игрока
// Один игрок может открыть игру в нескольких вкладках или на нескольких устройствах
//
// Пример
// 15 -> { socketA, socketB }
const playerSockets = new Map<number, Set<AppSocket>>()

export function initRealTime(httpServer: HttpServer): AppServer {
  // Создаём Socket.IO сервер поверх обычного HTTP сервера
  io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin(origin, callback) {
        // Проверяем разрешён ли origin клиента
        const allowed = !origin || config.devBypassAuth || origin === config.clientUrl || config.corsOrigins.includes(origin)
        // Если origin разрешён пропускаем подключение
        // Иначе возвращаем ошибку CORS
        callback(allowed ? null : new Error("Not allowed by CORS"), allowed)
      }
    }
  })

  // Middleware авторизации
  // Выполняется до события connection
  io.use((socket, next) => {
    // Токен приходит с клиента через
    // io(url, { auth: { token } })
    const token = socket.handshake.auth?.token as string | undefined

    // Без токена подключение запрещаем
    if (!token) {
      next(new Error("Missing auth token"))
      return
    }

    let playerId: number

    try {
      // Проверяем токен и получаем id игрока
      playerId = verifySessionToken(token)
    } catch {
      // Если токен неправильный или просроченный
      // запрещаем подключение
      next(new Error("Invalid auth token"))
      return
    }

    // Проверяем что игрок с таким id существует в БД
    const player = db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .get()

    if (!player) {
      next(new Error("Player not found"))
      return
    }

    // Сохраняем id игрока внутри socket
    // Потом не нужно снова проверять токен
    socket.data.playerId = player.id

    // Авторизация прошла успешно
    next()
  })

  // Срабатывает после успешной авторизации
  io.on("connection", (socket) => {
    const playerId = socket.data.playerId as number

    // Добавляем сокет в персональную комнату игрока
    //
    // Например
    // player:15
    //
    // Благодаря этому можно отправить событие
    // сразу во все вкладки и устройства одного игрока
    socket.join(`player:${playerId}`)

    const player = db.select().from(players).where(eq(players.id,playerId)).get()
    
    if(player?.currentLocationId){
      socket.join(`location:${player.currentLocationId}`)
      const state = buildLocationState(player.currentLocationId)
      if (state) {
        socket.emit(`locationState`, state)
      }
    }

    // Получаем уже существующие сокеты игрока
    let sockets = playerSockets.get(playerId)

    // Если игрок подключается впервые
    // создаём для него новый Set
    if (!sockets) {
      sockets = new Set()
      playerSockets.set(playerId, sockets)
    }

    // Добавляем текущий сокет игрока
    sockets.add(socket)

    // Когда конкретный сокет отключается
    socket.on("disconnect", () => {
      const sockets = playerSockets.get(playerId)

      if (!sockets) {
        return
      }

      // Удаляем только этот конкретный сокет
      sockets.delete(socket)
      // Если у игрока больше не осталось активных сокетов
      // полностью удаляем его из Map
      if (sockets.size === 0) {
        playerSockets.delete(playerId)
        const localtionId = removePlayerFromLocation(playerId)
        db.update(players).set({currentLocationId: null}).where(eq(players.id,playerId)).run()
        if(localtionId){
          broadcastLocation(localtionId)
        }
      }
    })
  })

  return io
}

// Возвращает Socket.IO сервер
// Если realtime ещё не был инициализирован
// выбрасываем понятную ошибку
export function getIo(): AppServer {
  if (!io) {
    throw new Error("Realtime not initialized")
  }

  return io
}

// Перемещает все сокеты игрока в новую location-комнату
//
// Например
//
// location:forest
//        ↓
// location:castle
//
// locationId === null означает
// что игрок должен выйти из всех location-комнат
export function moveSocketToLocation(playerId: number,locationId: string | null): void {
  const sockets = playerSockets.get(playerId)

  // Игрок сейчас не подключён
  if (!sockets) {
    return
  }

  // Проходим по всем вкладкам и устройствам игрока
  for (const socket of sockets) {
    // Удаляем сокет из предыдущих location-комнат
    // Комнату player:ID не трогаем
    for (const room of socket.rooms) {
      if (room.startsWith("location:")) {
        socket.leave(room)
      }
    }

    // Если указана новая локация
    // добавляем сокет в её комнату
    if (locationId) {
      socket.join(`location:${locationId}`)
    }
  }
}

// Отправляет событие конкретному игроку
// Событие получат все его активные сокеты
// вкладки, устройства и так далее
//
// Пример
// emitToPlayer(15, "player", playerDto)
export function emitToPlayer<K extends keyof ServerToClientEvents>(
  playerId: number,
  event: K,
  ...args: Parameters<ServerToClientEvents[K]>
): void {
  getIo()
    .to(`player:${playerId}`)
    .emit(event, ...args)
}

// Отправляет актуальное состояние локации
// всем игрокам которые сейчас находятся в ней
//
// Например
//
// location:forest
//   ├── player 1
//   ├── player 2
//   └── player 3
//
// Все они получат событие locationState
export function broadcastLocation(locationId: string): void {
  // Собираем текущее состояние локации
  const state = buildLocationState(locationId)

  // Если локация не найдена или состояние не удалось собрать
  // ничего не отправляем
  if (!state) {
    return
  }

  // Отправляем состояние всем сокетам
  // находящимся в этой location-комнате
  getIo().to(`location:${locationId}`).emit("locationState", state)
}