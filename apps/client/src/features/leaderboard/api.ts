import { type FactionLeaderboardResponse,type LeaderBoardResponse } from "@mmobot/shared";

import { api,authHeader } from "../../shared/api/http";


export async function getLeaderboard(token: string): Promise<LeaderBoardResponse> {
  const response = await api.get<LeaderBoardResponse>("/leaderboard", { headers: authHeader(token) });
  return response.data;
}

export async function getFactionLeaderboard(token: string): Promise<FactionLeaderboardResponse> {
  const response = await api.get<FactionLeaderboardResponse>("/leaderboard/factions", { headers: authHeader(token) });
  return response.data;
}
