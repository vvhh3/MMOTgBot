import { io, type Socket } from "socket.io-client"
import type { ClientToServerEvents, ServerToClientEvents } from "@mmobot/shared"

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: AppSocket | null = null
let socketToken: string | null = null

const PREFIX = "[WS CLIENT]"

function iso(): string {
  return new Date().toISOString()
}

function getProtocol(url: string): string {
  return url.startsWith("https:") || url.startsWith("wss:") ? "wss" : "ws"
}

// Выбирает безопасный для лога url (без query, чтобы не светить sid/токен)
function safeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.search = ""
    return u.toString()
  } catch {
    return url
  }
}

// Маскирует потенциально чувствительные заголовки
function maskHeader(name: string, value: string | string[] | undefined): string {
  if (value === undefined) return "<missing>"
  const raw = Array.isArray(value) ? value.join(",") : value
  const lower = name.toLowerCase()
  if (lower === "cookie" || lower === "authorization" || lower.includes("token") || lower.includes("key") || lower.includes("secret")) {
    return "<masked>"
  }
  if (raw.length > 40) return raw.slice(0, 25) + "…<masked>"
  return raw
}

function getReadyStateLabel(rs: number): string {
  const map: Record<number, string> = { 0: "CONNECTING", 1: "OPEN", 2: "CLOSING", 3: "CLOSED" }
  return map[rs] ?? `UNKNOWN(${rs})`
}

// Цепляемся к нативному WebSocket движка engine.io (transport.ws) через addEventListener,
// чтобы НЕ переопределять обработчики самого engine.io (это сломало бы работу сокета).
function hookTransportWs(s: AppSocket): void {
  const engine = (s as unknown as { io?: { engine?: { transport?: { ws?: WebSocket & { _mmobotHooked?: boolean } } } } }).io?.engine
  const t = engine?.transport
  if (!t) return
  const ws = t.ws
  if (!ws || !ws.addEventListener) return
  if (ws._mmobotHooked) return
  ws._mmobotHooked = true

  console.log(`[WS CLIENT] ${iso()} native-ws url=${safeUrl(ws.url ?? "")} proto=${getProtocol(ws.url ?? "")} readyState=${getReadyStateLabel(ws.readyState)}`)
  ws.addEventListener("open", () => {
    console.log(`[WS CLIENT] ${iso()} onopen url=${safeUrl(ws.url ?? "")} readyState=${getReadyStateLabel(ws.readyState)}`)
  })
  ws.addEventListener("message", (e: MessageEvent) => {
    const dt = typeof e.data
    console.log(`[WS CLIENT] ${iso()} onmessage dataType=${dt} len=${dt === "string" ? (e.data as string).length : "(binary)"} readyState=${getReadyStateLabel(ws.readyState)}`)
  })
  ws.addEventListener("error", (e: Event) => {
    console.log(`[WS CLIENT] ${iso()} onerror url=${safeUrl(ws.url ?? "")} readyState=${getReadyStateLabel(ws.readyState)} ${e.type}`)
  })
  ws.addEventListener("close", (e: CloseEvent) => {
    console.log(`[WS CLIENT] ${iso()} onclose code=${e.code} reason=${e.reason ?? ""} wasClean=${e.wasClean} readyState=${getReadyStateLabel(ws.readyState)}`)
  })
}

function attachClientLoggers(s: AppSocket, url: string): void {
  if ((s as unknown as { _mmobotLoggerAttached?: boolean })._mmobotLoggerAttached) return
  ;(s as unknown as { _mmobotLoggerAttached?: boolean })._mmobotLoggerAttached = true

  console.log(`[WS CLIENT] ${iso()} attach-loggers url=${safeUrl(url)} proto=${getProtocol(url)} transports=["websocket"]`)

  // периодический опрос, чтобы подхватить нативный WS после upgrade/reconnect
  const pollTimer = setInterval(() => hookTransportWs(s), 1000)
  const stopPoll = () => clearInterval(pollTimer)

  s.on("connect", () => {
    console.log(`[WS CLIENT] ${iso()} EVENT connect-ok socketId=${s.id} transport=${(s as unknown as { io?: { engine?: { transport?: { name?: string } } } }).io?.engine?.transport?.name ?? "?"}`)
    hookTransportWs(s)
  })

  s.on("connect_error", (err: Error & { description?: string; context?: unknown }) => {
    console.log(`[WS CLIENT] ${iso()} EVENT connect_error message=${err?.message} description=${err?.description ?? "(none)"} context=${JSON.stringify(err?.context ?? "(none)")}`)
  })

  s.on("disconnect", (reason: string) => {
    console.log(`[WS CLIENT] ${iso()} EVENT disconnect reason=${reason}`)
    stopPoll()
  })

  s.io.on("error", (err: Error) => {
    console.log(`[WS CLIENT] ${iso()} EVENT manager-error message=${err?.message}`)
  })
}

export function connectSocket(token: string): AppSocket {
  const url = import.meta.env.VITE_API_BASE_URL ?? ""
  const proto = getProtocol(url)
  console.log(`[WS CLIENT] ${iso()} connectSocket url=${safeUrl(url)} proto=${proto} tokenPresent=${!!token}`)

  if (socket && socketToken === token) {
    console.log(`[WS CLIENT] ${iso()} reuse-existing url=${safeUrl(url)}`)
    return socket
  }
  socketToken = token

  if (socket) {
    console.log(`[WS CLIENT] ${iso()} reauth disconnect+connect url=${safeUrl(url)}`)
    socket.auth = { token }
    socket.disconnect()
    socket.connect()
    return socket
  }

  console.log(`[WS CLIENT] ${iso()} creating-socket url=${safeUrl(url)} proto=${proto}`)
  socket = io(url, {
    auth: { token },
    transports: ["websocket"],
  }) as AppSocket

  attachClientLoggers(socket, url)
  return socket
}

export function getSocket(): AppSocket | null {
  return socket
}
