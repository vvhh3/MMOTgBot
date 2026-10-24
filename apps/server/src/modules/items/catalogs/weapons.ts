import { getDefaultPassiveParams } from "@mmobot/shared";
import { items } from "../../../database/schema.js";
import type { InventoryDatabase } from "../../inventory/store.js";

const icon = (content: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;

const definitions: Omit<typeof items.$inferInsert, "type">[] = [
  { catalogKey: "mop", name: "Швабра", description: "Сначала помоет пол. Потом — противника.", weaponFamily: "cleaning", rarity: "common", damageCategory: "physical", damageType: "blunt", passiveId: "long_handle", damage: 3, price: 12, icon: icon('<path d="M16 3v18M8 21h16l3 8H5zM11 23l-1 4M16 23v4M21 23l1 4"/>') },
  { catalogKey: "mothers_slipper", name: "Мамин тапок", description: "Куда бы ты ни убежал, он уже летит.", weaponFamily: "footwear", rarity: "uncommon", damageCategory: "physical", damageType: "blunt", passiveId: "returning", damage: 4, price: 20, icon: icon('<path d="M10 29C4 26 6 17 9 7c2-6 11-5 14 0 3 6 3 18-2 22zM8 15c5-5 11-5 16 0M10 8c4-2 8-2 11 1"/>') },
  { catalogKey: "fate_stapler", name: "Степлер судьбы", description: "Ваше дело подшито. Вместе с вами.", weaponFamily: "stationery", rarity: "rare", damageCategory: "physical", damageType: "piercing", passiveId: "precision", damage: 5, price: 35, icon: icon('<path d="M5 25h23v4H5zM5 24V9l20 6 2 5H9M9 20v5M21 21v4"/>') },
  { catalogKey: "cursed_shawarma", name: "Проклятая шаурма", description: "Срок годности истёк. Проклятие — бессрочное.", weaponFamily: "food", rarity: "rare", damageCategory: "magical", damageType: "poison", passiveId: "questionable_freshness", damage: 6, price: 45, icon: icon('<path d="M6 10l7 20h6l7-20M6 10c0-10 20-10 20 0M9 17l14-4M11 23l10-3M10 8l3-2 4 3 5-3"/>') },
  { catalogKey: "iphone_9", name: "Айфон 9", description: "Ловит сеть даже в подземелье. В основном — коллекторов.", weaponFamily: "electronics", rarity: "epic", damageCategory: "magical", damageType: "electric", passiveId: "last_percent", damage: 7, price: 70, icon: icon('<rect x="8" y="2" width="16" height="28" rx="3"/><path d="M13 5h6M14 27h4M17 10l-4 7h6l-4 6"/>') },
  { catalogKey: "utility_bill", name: "Квитанция ЖКХ", description: "Сумма к оплате наносит непоправимый моральный ущерб.", weaponFamily: "documents", rarity: "epic", damageCategory: "magical", damageType: "psychic", passiveId: "fine_print", damage: 7, price: 70, icon: icon('<path d="M7 2h18v28l-3-2-3 2-3-2-3 2-3-2-3 2zM11 7h10M11 12h10M11 17h5M11 23h10"/>') },
  { catalogKey: "last_boil_kettle", name: "Чайник последнего кипячения", description: "Свистит так, будто знает дату конца света.", weaponFamily: "appliances", rarity: "rare", damageCategory: "magical", damageType: "heat", passiveId: "burning", damage: 6, price: 50, icon: icon('<path d="M10 13h13l3 15H7zM10 13L3 9l4 12M23 14c9-5 10 10 2 9M12 10h9M15 5V2M20 6V3"/>') },
  { catalogKey: "soul_vacuum", name: "Пылесос душ", description: "Всасывает пыль, надежды и остатки жизненных сил.", weaponFamily: "appliances", rarity: "legendary", damageCategory: "magical", damageType: "psychic", passiveId: "lifesteal", damage: 8, price: 150, icon: icon('<rect x="3" y="17" width="14" height="10" rx="4"/><path d="M10 17V9c0-8 15-8 15 1v13M21 27h8l-2-4h-4z"/><circle cx="7" cy="28" r="2"/><circle cx="14" cy="28" r="2"/>') },
];

export const WEAPON_CATALOG: (typeof items.$inferInsert)[] = definitions.map((weapon) => ({
  ...weapon, type: "weapon", shopAvailable: true, passiveParams: getDefaultPassiveParams(weapon.passiveId!),
}));

export function seedWeaponCatalog(db: InventoryDatabase): void {
  for (const item of WEAPON_CATALOG) {
    // Стабильный ключ: переименование в админке не создаёт копии при перезапуске.
    db.insert(items).values(item).onConflictDoNothing({ target: items.catalogKey }).run();
  }
}
