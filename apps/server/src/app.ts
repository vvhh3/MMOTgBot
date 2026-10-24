import cors from "cors";
import express from "express";
import { config } from "./config/env.js";
import { initializeDatabase } from "./database/initialize.js";
import { requireAdmin,requireAuth } from "./modules/auth/auth.js";
import { createCasinoRoutes } from "./modules/casino/routes.js";
import { createPvpRoutes } from "./modules/combat/pvp.js";
import { createAddFriend } from "./modules/friends/routes.js";
import { InventoryRoutes } from "./modules/inventory/routes.js";
import { createItemRoutes } from "./modules/items/routes.js";
import { dailyActivities } from "./modules/locations/daily-activities.js";
import { hydratePresenceFromDatabase } from "./modules/locations/presence.js";
import { createMobRoutes } from "./modules/mobs/routes.js";
import { receivingTheLastAction } from "./modules/players/last-action.js";
import { createQuestRoutes } from "./modules/quests/routes.js";
import { createShopRoutes } from "./modules/shop/routes.js";
import { createTradeRoutes } from "./modules/trades/routes.js";

import { serveClient } from "./http/serve-client.js";
import { createAdminPlayerRoutes } from "./modules/admin/players.routes.js";
import { createAuthRoutes } from "./modules/auth/routes.js";
import { createCombatRoutes } from "./modules/combat/routes.js";
import { createLeaderboardRoutes } from "./modules/leaderboard/routes.js";
import { createLocationRoutes } from "./modules/locations/routes.js";
import { createOnlinePlayerRoutes } from "./modules/players/online.routes.js";
import { createPlayerRoutes } from "./modules/players/routes.js";

export function createApp(): express.Express {
  initializeDatabase();
  hydratePresenceFromDatabase();

  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.devBypassAuth || origin === config.clientUrl || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      }
    })
  );
  app.use(express.json());

  //Мобы
  app.use("/mobs", requireAuth, requireAdmin)
  createMobRoutes(app)

  //Предметы
  app.use("/items", requireAuth, requireAdmin)
  createItemRoutes(app)


  //Инвентарь
  app.use("/inventory", requireAuth)
  InventoryRoutes(app)

  app.use("/shop", requireAuth)
  createShopRoutes(app)

  //Квесты
  app.use("/quests", requireAuth)
  createQuestRoutes(app)

  //Обмены между игроками
  app.use("/trades", requireAuth)
  createTradeRoutes(app)

  //Дуэли между игроками
  app.use("/pvp", requireAuth)
  createPvpRoutes(app)

  //Друзья
  app.use("/friends", requireAuth)
  createAddFriend(app)
  app.use("/theLastAction",requireAuth)
  receivingTheLastAction(app)
  app.use("/casino", requireAuth)
  createCasinoRoutes(app)
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  })

  createAdminPlayerRoutes(app);

  app.use("/dailyActivities",requireAuth)
  dailyActivities(app)

  createAuthRoutes(app);

  createPlayerRoutes(app);

  createLocationRoutes(app);

  createOnlinePlayerRoutes(app);

  createCombatRoutes(app);

  createLeaderboardRoutes(app);

  serveClient(app);

  return app;
}
