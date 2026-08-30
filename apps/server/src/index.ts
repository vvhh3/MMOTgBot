import { config } from "./config.js";
import { createApp } from "./app.js";
import http from "node:http"
import type { Duplex } from "node:stream"
import { initRealTime } from "./realTime.js";
import { startMaintenance } from "./maintenance.js";

const P = (tag: string, msg: string) => console.log(`[WS ${tag}] ${new Date().toISOString()} ${msg}`);

function safeHeader(name: string, value: string | string[] | undefined): string {
  if (value === undefined) return "<missing>"
  const raw = Array.isArray(value) ? value.join(",") : value
  const lower = name.toLowerCase()
  if (lower === "cookie" || lower === "authorization" || lower.includes("token") || lower.includes("key") || lower.includes("secret") || lower.includes("initdata")) {
    return "<masked>"
  }
  if (raw.length > 40) return raw.slice(0, 25) + "…<masked>"
  return raw
}

const app = createApp();
const server = http.createServer(app)
initRealTime(server)
startMaintenance()

console.log(`[startup] MMOBot server booting at ${new Date().toISOString()} (friends logging ON)`);

// HTTP/upgrade-запросы (WebSocket handshake) на уровне Node-сервера.
// Это срабатывает, когда WS-запрос реально дошёл до процесса приложения.
// Не перехватываем соединение — только логируем, чтобы socket.io его обработал сам.
server.on("upgrade", (req: http.IncomingMessage, socket: Duplex, head: Buffer) => {
  const url = req.url ?? ""
  P("UPGRADE", `http.upgrade REACHED_APP url=${url} method=${req.method}`)
  P("UPGRADE", `  origin=${safeHeader("origin", req.headers.origin)} host=${safeHeader("host", req.headers.host)}`)
  P("UPGRADE", `  user-agent=${safeHeader("user-agent", req.headers["user-agent"])}`)
  P("UPGRADE", `  x-forwarded-proto=${safeHeader("x-forwarded-proto", req.headers["x-forwarded-proto"])} x-forwarded-for=${safeHeader("x-forwarded-for", req.headers["x-forwarded-for"])}`)
  P("UPGRADE", `  sec-websocket-key=${req.headers["sec-websocket-key"] ? "<present>" : "<missing>"} sec-websocket-version=${safeHeader("sec-websocket-version", req.headers["sec-websocket-version"])}`)

  // если socket.io/engine.io не обработал upgrade (не установил флаг), соединение останется на нас
  socket.on("close", (hadError: boolean) => {
    // отпечаток закрытия на уровне HTTP-сокета (уже после обработки)
    P("CLOSE", `http-upgrade-socket closed hadError=${hadError} `)
  })
})

// host, на котором слушает сервер
P("SERVER", `config.port=${config.port} host=0.0.0.0 (listen) clientUrl=${config.clientUrl} devBypassAuth=${config.devBypassAuth}`)

server.listen(config.port, () => {
  console.log(`MMOBot API is listening on http://localhost:${config.port}`);
  P("SERVER", `http server listening port=${config.port}`)
});
