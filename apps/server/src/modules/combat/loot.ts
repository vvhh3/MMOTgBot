import type { MobLootEntry } from "@mmobot/shared";

// Старые API-клиенты могут прислать ID без шанса: это гарантированная добыча.
export function parseLoot(value: unknown): MobLootEntry[] {
  if (!Array.isArray(value)) throw new Error("Лут должен быть массивом предметов с шансом выпадения");
  return value.map((entry) => {
    const itemType = typeof entry === "number" ? entry : entry?.itemType;
    const chancePercent = typeof entry === "number" ? 100 : entry?.chancePercent;
    if (!Number.isSafeInteger(itemType) || itemType < 1) throw new Error("Укажите корректный ID предмета в луте");
    if (typeof chancePercent !== "number" || !Number.isFinite(chancePercent) || chancePercent < 0 || chancePercent > 100) {
      throw new Error("Шанс выпадения должен быть числом от 0 до 100%");
    }
    return { itemType, chancePercent };
  });
}

// Независимые проверки: может выпасть всё, несколько предметов или ничего.
// 0% никогда не выпадает; 100% не требует случайного числа.
export function rollLoot(loot: readonly MobLootEntry[], random: () => number = Math.random): number[] {
  return loot.filter(({ chancePercent }) => chancePercent === 100 ||
    (chancePercent > 0 && random() < chancePercent / 100)).map(({ itemType }) => itemType);
}
