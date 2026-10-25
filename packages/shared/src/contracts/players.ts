

import type { LastAction } from "./activity.js";
import type { FactionId } from "../factions.js";
import type { TutorialStep } from "../tutorial.js";
import type { InventoryItemDto } from "./items.js";


export type PlayerDto = { // описание игрока
  id: number
  friendId:number
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
  idTheLastAction:LastAction | null
  money:number | 0,
  cooldowns:Cooldowns,
  isCreated: boolean // прошёл ли игрок конструктор персонажа
  factionId: FactionId | null // выбранная социальная группировка
  tutorialStep: TutorialStep
  avatar: string | null // выбранный аватар (имя файла из /public)
};


// Конструктор персонажа: что отправляет клиент при первом заходе
export type CharacterCreateRequest = {
  name: string
  factionId: FactionId
  avatar: string
}


export type CharacterCreateResponse = {
  player: PlayerDto
}


export type CharacterSkinDto = {
  id: number
  name: string
  imageUrl: string
  sortOrder: number
}


export type CharacterSkinsResponse = {
  skins: CharacterSkinDto[]
}


// какую характеристику поднять за одно очко (POST /me/stats)
export type StatType = 'maxHealth' | 'strength' | 'defense'


export type SpendStatPointRequest = {
  [key in StatType]: number
}

export type Cooldowns = {
  [key: string]: string;
};


export type MeResponse = {
  player: PlayerDto;
  inventory: InventoryItemDto[];
};


export type RegenToPlayer = {
  playersId:number;
}
