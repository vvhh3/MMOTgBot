import type { ClientToServerEvents,ServerToClientEvents } from "@mmobot/shared"
import { io,type Socket } from "socket.io-client"

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: AppSocket | null = null
let socketToken: string | null = null

export function connectSocket(token: string, autoConnect = true): AppSocket {
  const url = import.meta.env.VITE_API_BASE_URL ?? ""

  if (socket && socketToken === token) {
    if (autoConnect) socket.connect()
    return socket
  }
  socketToken = token

  if (socket) {
    socket.auth = { token }
    socket.disconnect()
    if (autoConnect) socket.connect()
    return socket
  }

  socket = io(url, {
    autoConnect,
    auth: { token },
    transports: ["websocket"],
  }) as AppSocket

  return socket
}

export function getSocket(): AppSocket | null {
  return socket
}
