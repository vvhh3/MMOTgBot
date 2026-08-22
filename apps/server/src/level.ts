import { db } from "./db.js"
import { players } from "./db/schema.js"
import { eq, sql } from "drizzle-orm"

// ============================================================================
// УРОВНИ И ОПЫТ
// ============================================================================
// Опыт копится (мобы, квесты, действия на локации) и переводится в уровень
// по пороговой таблице ниже. При каждом новом уровне игрок НЕ получает статы
// автоматически — вместо этого ему выдаётся очко характеристик (statPoints),
// которое он сам тратит через POST /me/stats на:
//
//   maxHealth (+5 HP за очко)  |  strength (+2)  |  defense (+1)
//
// Такой подход даёт игроку выбор билда, но требует, чтобы клиент показывал
// кнопку "прокачать" при statPoints > 0.

// сколько очков характеристик даётся за КАЖДЫЙ новый уровень
export const STAT_POINTS_PER_LEVEL = 1;

// стоимость характеристики в единицах за одно потраченное очко.
// HP дороже, поэтому за одно очко даётся сразу +5 максимального здоровья.
export const STAT_GAIN = {
    maxHealth: 5,
    strength: 2,
    defense: 1
} as const;

// Пороги опыта для уровней. Индекс + 1 = уровень
// (xp >= 100 → уровень 2, xp >= 250 → уровень 3 и так далее).
const Ex_require = [
    { requireXp: 0 },      // уровень 1 (стартовый)
    { requireXp: 100 },    // уровень 2
    { requireXp: 250 },    // уровень 3
    { requireXp: 500 },    // уровень 4
    { requireXp: 1000 },   // уровень 5
    { requireXp: 1600 },   // уровень 6
    { requireXp: 2200 },   // уровень 7
    { requireXp: 3000 }    // уровень 8
]

export const getLevelByXp = (xp: number) => {
    let level = 0
    for (const l of Ex_require) {
        if (xp >= l.requireXp) level++
        else break
    }
    return Math.min(level, Ex_require.length)
}

// Начисляет игроку опыт. Если порог нового уровня пройден — начисляет
// нераспределённые очки характеристик (по STAT_POINTS_PER_LEVEL за уровень).
// Сами статы НЕ трогает: их поднимает сам игрок через POST /me/stats.
// Возвращает, сколько уровней было получено этим вызовом.
export const addXpForPlayer = (playerId: number, xp: number) => {

    const player = db.select().from(players).where(eq(players.id, playerId)).get()
    if (!player) return 0

    const newXp = player.xp + xp
    const newLevel = getLevelByXp(newXp)
    const levelUps = newLevel - player.level// сколько уровней апнули

    if (levelUps > 0) {
        db.update(players)
            .set({ statPoints: sql`${players.statPoints} + ${levelUps * STAT_POINTS_PER_LEVEL}` })
            .where(eq(players.id, playerId)).run()
    }

    db.update(players).set({ xp: newXp, level: newLevel }).where(eq(players.id, playerId)).run()
    return levelUps
}
