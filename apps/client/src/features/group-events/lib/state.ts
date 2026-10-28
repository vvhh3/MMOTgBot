import type { GroupEventOverview, GroupEventWindowDto } from '@mmobot/shared';

export function eventIsOpen(event: GroupEventWindowDto | null | undefined, now = Date.now()) {
  return !!event && event.enabled && Date.parse(event.startsAt) <= now && now < Date.parse(event.endsAt);
}
export function newerGroupState(previous: GroupEventOverview | null, next: GroupEventOverview) {
  return previous && previous.revision > next.revision ? previous : next;
}
export function remainingEventSeconds(deadline: string, serverTime: string, elapsedMs: number) {
  return Math.max(0, Math.ceil((Date.parse(deadline) - Date.parse(serverTime) - elapsedMs) / 1000));
}
