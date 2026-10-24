import { type AuthRequest,type AuthResponse } from "@mmobot/shared";

import { api } from "../../shared/api/http";


export async function auth(initData: string): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/auth", { initData } satisfies AuthRequest);
  return response.data;
}
