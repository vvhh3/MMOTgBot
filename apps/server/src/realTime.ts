import type { Server as HttpServer } from "node:http"
import { Server, type Socket } from "socket.io"
import { eq,and,or } from "drizzle-orm"
import type { ClientToServerEvents, ServerToClientEvents } from "@mmobot/shared"

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>

import { config } from "./config.js"
import { verifySessionToken } from "./auth.js"
import { db } from "./db.js"
import { friendships, players } from "./db/schema.js"
import { buildLocationState } from "./state.js"
import { removePlayerFromLocation } from "./presence.js"
import { buildFriendsOverview } from "./db.js"

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
    console.log(`[realtime] socket connected playerId=${playerId} totalSockets=${playerSockets.size}`)

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

    // Если это первый сокет игрока (был офлайн → стал онлайн) —
    // шлём ему и всем его друзьям свежий список с актуальным статусом.
    if (sockets.size === 1) {
      pushFriendsPresence(playerId)
    }

    // Когда конкретный сокет отключается
    socket.on("disconnect", () => {
      console.log(`[realtime] socket disconnected playerId=${playerId}`)
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
        // Игрок ушёл в офлайн — сообщаем друзьям обновлённый статус
        pushFriendsPresence(playerId)
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

// Онлайн ли игрок прямо сейчас (есть ли у него активные сокеты).
// Используется, чтобы показать в списке друзей "В сети" / "Не в сети".
export function isPlayerOnline(playerId: number): boolean {
  return (playerSockets.get(playerId)?.size ?? 0) > 0
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

// Отправляет актуальное состояние локации всем игрокам, которые сейчас в ней
// Дебаунс: если локацию "трогают" много раз подряд (каждый walk каждого игрока
// вызывает broadcastLocation), состояние пересобирается и рассылается не чаще,
// чем раз в BROADCAST_DEBOUNCE_MS — иначе нагрузка растёт как O(N²) от онлайна.
const broadcastTimers = new Map<string, ReturnType<typeof setTimeout>>()
const BROADCAST_DEBOUNCE_MS = 300

export function broadcastLocation(locationId: string): void {
  // Рассылка для этой локации уже запланирована — новое состояние подхватится ей
  if (broadcastTimers.has(locationId)) {
    return
  }

  broadcastTimers.set(locationId, setTimeout(() => {
    broadcastTimers.delete(locationId)

    const state = buildLocationState(locationId)
    if (!state) {
      return
    }

    getIo().to(`location:${locationId}`).emit("locationState", state)
  }, BROADCAST_DEBOUNCE_MS))
}

function pushFriendsPresence(playerId: number): void {
  try {
    const overview = buildFriendsOverview(playerId);
    console.log(`[friends] pushFriendsPresence for ${playerId}: friends=${overview.friends.length}, online=${overview.friends.filter(f => f.online).map(f => f.id)}`);
    emitToPlayer(playerId, "friendsUpdate", overview);
    const rows = db.select().from(friendships)
      .where(and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.fromId, playerId), eq(friendships.toId, playerId))
      ))
      .all();
    const friendIds = rows.map((r) => (r.fromId === playerId ? r.toId : r.fromId));
    for (const fid of friendIds) {
      emitToPlayer(fid, "friendsUpdate", buildFriendsOverview(fid));
    }
  } catch (error) {
    console.error(`[friends] pushFriendsPresence failed for ${playerId}:`, error);
  }
}