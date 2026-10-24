import { PlayerDto,type CharacterCreateRequest,type CharacterSkinsResponse,type MeResponse } from "@mmobot/shared";

import { api,authHeader } from "../../shared/api/http";


export async function getMe(token: string): Promise<MeResponse> {
  const response = await api.get<MeResponse>("/me", { headers: authHeader(token), timeout: 15000 });
  return response.data;
}


// Сохранить персонажа из конструктора при первом заходе
export async function createCharacter(token: string, character: CharacterCreateRequest): Promise<{ player: PlayerDto }> {
  const response = await api.post<{ player: PlayerDto }>("/me/character", character, { headers: authHeader(token) });
  return response.data;
}


export async function getCharacterSkins(token: string): Promise<CharacterSkinsResponse> {
  const response = await api.get<CharacterSkinsResponse>("/character-skins", { headers: authHeader(token) });
  return response.data;
}


// DEV: сбросить конструктор персонажа (только в dev-режиме на сервере)
export async function resetCharacter(token: string): Promise<{ player: PlayerDto }> {
  const response = await api.post<{ player: PlayerDto }>("/me/character/reset", undefined, { headers: authHeader(token) });
  return response.data;
}



// Потратить очко характеристики
export async function spendStatPoint(token: string, stat:{}) : Promise<{ player: PlayerDto }> {
  const response = await api.post<{ player: PlayerDto }>("/me/stats", stat , { headers: authHeader(token) })
  return response.data
}
