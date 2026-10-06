import type { Express, Request, Response } from "express"
import { inventoryItems, items, players, pvpSessions,combatSessions, mobs, trades } from "./db/schema.js";
import { db } from "./db.js";
import { eq, sql, and, or, lt } from "drizzle-orm"
import { addXpForPlayer } from "./level.js";
import { nowGameTime, nowGameTimeMs } from "./time.js";
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
type MoneyTier = {
  min: number;
  max: number;
  weight: number; // чем больше weight, тем чаще выпадает
};

const MONEY_TIERS: MoneyTier[] = [
  { min: 10,  max: 30,   weight: 50 }, // самое частое
  { min: 31,  max: 70,   weight: 30 },
  { min: 71,  max: 150,  weight: 15 },
  { min: 151, max: 300,  weight: 4 },
  { min: 301, max: 1000, weight: 1 }, // джекпот, очень редко
];

function rollDailyMoney(): number {
  const totalWeight = MONEY_TIERS.reduce((sum, tier) => sum + tier.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const tier of MONEY_TIERS) {
    if (roll < tier.weight) {
      // внутри выбранного тира сумма тоже случайная
      return Math.floor(Math.random() * (tier.max - tier.min + 1)) + tier.min;
    }
    roll -= tier.weight;
  }

  // на случай ошибок округления — вернём средний тир
  return MONEY_TIERS[0].min;
}
export const dailyActivities = (app: Express)=>{
   app.post("/dailyActivities/money", (req: Request, res: Response) => {
        const id = Number(req.body.id);
        const location = req.body.location as string;

        if (!id || Number.isNaN(id)) {
            return res.status(400).json({ error: "Некорректный id" });
        }
        if (!location) {
            return res.status(400).json({ error: "Не указана location" });
        }

        const player1 = db.select().from(players).where(eq(players.id, id)).get();

        if (!player1) {
            return res.status(404).json({ error: "Игрок не найден" });
        }

        const now = new Date();
        const cooldowns = player1.cooldowns ?? {};
        const nextAvailable = cooldowns[location];

        // Награда доступна, если кулдауна ещё не было ИЛИ он уже истёк (nextAvailable <= now)
        if (nextAvailable != null && new Date(nextAvailable) > now) {
            const msLeft = new Date(nextAvailable).getTime() - now.getTime();
            const hours = Math.floor(msLeft / (60 * 60 * 1000));
            const minutes = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));

            return res.json({
                code:"COOLDOWN",
                text: `Ещё не время. Осталось ${hours} ч ${minutes} мин`,
                nextAvailableAt: nextAvailable,
                msLeft,
                hours,
                minutes,
            });
        }

        const amount = rollDailyMoney();
        const updatedCooldowns = {
            ...cooldowns,
            [location]: new Date(now.getTime() + COOLDOWN_MS).toISOString(),
        };

        const updated = db
            .update(players)
            .set({
            money: sql`${players.money} + ${amount}`,
            cooldowns: updatedCooldowns,
            })
            .where(eq(players.id, id))
            .returning()
            .get();

        return res.json({
            code:"SUCCESS",
            success: true,
            moneyReceived: amount,
            money: updated.money,
            nextAvailableAt: updatedCooldowns[location],
        });
        });
}