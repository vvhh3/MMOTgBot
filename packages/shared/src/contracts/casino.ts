

import type { PlayerDto } from "./players.js";


export type CasinoGameType = "mines" | "blackjack" | "ladder"


export type PlayingCardDto = {
  rank: "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K"
  suit: "hearts" | "diamonds" | "clubs" | "spades"
}


export type CasinoSessionResponse = {
  id: number
  game: CasinoGameType
  status: "active" | "won" | "lost"
  bet: number
  multiplier: number
  potentialPayout: number
  player: PlayerDto
  mines?: { mineCount: number; revealed: number[]; explodedCell?: number; bombCells?: number[] }
  blackjack?: { playerCards: PlayingCardDto[]; dealerCards: Array<PlayingCardDto | null>; playerTotal: number; dealerTotal?: number; result?: string }
  ladder?: { level: number; maxLevels: number; bombCount: 1 | 2; revealedSafeCells: number[]; failedCell?: number; bombCells?: number[][] }
}
