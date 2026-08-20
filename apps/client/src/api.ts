import axios, { type AxiosError } from "axios";
import type {
  AuthRequest,
  AuthResponse,
  ClaimQuestResponse,
  DailyQuestsResponse,
  EnterLocationResponse,
  LocationActionRequest,
  LocationActionResponse,
  LocationsResponse,
  LocationStateResponse,
  MeResponse
} from "@mmobot/shared";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { "content-type": "application/json" }
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    const message = error.response?.data?.error ?? error.message;
    return Promise.reject(new Error(message));
  }
);

export async function auth(initData: string): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/auth", { initData } satisfies AuthRequest);
  return response.data;
}

export async function getMe(token: string): Promise<MeResponse> {
  const response = await api.get<MeResponse>("/me", { headers: authHeader(token) });
  return response.data;
}

export async function getLocations(token: string): Promise<LocationsResponse> {
  const response = await api.get<LocationsResponse>("/locations", { headers: authHeader(token) })
  return response.data
}

export async function enterLocation(token: string, locationId: string): Promise<EnterLocationResponse> {
  const response = await api.post<EnterLocationResponse>(`/locations/${locationId}/enter`, undefined, {
    headers: authHeader(token)
  })
  return response.data;
}

export async function getLocationState(token: string, locationId: string): Promise<LocationStateResponse> {
  const response = await api.get<LocationStateResponse>(`/locations/${locationId}/state`, { headers: authHeader(token) });
  return response.data;
}

export async function performLocationAction(token: string, locationId: string, actionId: LocationActionRequest["actionId"]): Promise<LocationActionResponse> {
  const response = await api.post<LocationActionResponse>(
    `/locations/${locationId}/action`,
    { actionId } satisfies LocationActionRequest,
    { headers: authHeader(token) })
  return response.data;
}

export async function getDailyQuests(token: string): Promise<DailyQuestsResponse> {
  const response = await api.get<DailyQuestsResponse>("/quests/daily", { headers: authHeader(token) });
  return response.data;
}

export async function claimQuest(token: string, questId: number): Promise<ClaimQuestResponse> {
  const response = await api.post<ClaimQuestResponse>(`/quests/${questId}/claim`, undefined, {
    headers: authHeader(token)
  });
  return response.data;
}

function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}