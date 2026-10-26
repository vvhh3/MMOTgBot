import { HEALING_BALANCE,ITEM_BALANCE } from '@mmobot/shared';
import type { items } from '../../../database/schema.js';

// Applies only to newly seeded catalogue definitions. Existing records are migrated once.
export function balanceCatalogItem(item: typeof items.$inferInsert): typeof items.$inferInsert {
  const tier = ITEM_BALANCE[item.rarity ?? 'common'];
  if (item.type === 'weapon') return { ...item, damage: tier.damage, price: tier.price, sellPrice: tier.sellPrice };
  if (item.type === 'armor') return { ...item, defense: tier.defense, price: tier.price, sellPrice: tier.sellPrice };
  if (item.type === 'potion') {
    const healing = HEALING_BALANCE[(item.rarity ?? 'common') as keyof typeof HEALING_BALANCE];
    if (healing) return { ...item, ...healing };
  }
  return item;
}
