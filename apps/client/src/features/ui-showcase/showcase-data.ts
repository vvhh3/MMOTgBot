import {
  BATTLE_STATUS_INFO, describeBattleStatus,
  type BattlePublicState, type BattleStatusView, type ItemDto,
  type PlayerDto, type PlayerQuestDto,
} from "@mmobot/shared";

// Локальные примеры: витрина не использует аккаунт, API или игровые события.
export const demoPlayer: PlayerDto = {
  id: 0, friendId: 9002, name: "Тестовый герой", level: 8,
  xp: 340, xpLevelStart: 200, xpNextLevel: 500, points: 125,
  currentLocationId: "square", health: 76, maxHp: 100,
  strength: 24, defense: 12, statPoints: 3, idTheLastAction: null,
  money: 1250, cooldowns: {}, isCreated: true, factionId: "gamers",
  tutorialStep: "done", avatar: null,
};

const icon = (paths: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

export const demoItems: ItemDto[] = [
  {
    id: 1, catalogKey: "rusty_knife", name: "Ржавый нож", description: "Простой нож",
    type: "weapon", rarity: "rare", weaponFamily: "legacy", damageCategory: "physical",
    damageType: "piercing", passiveId: null, passiveParams: {}, damage: 18, defense: 0,
    healAmount: 0, price: 120, sellPrice: 45, minLevel: 3, shopAvailable: true,
    icon: icon('<path d="M3 29L13 19M13 19L29 3L13 19Z"/>'),
  },
  {
    id: 2, name: "Домашняя броня", description: "Защищает от неприятностей на прогулке.",
    type: "armor", rarity: "uncommon", weaponFamily: null, damageCategory: null,
    damageType: null, passiveId: null, passiveParams: {}, damage: 0, defense: 8,
    healAmount: 0, price: 90, sellPrice: 30, minLevel: 2, shopAvailable: true,
    icon: icon('<path d="M16 3L28 8v8c0 8-12 13-12 13S4 24 4 16V8z"/>'),
  },
  {
    id: 3, name: "Аптечка", description: "Поможет восстановить здоровье.",
    type: "potion", rarity: "common", weaponFamily: null, damageCategory: null,
    damageType: null, passiveId: null, passiveParams: {}, damage: 0, defense: 0,
    healAmount: 30, price: 35, sellPrice: 10, minLevel: 1, shopAvailable: true,
    icon: icon('<rect x="4" y="9" width="24" height="19" rx="3"/><path d="M11 9V4h10v5M16 14v9M12 18h8"/>'),
  },
];

export const demoQuests: PlayerQuestDto[] = [
  { id: 1, progress: 2, status: "waiting", assignedDay: "2026-10-28", quest: {
    id: 1, title: "Прогулка по району", description: "Пройдитесь по Площади и узнайте, что происходит вокруг.",
    difficulty: "easy", objectiveType: "walk", targetId: null, targetCount: 5,
    targetXp: 50, targetPoints: 10, targetCoins: 25,
  } },
  { id: 2, progress: 3, status: "completed", assignedDay: "2026-10-28", quest: {
    id: 2, title: "Есть чем гордиться", description: "Разберитесь с неприятностями на прогулке.",
    difficulty: "medium", objectiveType: "kill", targetId: null, targetCount: 3,
    targetXp: 100, targetPoints: 25, targetCoins: 60,
  } },
  { id: 3, progress: 10, status: "claimed", assignedDay: "2026-10-28", quest: {
    id: 3, title: "Задание выполнено", description: "Награда уже получена. Можно отправляться дальше.",
    difficulty: "hard", objectiveType: "collect", targetId: null, targetCount: 10,
    targetXp: 200, targetPoints: 50, targetCoins: 120,
  } },
];

export const demoMoves: Pick<BattlePublicState, "moves" | "round" | "actionSubmitted"> = {
  round: 2, actionSubmitted: false, moves: [
    { id: "normal", name: "Обычная атака", kind: "attack", priority: 0, accuracy: 95, power: 1, cooldownRounds: 0, availableFromRound: 1 },
    { id: "strong", name: "Сильный удар", kind: "attack", priority: 0, accuracy: 80, power: 1.5, cooldownRounds: 2, availableFromRound: 4 },
    { id: "defend", name: "Защита", kind: "defend", priority: 1, accuracy: 100, power: 0, cooldownRounds: 1, availableFromRound: 1,
      defense: { fullBlockChance: 25, partialBlockChance: 40, partialMultiplier: 0.5, reflectChance: 10 } },
  ],
};

export const demoStatuses: BattleStatusView[] = Object.entries(BATTLE_STATUS_INFO).map(([kind, info]) => {
  const typedKind = kind as BattleStatusView["kind"];
  return {
    kind: typedKind, ...info, value: typedKind === "shield" ? 20 : 10,
    remainingRounds: ["aim", "attack_boost", "armor_piercing", "psychic_charge"].includes(kind) ? null : 2,
    stacks: typedKind === "debt" ? 2 : undefined,
    description: describeBattleStatus(typedKind, typedKind === "shield" ? 20 : 10),
  };
});
