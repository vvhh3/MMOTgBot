import type { ItemRarity } from './weapons.js';

// Initial item level. Upgrades and future passive effects do not modify this profile.
export const ITEM_BALANCE: Record<ItemRarity, {
  minLevel: number; damage: number; defense: number; price: number; sellPrice: number;
  strongPower: number; strongAccuracy: number;
  fullBlockChance: number; partialBlockChance: number; reflectChance: number;
}> = {
  common: { minLevel: 1, damage: 2, defense: 1, price: 50, sellPrice: 5, strongPower: 1.4, strongAccuracy: 80, fullBlockChance: 35, partialBlockChance: 55, reflectChance: 30 },
  uncommon: { minLevel: 2, damage: 3, defense: 2, price: 300, sellPrice: 20, strongPower: 1.45, strongAccuracy: 82, fullBlockChance: 37, partialBlockChance: 53, reflectChance: 32 },
  rare: { minLevel: 3, damage: 4, defense: 3, price: 2500, sellPrice: 100, strongPower: 1.5, strongAccuracy: 84, fullBlockChance: 40, partialBlockChance: 50, reflectChance: 34 },
  epic: { minLevel: 5, damage: 5, defense: 4, price: 20000, sellPrice: 500, strongPower: 1.55, strongAccuracy: 86, fullBlockChance: 42, partialBlockChance: 50, reflectChance: 36 },
  legendary: { minLevel: 7, damage: 6, defense: 5, price: 150000, sellPrice: 5000, strongPower: 1.6, strongAccuracy: 88, fullBlockChance: 45, partialBlockChance: 50, reflectChance: 38 },
};

export const HEALING_BALANCE = {
  common: { healAmount: 15, price: 15, sellPrice: 3 },
  uncommon: { healAmount: 25, price: 40, sellPrice: 8 },
  rare: { healAmount: 35, price: 100, sellPrice: 20 },
  legendary: { healAmount: 45, price: 600, sellPrice: 100 },
} as const;

export function getItemMinLevel(item: { type: string; rarity: ItemRarity }): number {
  return ['weapon', 'armor', 'potion'].includes(item.type) ? ITEM_BALANCE[item.rarity].minLevel : 1;
}

export const ITEM_ATTACK_NAMES: Record<string, [string, string]> = {
  "rusty_knife": ["Укол", "Отчаянный выпад"],
  "old_rifle": ["Выстрел", "Выстрел с упора"],
  "training_stick": ["Тычок палкой", "Размашистый замах"],
  "mop": ["Тычок рукоятью", "Генеральная уборка"],
  "mothers_slipper": ["Шлепок", "Я кому сказала!"],
  "fate_stapler": ["Щелчок", "Дело закрыто"],
  "cursed_shawarma": ["Несвежий удар", "Двойной острый"],
  "iphone_9": ["Удар корпусом", "Последний процент"],
  "utility_bill": ["Сумма к оплате", "Перерасчёт за десять лет"],
  "last_boil_kettle": ["Горячий тычок", "Последнее кипячение"],
  "soul_vacuum": ["Всасывание", "Генеральная уборка души"],
  "graduate_brick": ["Весомый аргумент", "Защита диплома"],
  "day_before_yesterday_loaf": ["Удар корочкой", "Хлебный нокаут"],
  "apprentice_plunger": ["Сантехнический тычок", "Великий прочист"],
  "family_justice_pan": ["Звонкий удар", "Приговор без обжалования"],
  "district_extension_cord": ["Удар проводом", "Перегрузка сети"],
  "independent_sock": ["Несвежий взмах", "Неделя без стирки"],
  "double_click_mouse": ["Клик", "Двойной клик"],
  "new_folder_37": ["Удар папкой", "Архив на голову"],
  "eternal_caps_keyboard": ["Нажатие клавиши", "Я НЕ КРИЧУ!"],
  "everything_remote": ["Щелчок по лбу", "Заводские настройки"],
  "final_thesis_usb": ["Контактный удар", "Финал_точно_последний"],
  "district_chat_banhammer": ["Замечание", "Перманентный бан"],
  "universe_admin_slipper": ["Предупреждение", "Исправление реальности"],
};
export const ITEM_GUARD_NAMES: Record<string, string> = {
  "leather_armor": "Глухая стойка",
  "tomorrow_pot": "Ужин под защитой",
  "clear_mind_colander": "Мысли стекают",
  "foil_hat_pro_max": "Сигнал не проходит",
  "entrance_chief_robe": "Я здесь главный"
};

