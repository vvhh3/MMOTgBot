import { type EnterLocationResponse,type LocationActionRequest,type LocationActionResponse,type LocationsResponse,type LocationStateResponse } from "@mmobot/shared";

import { api,authHeader } from "../../shared/api/http";


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


export async function getLocationState(token: string, locationId: string, signal?: AbortSignal): Promise<LocationStateResponse> {
  const response = await api.get<LocationStateResponse>(`/locations/${locationId}/state`, {
    headers: authHeader(token),
    signal,
    timeout: 15_000,
  });
  return response.data;
}


export async function performLocationAction(token: string, locationId: string, actionId: LocationActionRequest["actionId"]): Promise<LocationActionResponse> {
  const response = await api.post<LocationActionResponse>(
    `/locations/${locationId}/action`,
    { actionId } satisfies LocationActionRequest,
    { headers: authHeader(token) })
  return response.data;
}


export async function dailyActivities(token: string, locationName: string) {
  const res = await api.post(
    "/dailyActivities/money",
    { location: locationName },
    { headers: authHeader(token) }
  )
  return res.data
}
