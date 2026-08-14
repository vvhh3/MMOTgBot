export type PlayerDto = {
  id: number;
  name: string;
  level: number;
  points: number;
  currentLocationId: string | null;
  health: number
  maxHp: number
  strength: number
  defense: number
};

export type MobDto = {
  id: number
  name: string
  description: string
  level: number
  maxHealth: number
  strength: number
  defense: number
  loot: string[]
  pointsReward: number
  locationId: string
  respawnSeconds: number
}


export type CombatLogEntry = { // типо логирование
  text: string;
  at: string;
};

export type CombatStateResponse = { // описание боя 
  mob: MobDto;
  playerHp: number;
  playerMaxHp: number;
  mobHp: number;
  mobMaxHp: number;
  status: "active" | "victory" | "defeat" | "fled";
  log: CombatLogEntry[];
};

// export type CombatStartRequest = {
//   mobId: string;
// }

// export type CombatActionRequest = {
//   action: "attack" | "flee";
// }

export type CombatActionResponse = {
  state: CombatStateResponse;
  player: PlayerDto;
  inventory: InventoryItemDto[];
};

export type InventoryItemDto = {
  id: number;
  itemType: string;
  quantity: number;
  acquiredAt: string;
};

export type LocationDto = {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
};

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
};

export type LocationStateResponse = {
  location: LocationDto;
  players: PlayerDto[];
  actions: ActionDto[];
  mobs: MobDto[];
  recentEvents: EventDto[];
  serverTime: string;
};

export type EnterLocationResponse = {
  player: PlayerDto;
  state: LocationStateResponse;
};

export type LocationActionRequest = {
  actionId: "scavenge";
};

export type LocationActionResponse = {
  message: string;
  player: PlayerDto;
  inventory: InventoryItemDto[];
  event: EventDto;
};

export type ApiErrorResponse = {
  error: string;
};
