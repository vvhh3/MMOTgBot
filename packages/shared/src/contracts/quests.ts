

import type { PlayerDto } from "./players.js";



export type QuestsDifficulty = "easy" | "medium" | "hard"

export type QuestsStatus = "waiting" | "completed" | "claimed"

export type QuestsObjectiveType = "kill" | "walk" | "collect" | "visit" | "loot" | "casino_win"



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
  targetCoins: number
}

export type PlayerQuestDto = {
  id: number
  quest: QuestsDto
  progress: number
  status: QuestsStatus
  assignedDay: string
}


export type QuestsResponse = { quests: QuestsDto[] }

export type QuestResponse = { quest: QuestsDto }

export type DailyQuestsResponse = { quests: PlayerQuestDto[] }

export type ClaimQuestResponse = { player: PlayerDto; claimed: boolean }
