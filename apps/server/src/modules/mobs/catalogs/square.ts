import type { MobRank } from '@mmobot/shared';

export type SquareMob = {
  key: string; name: string; description: string; rank: MobRank; weight: number;
  maxHealth: number; strength: number; defense: number;
  attack: string; strong: string; loot: readonly string[];
};

// Level-one templates. Numeric IDs are assigned by SQLite, not reserved in code.
export const SQUARE_MOBS: readonly SquareMob[] = [
  { key: 'square_pigeon', name: 'Голубь на муниципальном довольствии', description: 'Считает каждый батон на площади своей собственностью.', rank: 'normal', weight: 24,
    maxHealth: 32, strength: 6, defense: 1, attack: 'Наглый клюв', strong: 'Налог на крошки',
    loot: ['day_before_yesterday_loaf', 'training_stick', 'graduate_brick', 'mothers_slipper', 'small_medkit'] },
  { key: 'square_bag', name: 'Пакет встречного ветра', description: 'Направление ветра меняется. Его интерес к вашему лицу — нет.', rank: 'normal', weight: 24,
    maxHealth: 30, strength: 7, defense: 1, attack: 'Шуршащий взмах', strong: 'Прямо в лицо',
    loot: ['mop', 'rusty_knife', 'leather_armor', 'independent_sock', 'mothers_soup', 'small_medkit'] },
  { key: 'square_seeds', name: 'Семечковый мимик', description: 'Пачка семечек, которая сама решила кого-нибудь пощёлкать.', rank: 'normal', weight: 22,
    maxHealth: 36, strength: 6, defense: 2, attack: 'Щелчок скорлупой', strong: 'Последняя семечка',
    loot: ['day_before_yesterday_loaf', 'tomorrow_pot', 'family_justice_pan', 'cursed_shawarma', 'small_medkit'] },
  { key: 'square_fountain', name: 'Водяной мелкого номинала', description: 'Хранитель монет фонтана. Желания исполняет только свои.', rank: 'strong', weight: 8,
    maxHealth: 60, strength: 9, defense: 3, attack: 'Мокрый подзатыльник', strong: 'Сдачи не будет',
    loot: ['apprentice_plunger', 'mop', 'last_boil_kettle', 'clear_mind_colander', 'mothers_soup', 'scrap_metal'] },
  { key: 'square_bench', name: 'Лавка «Мест нет»', description: 'Присесть нельзя. Прилечь после удара — пожалуйста.', rank: 'strong', weight: 7,
    maxHealth: 66, strength: 8, defense: 4, attack: 'Удар подлокотником', strong: 'Посиди на этом',
    loot: ['graduate_brick', 'training_stick', 'tomorrow_pot', 'family_justice_pan', 'small_medkit', 'scrap_metal'] },
  { key: 'square_poster', name: 'Афиша «Концерт вчера»', description: 'Обещает незабываемый вечер, который вы уже пропустили.', rank: 'strong', weight: 7,
    maxHealth: 58, strength: 9, defense: 3, attack: 'Бумажный порез', strong: 'Просроченный аншлаг',
    loot: ['fate_stapler', 'double_click_mouse', 'new_folder_37', 'district_extension_cord', 'yesterday_deadline_coffee'] },
  { key: 'square_golem', name: 'Папочный голем «Не по форме»', description: 'Собран из папок, печатей и справок, которых у вас нет.', rank: 'elite', weight: 4,
    maxHealth: 88, strength: 11, defense: 5, attack: 'Удар печатью', strong: 'Верните оригинал',
    loot: ['fate_stapler', 'new_folder_37', 'utility_bill', 'final_thesis_usb', 'foil_hat_pro_max', 'yesterday_deadline_coffee', 'scrap_metal'] },
  { key: 'square_speaker', name: 'Колонка «Ещё погромче»', description: 'Слышно весь город. Жалобы не слышно.', rank: 'elite', weight: 2,
    maxHealth: 82, strength: 12, defense: 3, attack: 'Бас по рёбрам', strong: 'Проверка звука',
    loot: ['district_extension_cord', 'double_click_mouse', 'eternal_caps_keyboard', 'everything_remote', 'iphone_9', 'old_rifle', 'scrap_metal'] },
  { key: 'square_ilyich', name: 'Ильич вне расписания', description: 'Вышел с постамента на внеплановый субботник.', rank: 'boss', weight: 1,
    maxHealth: 116, strength: 13, defense: 5, attack: 'Весомое указание', strong: 'Пятилетку за один удар',
    loot: ['graduate_brick', 'utility_bill', 'new_folder_37', 'final_thesis_usb', 'foil_hat_pro_max', 'district_chat_banhammer', 'entrance_chief_robe', 'primordial_dumpling', 'small_medkit'] },
  { key: 'square_fourteen', name: 'Четырка', description: 'Заниженная, бас из багажника. Приехала показать, кто главный на площади.', rank: 'boss', weight: 1,
    maxHealth: 124, strength: 12, defense: 4, attack: 'Удар бампером', strong: 'Газ в пол',
    loot: ['rusty_knife', 'leather_armor', 'old_rifle', 'last_boil_kettle', 'eternal_caps_keyboard', 'everything_remote', 'iphone_9', 'soul_vacuum', 'universe_admin_slipper', 'primordial_dumpling', 'scrap_metal'] },
];

export function squareMob(key: string | null | undefined): SquareMob | undefined {
  return SQUARE_MOBS.find(mob => mob.key === key);
}
