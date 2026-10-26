import { balanceCatalogItem } from "./balance.js";
import { getDefaultPassiveParams } from "@mmobot/shared";
import { items } from "../../../database/schema.js";
import type { InventoryDatabase } from "../../inventory/store.js";

const icon = (content: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;

// Согласованный второй набор: по четыре предмета каждой редкости.
// damage/defense/healAmount работают сейчас; passiveId/Params — будущие эффекты.
const definitions: (typeof items.$inferInsert)[] = [
  {
    catalogKey: "graduate_brick", name: "Кирпич с дипломом", description: "Окончил строительный с отличием. Теперь аргументирует лично.",
    type: "weapon", rarity: "common", weaponFamily: "household", damageCategory: "physical", damageType: "blunt",
    passiveId: "weighty_argument",
    icon: icon('<path d="M3 15l17-6 9 5-17 6zM3 15v9l9 5 17-10v-5M12 20v9M8 13l8 4M17 10l8 5"/><path d="M7 6l6-3 6 3-6 3zM9 7v4M17 7v4"/>'),
  },
  {
    catalogKey: "day_before_yesterday_loaf", name: "Батон позавчерашний", description: "Свежесть закончилась. Несущая способность осталась.",
    type: "weapon", rarity: "common", weaponFamily: "food", damageCategory: "physical", damageType: "blunt",
    passiveId: "stale_crust",
    icon: icon('<path d="M6 27c-4-4 0-10 7-17S25 1 28 5s-2 10-9 17S9 30 6 27zM14 9l6 5M9 15l6 5M20 5l5 4"/>'),
  },
  {
    catalogKey: "apprentice_plunger", name: "Вантуз начинающего мага", description: "Первое заклинание — призыв сантехника. Второе пока прилипло.",
    type: "weapon", rarity: "common", weaponFamily: "cleaning", damageCategory: "physical", damageType: "blunt",
    passiveId: "suction",
    icon: icon('<path d="M16 3v17M12 20h8l5 8H7zM5 29h22M12 3h8"/>'),
  },
  {
    catalogKey: "tomorrow_pot", name: "Кастрюля «Не трогай, на завтра»", description: "Защищает голову и остатки ужина. Приоритеты расставляет мама.",
    type: "armor", rarity: "common", passiveId: "saved_for_tomorrow",
    icon: icon('<path d="M7 13h18v11c0 5-18 5-18 0zM7 16H3v6h4M25 16h4v6h-4M6 11h20M13 8h6v3"/>'),
  },
  {
    catalogKey: "family_justice_pan", name: "Сковорода семейного правосудия", description: "Судебное заседание открыто. Приговор подаётся горячим.",
    type: "weapon", rarity: "uncommon", weaponFamily: "kitchen", damageCategory: "physical", damageType: "blunt",
    passiveId: "family_justice",
    icon: icon('<circle cx="19" cy="12" r="9"/><circle cx="19" cy="12" r="6"/><path d="M12 19L3 28l3 2 9-9"/>'),
  },
  {
    catalogKey: "district_extension_cord", name: "Удлинитель на полрайона", description: "Одна розетка, три подъезда и очень уверенный электрик.",
    type: "weapon", rarity: "uncommon", weaponFamily: "electronics", damageCategory: "magical", damageType: "electric",
    passiveId: "short_circuit",
    icon: icon('<rect x="4" y="5" width="12" height="22" rx="3"/><circle cx="10" cy="11" r="3"/><circle cx="10" cy="21" r="3"/><path d="M16 16h5c9 0 8 12 2 12-7 0-6-9 0-9M23 8V4M27 8V4M21 8h8v5h-8z"/>'),
  },
  {
    catalogKey: "independent_sock", name: "Носок самостоятельной жизни", description: "Ушёл от хозяина. Снял квартиру. Вернулся с микрофлорой.",
    type: "weapon", rarity: "uncommon", weaponFamily: "footwear", damageCategory: "magical", damageType: "poison",
    passiveId: "independent_life",
    icon: icon('<path d="M15 3h10v17c0 5-4 9-9 9H7c-7 0-6-9 0-9h8zM15 8h10M19 20l5 4M6 20v9M7 4l2 3-2 3"/>'),
  },
  {
    catalogKey: "mothers_soup", name: "Суп «Мама передала»", description: "В банке помещаются обед, забота и три напоминания надеть шапку.",
    type: "potion", rarity: "uncommon", passiveId: "mothers_care",
    icon: icon('<path d="M3 15h26c-1 10-6 14-13 14S4 25 3 15zM7 29h18M9 10c-3-4 3-4 0-8M16 10c-3-4 3-4 0-8M23 10c-3-4 3-4 0-8"/>'),
  },
  {
    catalogKey: "double_click_mouse", name: "Мышка с двойным кликом", description: "Один удар по цене двух. Гарантия закончилась вчера.",
    type: "weapon", rarity: "rare", weaponFamily: "electronics", damageCategory: "physical", damageType: "blunt",
    passiveId: "double_click",
    icon: icon('<rect x="8" y="9" width="16" height="21" rx="8"/><path d="M16 9V3c0-2 6-2 6 1M8 18h16M16 9v9M28 7l2-2M27 12h4"/>'),
  },
  {
    catalogKey: "new_folder_37", name: "Папка «Новая папка (37)»", description: "Внутри ещё 36 папок. Где-то там лежит смысл жизни.",
    type: "weapon", rarity: "rare", weaponFamily: "documents", damageCategory: "magical", damageType: "psychic",
    passiveId: "lost_in_folders",
    icon: icon('<path d="M3 26V7h10l3 4h13v15zM3 15h26M10 19h4l-2 3 2 2h-4M18 19h5l-3 5"/>'),
  },
  {
    catalogKey: "clear_mind_colander", name: "Дуршлаг ясного разума", description: "Макароны остаются. Плохие мысли стекают.",
    type: "armor", rarity: "rare", passiveId: "clear_mind",
    icon: icon('<path d="M5 24C5 2 27 2 27 24zM2 24h28M10 13h1M16 11h1M22 13h1M10 19h1M16 18h1M22 19h1"/>'),
  },
  {
    catalogKey: "yesterday_deadline_coffee", name: "Кофе «Дедлайн вчера»", description: "Бодрящий глоток возвращает 35 HP. Дедлайн всё ещё вчера.",
    type: "potion", rarity: "rare", shopAvailable: true,
    icon: icon('<path d="M5 11h17v12c0 8-17 8-17 0zM22 13h4c7 0 6 10-4 9M3 30h23M9 7V3M15 7V2M19 7V4"/>'),
  },
  {
    catalogKey: "eternal_caps_keyboard", name: "Клавиатура вечного CAPS LOCK", description: "Я НЕ КРИЧУ. ЭТО У МЕНЯ ТАКОЙ БИЛД.",
    type: "weapon", rarity: "epic", weaponFamily: "electronics", damageCategory: "magical", damageType: "psychic",
    passiveId: "caps_lock",
    icon: icon('<rect x="2" y="10" width="28" height="17" rx="2"/><path d="M6 15h2M12 15h2M18 15h2M24 15h2M6 20h2M12 20h2M18 20h2M24 20h2M9 24h14M16 10V3h7"/>'),
  },
  {
    catalogKey: "everything_remote", name: "Пульт от всего, кроме телевизора", description: "Выключил бафф, свет в подъезде и чью-то мотивацию.",
    type: "weapon", rarity: "epic", weaponFamily: "electronics", damageCategory: "magical", damageType: "psychic",
    passiveId: "mute_button",
    icon: icon('<rect x="9" y="3" width="14" height="27" rx="4"/><circle cx="16" cy="10" r="3"/><path d="M13 17h1M18 17h1M13 22h1M18 22h1M14 27h4M16 1v2"/>'),
  },
  {
    catalogKey: "foil_hat_pro_max", name: "Шапочка из фольги PRO MAX", description: "Блокирует внушение, здравый смысл и местный Wi-Fi.",
    type: "armor", rarity: "epic", passiveId: "foil_reflection",
    icon: icon('<path d="M3 27L10 12l6-9 5 12 8 12zM10 12l6 15 5-12M3 27h26M16 3v8"/>'),
  },
  {
    catalogKey: "final_thesis_usb", name: "Флешка «Курсовая_финал_точно»", description: "Версия 48. Научный руководитель ещё печатает.",
    type: "weapon", rarity: "epic", weaponFamily: "electronics", damageCategory: "magical", damageType: "psychic",
    passiveId: "final_revision",
    icon: icon('<rect x="8" y="12" width="16" height="18" rx="3"/><path d="M11 12V2h10v10M14 5v3M18 5v3M12 22h8M16 18v8"/>'),
  },
  {
    catalogKey: "district_chat_banhammer", name: "Банхаммер районного чата", description: "За нарушение пункта 3.14. Сам пункт никто не видел.",
    type: "weapon", rarity: "legendary", weaponFamily: "household", damageCategory: "physical", damageType: "blunt",
    passiveId: "chat_ban",
    icon: icon('<path d="M12 15L4 27l4 3 9-13M9 7l6-5 14 11-5 6zM15 6l8 7M7 9l-4 2M27 23l3 3"/>'),
  },
  {
    catalogKey: "universe_admin_slipper", name: "Тапок администратора вселенной", description: "Промах был запланирован. Теперь начинается исправление реальности.",
    type: "weapon", rarity: "legendary", weaponFamily: "footwear", damageCategory: "physical", damageType: "blunt",
    passiveId: "admin_aim",
    icon: icon('<path d="M10 29C4 27 6 17 9 11c3-5 12-5 15 1 3 6 1 16-3 17zM8 18c5-5 11-5 16 0M10 5l2 2 4-5 4 5 2-2v5H10z"/>'),
  },
  {
    catalogKey: "entrance_chief_robe", name: "Халат главного по подъезду", description: "Ключи от всех дверей. Мнение по всем вопросам.",
    type: "armor", rarity: "legendary", passiveId: "veteran_resident",
    icon: icon('<path d="M10 3l6 5 6-5 8 10-5 4-3-4 2 17H8l2-17-3 4-5-4zM10 3l9 15M22 3l-9 15M9 19h14M16 19v10"/>'),
  },
  {
    catalogKey: "primordial_dumpling", name: "Пельмень первозданный", description: "Последний в пачке. Первый среди богов. Сметана приобретается отдельно.",
    type: "potion", rarity: "legendary", passiveId: "primordial_dumpling",
    icon: icon('<path d="M4 21c0-13 24-13 24 0 0 10-24 10-24 0zM8 20c3-7 13-7 16 0M8 20l-3 3M13 17l-1 5M19 17l1 5M24 20l3 3"/><ellipse cx="16" cy="5" rx="7" ry="2"/>'),
  },
];

export const MEME_ITEM_CATALOG: (typeof items.$inferInsert)[] = definitions.map((item) => balanceCatalogItem({
  shopAvailable: true,
  ...item,
  passiveParams: item.passiveId ? getDefaultPassiveParams(item.passiveId) : {},
}));

export function seedMemeItemCatalog(db: InventoryDatabase): void {
  for (const item of MEME_ITEM_CATALOG) {
    db.insert(items).values(item).onConflictDoNothing({ target: items.catalogKey }).run();
  }
}
