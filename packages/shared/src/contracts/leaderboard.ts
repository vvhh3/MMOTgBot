

import type { PlayerDto } from "./players.js";




export type LeaderBoardToDto = {
  player: PlayerDto
  points: number
}

export type LeaderBoardResponse = {
  entries: LeaderBoardToDto[]
}
