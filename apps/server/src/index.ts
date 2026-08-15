import { config } from "./config.js";
import { createApp } from "./app.js";
import http from "node:http"
import { initRealTime } from "./realTime.js";

const app = createApp();
const server = http.createServer(app)
initRealTime(server)


server.listen(config.port, () => {
  console.log(`MMOBot API is listening on http://localhost:${config.port}`);
});
