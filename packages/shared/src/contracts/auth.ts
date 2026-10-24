

import type { PlayerDto } from "./players.js";



export type AuthRequest = {
  initData: string;
};


export type AuthResponse = {
  token: string;
  player: PlayerDto;
};


export type ApiErrorResponse = {
  error: string;
}
