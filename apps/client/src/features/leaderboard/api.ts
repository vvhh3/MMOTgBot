import { type LeaderBoardResponse } from "@mmobot/shared";

import { api,authHeader } from "../../shared/api/http";


export async function getLeaderboard(token: string): Promise<LeaderBoardResponse> {
  const response = await api.get<LeaderBoardResponse>("/leaderboard", { headers: authHeader(token) });
  return response.data;
}
