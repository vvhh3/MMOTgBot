import { io, type Socket } from "socket.io-client"
import type { ClientToServerEvents, ServerToClientEvents } from "@mmobot/shared"

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: AppSocket | null = null
let socketToken: string | null = null

export function connectSocket(token: string): AppSocket {
    if (socket && socketToken === token) {
        return socket
    }
    socketToken = token

    if (socket) {
        socket.auth = { token }
        socket.disconnect()
        socket.connect()
        return socket
    }

    socket = io(import.meta.env.VITE_API_BASE_URL ?? "", {
        auth: { token }
    }) as AppSocket
    return socket
}

export function getSocket(): AppSocket | null {
    return socket
}