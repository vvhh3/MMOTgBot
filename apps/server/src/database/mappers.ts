import type { EventDto,InventoryItemDto,ItemDto,LocationDto,MobDto,PlayerDto,QuestsDto } from "@mmobot/shared";
import { getPlayerStats } from "../modules/combat/pve.js";
import { getLevelXpBounds } from "../modules/players/level.js";
import type { EventRow,InventoryItemRow,ItemRow,LocationRow,MobRow,PlayerRow,QuestsRow } from "./schema.js";

// Функции ниже превращают "сырые" строки из БД (Row-типы) в DTO — объекты, которые
// отдаются клиенту. Это прослойка между внутренним форматом хранения и внешним API.

//получить дефолтные статы игрока
export function toPlayerDto(row: PlayerRow): PlayerDto {
  const { levelStartXp, nextLevelXp } = getLevelXpBounds(row.xp)
  
  return {
    id: row.id,
    friendId: row.friendId,
    name: row.name,
    level: row.level,
    xp: row.xp,
    xpLevelStart: levelStartXp,
    xpNextLevel: nextLevelXp,
    points: row.points,
    currentLocationId: row.currentLocationId,
    health: row.health,
    maxHp: row.maxHealth,
    strength: row.strength,
    defense: row.defense,
    statPoints: row.statPoints, // нераспределённые очки — клиент по ним показывает кнопку прокачки
    idTheLastAction:row.idTheLastAction,
    money:row.money,
    cooldowns:row.cooldowns,
    isCreated: row.isCreated,
    factionId: row.factionId,
    tutorialStep: row.tutorialStep,
    avatar: row.avatar

  }
}

// получить данные игрока с экипировкой 
export function toPlayerDtoEquipped(row: PlayerRow): PlayerDto {
  const dto = toPlayerDto(row)
  const statsEquiped = getPlayerStats(row) 
  return {...dto,strength: statsEquiped.strength, defense: statsEquiped.defense}
}

export function toMobDto(row: MobRow): MobDto{
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    level: row.level,
    maxHealth: row.maxHealth,
    strength: row.strength,
    defense: row.defense,
    // Возможная добыча со своими шансами, не результат конкретного боя.
    loot: row.loot,
    pointsReward: row.pointsReward,
    coinReward: row.coinReward,
    locationId: row.locationId,
    respawnSeconds: row.respawnSeconds
  }
}
export function toItemDto(row: ItemRow): ItemDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    damage: row.damage,
    defense: row.defense,
    healAmount: row.healAmount,
    price: row.price,
    shopAvailable: row.shopAvailable,
    icon: row.icon,
    rarity: row.rarity,
    weaponFamily: row.weaponFamily,
    damageCategory: row.damageCategory,
    damageType: row.damageType,
    passiveId: row.passiveId,
    passiveParams: row.passiveParams,
  };
}

export function toLocationDto(row: LocationRow): LocationDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    x: row.x,
    y: row.y,
    homeImg:row.homeImg,
    fightImg:row.fightImg,
    actions:row.actions,
    minLevel: row.minLevel,
    isOpen: row.isOpen,
  };
}

export function toInventoryItemDto(row: InventoryItemRow): InventoryItemDto {
  return {
    id: row.id,
    itemType: row.itemType,
    quantity: row.quantity,
    acquiredAt: row.acquiredAt,
    equiped: row.equiped,
    weaponLevel: row.weaponLevel,
  };
}

export function toEventDto(row: EventRow): EventDto {
  return {
    id: row.id,
    playerId: row.playerId,
    playerName: row.playerName,
    locationId: row.locationId,
    type: row.type,
    createdAt: row.createdAt
  };
}
export function toQuestDto(row: QuestsRow): QuestsDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    difficulty: row.difficulty,
    objectiveType: row.objectiveType,
    targetId: row.targetId,
    targetCount: row.targetCount,
    targetXp: row.targetXp,
    targetPoints: row.targetPoints,
    targetCoins: row.targetCoins,
  };
}
