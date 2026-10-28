import type { GroupEventOverview, GroupEventWindowDto } from '@mmobot/shared';
import { api, authHeader, ApiError } from '../../shared/api/http';

const retries = new Map<string, string>();
export async function getGroupEvent(token: string) {
  return (await api.get<GroupEventOverview>('/group-events/me', { headers: authHeader(token), timeout: 15000 })).data;
}
export async function groupCommand(token: string, path: string, body: Record<string, unknown> = {}) {
  const signature = JSON.stringify([token, path, body]);
  const requestId = retries.get(signature) ?? crypto.randomUUID();
  retries.set(signature, requestId);
  try {
    const data = (await api.post<GroupEventOverview>(path, { ...body, requestId }, { headers: authHeader(token), timeout: 15000 })).data;
    retries.delete(signature); return data;
  } catch (error) {
    if (error instanceof ApiError && error.status && error.status < 500) retries.delete(signature);
    throw error;
  }
}
export async function getEventWindows(token: string) {
  return (await api.get<{ windows: GroupEventWindowDto[] }>('/admin/group-events', { headers: authHeader(token), timeout: 15000 })).data.windows;
}
