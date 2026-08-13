import type {
  AuthRequest,
  AuthResponse,
  EnterLocationResponse,
  LocationActionRequest,
  LocationActionResponse,
  LocationsResponse,
  LocationStateResponse,
  MeResponse
} from "@mmobot/shared";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export async function auth(initData: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth", {
    method: "POST",
    body: { initData } satisfies AuthRequest
  });
}

export async function getMe(token: string): Promise<MeResponse> {
  return request<MeResponse>("/me", { token });
}

export async function getLocations(token: string): Promise<LocationsResponse> {
  return request<LocationsResponse>("/locations", { token });
}

export async function enterLocation(token: string, locationId: string): Promise<EnterLocationResponse> {
  return request<EnterLocationResponse>(`/locations/${locationId}/enter`, {
    method: "POST",
    token
  });
}

export async function getLocationState(token: string, locationId: string): Promise<LocationStateResponse> {
  return request<LocationStateResponse>(`/locations/${locationId}/state`, { token });
}

export async function performLocationAction(token: string, locationId: string): Promise<LocationActionResponse> {
  return request<LocationActionResponse>(`/locations/${locationId}/action`, {
    method: "POST",
    token,
    body: { actionId: "scavenge" } satisfies LocationActionRequest
  });
}

async function request<T>(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {}
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = (await response.json()) as T | { error: string };
  if (!response.ok) {
    throw new Error(isApiError(payload) ? payload.error : "API request failed");
  }

  return payload as T;
}

function isApiError(payload: unknown): payload is { error: string } {
  return typeof payload === "object" && payload !== null && "error" in payload;
}
