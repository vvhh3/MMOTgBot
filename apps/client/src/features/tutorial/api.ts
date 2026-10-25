import type { PlayerDto,TutorialStartResponse } from "@mmobot/shared";
import { api,authHeader } from "../../shared/api/http";

export async function startTutorial(token: string): Promise<TutorialStartResponse> {
  const response = await api.post<TutorialStartResponse>("/tutorial/start", {}, { headers: authHeader(token) });
  return response.data;
}

export async function closeTutorial(token: string, action: "skip" | "finish"): Promise<{ player: PlayerDto }> {
  const response = await api.post<{ player: PlayerDto }>(`/tutorial/${action}`, {}, { headers: authHeader(token) });
  return response.data;
}
