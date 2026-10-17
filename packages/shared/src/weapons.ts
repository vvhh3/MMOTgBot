// Метаданные будущей боевой системы. Сейчас урон использует прежнюю формулу,
// уровень, категория, разновидность урона и пассивки её не изменяют.
export const ITEM_RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type ItemRarity = typeof ITEM_RARITIES[number];
export const RARITY_LABELS: Record<ItemRarity, string> = {
  common: "Обычное", uncommon: "Необычное", rare: "Редкое", epic: "Эпическое", legendary: "Легендарное",
};
export const RARITY_COLORS: Record<ItemRarity, string> = {
  common: "#64748b", uncommon: "#15803d", rare: "#2563eb", epic: "#9333ea", legendary: "#c2410c",
};
export const WEAPON_FAMILIES = ["legacy", "cleaning", "electronics", "footwear", "documents", "food", "stationery", "appliances", "household", "kitchen"] as const;
export type WeaponFamily = typeof WEAPON_FAMILIES[number];
export const WEAPON_FAMILY_LABELS: Record<WeaponFamily, string> = {
  legacy: "Прочее оружие", cleaning: "Уборочный инвентарь", electronics: "Электроника", footwear: "Тапки и носки",
  documents: "Документы", food: "Проклятая еда", stationery: "Канцелярия", appliances: "Бытовая техника",
  household: "Домашние инструменты", kitchen: "Кухонная утварь",
};
export const DAMAGE_CATEGORIES = ["physical", "magical"] as const;
export type DamageCategory = typeof DAMAGE_CATEGORIES[number];
export const DAMAGE_CATEGORY_LABELS: Record<DamageCategory, string> = { physical: "Физический", magical: "Магический" };
export const DAMAGE_TYPES = ["blunt", "piercing", "slashing", "electric", "poison", "psychic", "heat", "cold"] as const;
export type DamageType = typeof DAMAGE_TYPES[number];
export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  blunt: "Дробящий", piercing: "Колющий", slashing: "Рубящий", electric: "Электрический",
  poison: "Ядовитый", psychic: "Психический", heat: "Тепловой", cold: "Ледяной",
};
export const DAMAGE_TYPES_BY_CATEGORY: Record<DamageCategory, readonly DamageType[]> = {
  physical: ["blunt", "piercing", "slashing"], magical: ["electric", "poison", "psychic", "heat", "cold"],
};

type PassiveParameter = { label: string; default: number; min: number; max: number };
type PassiveDefinition = {
  name: string;
  itemTypes?: readonly ("weapon" | "armor" | "potion")[]; // по умолчанию — только оружие
  parameters: Record<string, PassiveParameter>;
  describe: (parameters: Record<string, number>) => string;
};
const percent = (label: string, value: number): PassiveParameter => ({ label, default: value, min: 1, max: 100 });
export const ITEM_PASSIVES = {
  long_handle: {
    name: "Длинная ручка", parameters: { armorIgnorePercent: percent("Игнорирование брони, %", 10) },
    describe: (p) => `После защиты, ослабившей удар, следующая атака игнорирует ${p.armorIgnorePercent}% брони. Бонус не накапливается.`,
  },
  returning: {
    name: "Возвращается сам", parameters: { damageBonusPercent: percent("Усиление второй атаки, %", 10) },
    describe: (p) => `Чередование двух разных атакующих приёмов усиливает второй на ${p.damageBonusPercent}%. Дополнительного удара нет.`,
  },
  precision: {
    name: "Канцелярская точность", parameters: { criticalChancePercent: percent("Бонус к шансу крита, п.п.", 5) },
    describe: (p) => `Повышает шанс критического прямого удара на ${p.criticalChancePercent} п.п.`,
  },
  questionable_freshness: {
    name: "Сомнительная свежесть", parameters: { healingReductionPercent: percent("Снижение лечения, %", 15) },
    describe: (p) => `Пока цель отравлена этим оружием, получаемое ею лечение слабее на ${p.healingReductionPercent}%.`,
  },
  last_percent: {
    name: "Последний процент", parameters: { healthThresholdPercent: percent("Порог здоровья, %", 30), damageBonusPercent: percent("Усиление атаки, %", 20) },
    describe: (p) => `Один раз за бой: если перед атакой здоровье ниже ${p.healthThresholdPercent}%, её прямой урон выше на ${p.damageBonusPercent}%.`,
  },
  fine_print: {
    name: "Мелкий шрифт", parameters: {},
    describe: () => "Первый защитный приём противника за бой добавляет одну метку долга, в пределах общего лимита двух меток.",
  },
  burning: {
    name: "Накипело", parameters: { chancePercent: percent("Шанс поджога, %", 20), durationRounds: { label: "Длительность, раунды", default: 2, min: 1, max: 5 }, damageCoefficientPercent: percent("Урон за тик от атакующей мощности, %", 10) },
    describe: (p) => `Прямое попадание с шансом ${p.chancePercent}% накладывает ожог на ${p.durationRounds} раунда. Каждый тик наносит ${p.damageCoefficientPercent}% атакующей мощности тепловым уроном до защиты. Повторное наложение обновляет срок.`,
  },
  lifesteal: {
    name: "Обратная тяга", parameters: { chancePercent: percent("Шанс вампиризма, %", 25), healingPercent: percent("Лечение от нанесённого урона, %", 20) },
    describe: (p) => `Прямое попадание с шансом ${p.chancePercent}% восстанавливает ${p.healingPercent}% фактически снятого у цели здоровья, не выше максимума владельца.`,
  },
  weighty_argument: {
    name: "Весомый аргумент", parameters: { damageBonusPercent: percent("Урон по защищающейся цели, %", 15) },
    describe: (p) => `Прямой урон по цели, выбравшей защиту, увеличен на ${p.damageBonusPercent}%.`,
  },
  stale_crust: {
    name: "Каменная корочка", parameters: { chancePercent: percent("Шанс, %", 15), armorIgnorePercent: percent("Игнорирование брони, %", 20) },
    describe: (p) => `Попадание с шансом ${p.chancePercent}% игнорирует ${p.armorIgnorePercent}% брони цели.`,
  },
  suction: {
    name: "Не отлипает", parameters: { chancePercent: percent("Шанс, %", 15), damageReductionPercent: percent("Ослабление атаки, %", 15) },
    describe: (p) => `Попадание с шансом ${p.chancePercent}% ослабляет следующую прямую атаку цели на ${p.damageReductionPercent}%. Повторное наложение не складывается.`,
  },
  saved_for_tomorrow: {
    name: "Это на завтра", itemTypes: ["armor"], parameters: { damageReductionPercent: percent("Снижение первого урона, %", 15) },
    describe: (p) => `Первый полученный прямой удар за бой наносит на ${p.damageReductionPercent}% меньше урона.`,
  },
  family_justice: {
    name: "Семейное правосудие", parameters: { damageBonusPercent: percent("Усиление удара, %", 20) },
    describe: (p) => `После защитного действия следующий прямой удар сильнее на ${p.damageBonusPercent}%. Бонус не накапливается.`,
  },
  short_circuit: {
    name: "Короткое замыкание", parameters: { chancePercent: percent("Шанс разряда, %", 20), damageCoefficientPercent: percent("Разряд от атаки, %", 15), wetBonusPercent: percent("Усиление по мокрой цели, %", 50) },
    describe: (p) => `Попадание с шансом ${p.chancePercent}% добавляет электрический урон в размере ${p.damageCoefficientPercent}% атаки до защиты. По мокрой цели разряд сильнее на ${p.wetBonusPercent}%.`,
  },
  independent_life: {
    name: "Оно живое", parameters: { chancePercent: percent("Шанс отравления, %", 20), durationRounds: { label: "Длительность, раунды", default: 2, min: 1, max: 5 }, damageCoefficientPercent: percent("Урон за тик от атаки, %", 10) },
    describe: (p) => `Попадание с шансом ${p.chancePercent}% отравляет на ${p.durationRounds} раунда: ${p.damageCoefficientPercent}% атаки за тик до защиты. Повторное наложение обновляет срок.`,
  },
  mothers_care: {
    name: "Мамина забота", itemTypes: ["potion"], parameters: { durationRounds: { label: "Длительность, раунды", default: 3, min: 1, max: 5 }, healingPercent: percent("Лечение от максимального HP за раунд, %", 8) },
    describe: (p) => `Восстанавливает ${p.healingPercent}% максимального HP за раунд в течение ${p.durationRounds} раундов. Повторное применение обновляет срок.`,
  },
  double_click: {
    name: "Двойной клик", parameters: { chancePercent: percent("Шанс второго удара, %", 20), damageCoefficientPercent: percent("Урон второго удара, %", 30) },
    describe: (p) => `Попадание с шансом ${p.chancePercent}% вызывает дополнительный удар с ${p.damageCoefficientPercent}% мощности основного. Дополнительный удар не запускает пассивки.`,
  },
  lost_in_folders: {
    name: "Потерялся", parameters: { chancePercent: percent("Шанс, %", 20), accuracyReductionPercent: percent("Снижение точности, п.п.", 15) },
    describe: (p) => `Попадание с шансом ${p.chancePercent}% снижает точность следующей атаки цели на ${p.accuracyReductionPercent} п.п. Эффект не складывается.`,
  },
  clear_mind: {
    name: "Мысли стекают", itemTypes: ["armor"], parameters: { damageReductionPercent: percent("Снижение психического урона, %", 20) },
    describe: (p) => `Уменьшает получаемый психический урон на ${p.damageReductionPercent}%.`,
  },
  caffeine_credit: {
    name: "Скорость в кредит", itemTypes: ["potion"], parameters: { speedBonusPercent: percent("Ускорение, %", 25), durationRounds: { label: "Длительность ускорения, раунды", default: 2, min: 1, max: 5 }, slowdownPercent: percent("Последующее замедление, %", 15) },
    describe: (p) => `Повышает скорость на ${p.speedBonusPercent}% на ${p.durationRounds} раунда, затем снижает её на ${p.slowdownPercent}% на один раунд. Повторное применение не складывается.`,
  },
  caps_lock: {
    name: "Я НЕ КРИЧУ", parameters: { damageBonusPerHitPercent: percent("Усиление за попадание, %", 5), maxStacks: { label: "Максимум усилений", default: 3, min: 1, max: 5 } },
    describe: (p) => `Каждое последовательное попадание усиливает следующий психический удар на ${p.damageBonusPerHitPercent}%, до ${p.maxStacks} усилений. Промах сбрасывает накопление.`,
  },
  mute_button: {
    name: "Кнопка MUTE", parameters: { chancePercent: percent("Шанс снятия усиления, %", 15) },
    describe: (p) => `Попадание с шансом ${p.chancePercent}% снимает одно случайное временное положительное усиление цели. Постоянные свойства не снимаются.`,
  },
  foil_reflection: {
    name: "Сигнал не проходит", itemTypes: ["armor"], parameters: { chancePercent: percent("Шанс отражения, %", 25) },
    describe: (p) => `С шансом ${p.chancePercent}% отражает страх или замешательство в наложившего их противника. Отражённый эффект повторно не отражается.`,
  },
  final_revision: {
    name: "Последняя правка", parameters: { hitsRequired: { label: "Попаданий до срабатывания", default: 3, min: 2, max: 10 }, damageCoefficientPercent: percent("Дополнительный урон от атаки, %", 30) },
    describe: (p) => `Каждое ${p.hitsRequired}-е успешное прямое попадание добавляет психический урон в размере ${p.damageCoefficientPercent}% атаки до защиты. Счётчик обнуляется после срабатывания.`,
  },
  chat_ban: {
    name: "Пункт 3.14", parameters: { chancePercent: percent("Шанс блокировки, %", 15), durationRounds: { label: "Длительность, раунды", default: 1, min: 1, max: 3 } },
    describe: (p) => `Попадание с шансом ${p.chancePercent}% блокирует пассивку оружия противника на ${p.durationRounds} раунда. Повторное наложение обновляет срок.`,
  },
  admin_aim: {
    name: "Я всё вижу", parameters: { accuracyBonusPercent: percent("Бонус точности, п.п.", 25), damageBonusPercent: percent("Усиление удара, %", 20) },
    describe: (p) => `После промаха следующая атака получает +${p.accuracyBonusPercent} п.п. точности и +${p.damageBonusPercent}% урона. Бонус расходуется на эту атаку и не складывается.`,
  },
  veteran_resident: {
    name: "Я здесь сорок лет живу", itemTypes: ["armor"], parameters: { healthThresholdPercent: percent("Порог HP, %", 30), shieldPercent: percent("Щит от максимального HP, %", 20) },
    describe: (p) => `Один раз за бой: если после удара владелец жив и его HP ниже ${p.healthThresholdPercent}%, даёт щит на ${p.shieldPercent}% максимального HP на два раунда.`,
  },
  primordial_dumpling: {
    name: "Последний в пачке", itemTypes: ["potion"], parameters: { healingPercent: percent("Лечение от максимального HP, %", 50) },
    describe: (p) => `Один раз за бой восстанавливает ${p.healingPercent}% максимального HP и снимает один случайный отрицательный эффект.`,
  },
} satisfies Record<string, PassiveDefinition>;
export type ItemPassiveId = keyof typeof ITEM_PASSIVES;
export const ITEM_PASSIVE_IDS = Object.keys(ITEM_PASSIVES) as ItemPassiveId[];
export function getPassiveDefinition(id: ItemPassiveId): PassiveDefinition { return ITEM_PASSIVES[id]; }
export function getPassiveIdsForType(type: string): ItemPassiveId[] {
  return ITEM_PASSIVE_IDS.filter((id) => (getPassiveDefinition(id).itemTypes ?? ["weapon"]).some((allowed) => allowed === type));
}
// Совместимость с первоначальным API свойств оружия.
export type WeaponPassiveId = ItemPassiveId;
export const WEAPON_PASSIVES = ITEM_PASSIVES;
export const WEAPON_PASSIVE_IDS = getPassiveIdsForType("weapon");
export function getDefaultPassiveParams(id: WeaponPassiveId): Record<string, number> {
  return Object.fromEntries(Object.entries(getPassiveDefinition(id).parameters).map(([key, value]) => [key, value.default]));
}
export type WeaponProperties = {
  rarity: ItemRarity;
  weaponFamily: WeaponFamily | null;
  damageCategory: DamageCategory | null;
  damageType: DamageType | null;
  passiveId: WeaponPassiveId | null;
  passiveParams: Record<string, number>;
};
