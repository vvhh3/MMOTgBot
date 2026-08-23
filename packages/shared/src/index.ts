export type PlayerDto = { // описание игрока
  id: number
  name: string
  level: number
  xp: number
  xpLevelStart: number // сколько XP нужно было для текущего уровня (начало прогресс-бара)
  xpNextLevel: number | null // сколько XP нужно для следующего уровня (null = максимальный уровень)
  points: number
  currentLocationId: string | null
  health: number
  maxHp: number
  strength: number
  defense: number
  statPoints: number // нераспределённые очки характеристик (тратятся на прокачку статов)
};

// какую характеристику поднять за одно очко (POST /me/stats)
export type StatType = "maxHealth" | "strength" | "defense"

export type SpendStatPointRequest = {
  stat: StatType
}

export type MobDto = { // описание мобов
  id: number
  name: string
  description: string
  level: number
  maxHealth: number
  strength: number
  defense: number
  loot: number[]
  pointsReward: number
  locationId: string
  respawnSeconds: number
}

export type MobsResponse = {
  mobs: MobDto[]
}

export type MobResponse = {
  mob: MobDto
}


export type CombatLogEntry = { // типо логирование
  text: string;
  at: string;
}

export type CombatStateResponse = { // описание боя 
  mob: MobDto;
  playerHp: number;
  playerMaxHp: number;
  mobHp: number;
  mobMaxHp: number;
  status: "active" | "victory" | "defeat" | "fled";
  log: CombatLogEntry[];
}

export type CombatStartRequest = {
  mobId: string;
}

export type CombatActionRequest = {
  action: "attack" | "flee" | "use";
  itemType?: number;
}


export type CombatActionResponse = {
  state: CombatStateResponse;
  player: PlayerDto;
  inventory: InventoryItemDto[];
}


export type ItemDto = {
  id: number
  name: string
  description: string
  type: "weapon" | "armor" | "potion" | "material" | "other"
  damage: number
  defense: number
  healAmount: number
  price: number
}

export type ItemsResponse = {
  items: ItemDto[]
}

export type ItemResponse = {
  item: ItemDto
}


export type InventoryItemDto = {
  id: number
  itemType: number
  quantity: number
  acquiredAt: string
  equiped: boolean
}

export type LocationDto = {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
}

export type ActionDto = {
  id: string;
  label: string;
  description: string;
};

export type EventDto = {
  id: number;
  playerId: number;
  playerName: string;
  locationId: string;
  type: string;
  createdAt: string;
};

export type AuthRequest = {
  initData: string;
};

export type AuthResponse = {
  token: string;
  player: PlayerDto;
};

export type MeResponse = {
  player: PlayerDto;
  inventory: InventoryItemDto[];
};

export type LocationsResponse = {
  locations: LocationDto[];
}

export type LocationStateResponse = {
  location: LocationDto;
  players: PlayerDto[];
  actions: ActionDto[];
  mobs: MobDto[];
  recentEvents: EventDto[];
  serverTime: string;
}

export type EnterLocationResponse = {
  player: PlayerDto;
  state: LocationStateResponse;
}

export type LocationActionRequest = {
  actionId: "fight" | "walk"; // сражаться | прогуляться
}

export type LocationActionResponse = {
  message: string;
  player: PlayerDto;
  inventory: InventoryItemDto[];
  event: EventDto;
}

export type ApiErrorResponse = {
  error: string;
}

// === Типизированные socket.io события ===
// ServerToClientEvents — что сервер отправляет клиенту
// ClientToServerEvents — что клиент отправляет серверу

export type ServerToClientEvents = {
  locationState: (state: LocationStateResponse) => void;
  combatState: (state: CombatStateResponse) => void;
  player: (player: PlayerDto) => void
  inventory: (inventory: InventoryItemDto[]) => void
  tradeUpdate: (state: TradeStateDto | null) => void
  pvpState: (state: PvpStateDto| null) => void
};

export type ClientToServerEvents = {
  // пока пусто — комнатами локаций управляет сервер
}


export type LeaderBoardToDto = {
  player: PlayerDto
  points: number
}
export type LeaderBoardResponse = {
  entries: LeaderBoardToDto[]
}

export type QuestsDifficulty = "easy" | "medium" | "hard"
export type QuestsStatus = "waiting" | "completed" | "claimed"
export type QuestsObjectiveType = "kill" | "walk" | "collect" | "visit"


export type QuestsDto = {
  id: number
  title: string
  description: string
  difficulty: QuestsDifficulty
  objectiveType: QuestsObjectiveType
  targetId: string | null
  targetCount: number
  targetXp: number
  targetPoints: number
}
export type PlayerQuestDto = {
  id: number
  quest: QuestsDto
  progress: number
  status: QuestsStatus
  assignedDay: string
}

export type TradeItem = {
  itemType: number
  quantity: number
}

// Что видит игрок в окне трейда: свою выкладку и выкладку партнёра
export type TradeStateDto = {
  id: number;
  status: "pending" | "open" | "accepted" | "declined" | "cancelled";
  myOffer: TradeItem[];
  partnerOffer: TradeItem[];
  iAmReady: boolean;
  partnerIsReady: boolean;
  partnerName: string;
}

export type TradeListItemDto = {
  id: number
  partnerName: string
  status: "pending" | "open"
  direction: "incoming" | "outgoing" // входящее приглашение или исходящее
};

export type TradesOverviewResponse = {
  invites: TradeListItemDto[]   // приглашения, ждущие ответа
  active: TradeStateDto | null  // мой открытый трейд, если есть
};

export type QuestsResponse = { quests: QuestsDto[] }
export type QuestResponse = { quest: QuestsDto }
export type DailyQuestsResponse = { quests: PlayerQuestDto[] }
export type ClaimQuestResponse = { player: PlayerDto; claimed: boolean }



export type PvpStateDto = {
  id: number
  status: "pending" | "active" | "finished"
  myName: string
  partnerName: string
  myHp: number
  myMaxHp: number
  partnerHp: number
  partnerMaxHp: number
  myTurn: boolean // чей ход щас
  finished: boolean
  isWon : boolean | null // null = ничья/побег
}

export type PvpListItemDto = {
  id: number
  partnerName: string
  direction: "incoming" | "outgoing"
}

export type PvpOverviewResponse = {
  invites: PvpListItemDto[]
  active: PvpStateDto | null
}