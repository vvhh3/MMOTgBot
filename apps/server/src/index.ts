import http from "node:http";
import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { initRealTime } from "./infrastructure/realtime/socket-server.js";
import { startMaintenance } from "./jobs/maintenance.js";

const app = createApp();
const server = http.createServer(app)
initRealTime(server)
startMaintenance()

console.log(`[startup] MMOBot server booting at ${new Date().toISOString()} (friends logging ON)`);

server.listen(config.port, () => {
  console.log(`MMOBot API is listening on http://localhost:${config.port}`);
});
