import { config } from "./config.js";
import { createApp } from "./app.js";
import http from "node:http"
import { initRealTime } from "./realTime.js";
import { startMaintenance } from "./maintenance.js";

const app = createApp();
const server = http.createServer(app)
initRealTime(server)
startMaintenance()

console.log(`[startup] MMOBot server booting at ${new Date().toISOString()} (friends logging ON)`);

server.listen(config.port, () => {
  console.log(`MMOBot API is listening on http://localhost:${config.port}`);
});
