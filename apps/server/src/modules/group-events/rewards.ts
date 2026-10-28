import { eq, sql } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { groupEventRewards, items, players, type GroupEventRunRow } from '../../database/schema.js';
import { nowGameTime } from '../../shared/time.js';
import { rollLoot } from '../combat/loot.js';
import { grantItems } from '../inventory/store.js';
import { addXpForPlayer } from '../players/level.js';
import { progressQuests } from '../quests/routes.js';

// Called only in the same transaction that changes active -> victory.
export function grantGroupRewards(run: GroupEventRunRow) {
  const reward = run.configSnapshot.reward;
  for (const fighter of run.battleState.fighters.filter(f => f.playerId && !f.left)) {
    const playerId = fighter.playerId!;
    const awarded = rollLoot(reward.loot).map(itemType => {
      const item = db.select().from(items).where(eq(items.id, itemType)).get();
      if (!item) throw new Error('Предмет награды больше не существует');
      grantItems(db, playerId, itemType);
      progressQuests(playerId, 'collect', itemType); progressQuests(playerId, 'loot', itemType);
      return { itemType, name: item.name, quantity: 1 };
    });
    db.insert(groupEventRewards).values({ runId: run.id, eventWindowId: run.eventWindowId, playerId,
      xp: reward.xp, points: reward.points, coins: reward.coins, items: awarded, grantedAt: nowGameTime() }).run();
    addXpForPlayer(playerId, reward.xp);
    db.update(players).set({ money: sql`${players.money} + ${reward.coins}`, points: sql`${players.points} + ${reward.points}` }).where(eq(players.id, playerId)).run();
  }
}
