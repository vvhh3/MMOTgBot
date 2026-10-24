import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function serveClient(app: express.Express): void {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(currentDir, "../../../client/dist");

  app.use(express.static(clientDist));
  // Клиентские маршруты получают index.html; неизвестные API-пути проходят дальше.
  app.get("*", (req, res, next) => {
    const isApiPath =
      req.path === "/health" ||
      req.path === "/auth" ||
      req.path === "/me" ||
      req.path.startsWith("/locations") ||
      req.path.startsWith("/mobs") ||
      req.path.startsWith("/quests") ||
      req.path.startsWith("/trades") ||
      req.path.startsWith("/pvp") ||
      req.path.startsWith("/friends") ||
      req.path.startsWith("/inventory") ||
      req.path === "/shop" || req.path.startsWith("/shop/") ||
      req.path.startsWith("/leaderboard") ||
      req.path.startsWith("/combat")
    if (isApiPath) {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, "index.html"), (error) => {
      if (error) {
        next();
      }
    });
  });
}
