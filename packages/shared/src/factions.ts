export const FACTIONS = [
  { id: "nefors", name: "Нефоры", color: "#7c3aed", symbol: "star" },
  { id: "normies", name: "Нормисы", color: "#0369a1", symbol: "home" },
  { id: "offniks", name: "Офники", color: "#b91c1c", symbol: "shield" },
  { id: "skufs", name: "Скуфы", color: "#92400e", symbol: "cup" },
  { id: "gamers", name: "Геймеры",  color: "#047857", symbol: "gamepad" },
  { id: "anime", name: "Анимешники",  color: "#be185d", symbol: "sparkles" },
] as const;

export type Faction = typeof FACTIONS[number];
export type FactionId = Faction["id"];

export function isFactionId(value: unknown): value is FactionId {
  return typeof value === "string" && FACTIONS.some((faction) => faction.id === value);
}

export function getFaction(id: string | null | undefined): Faction | undefined {
  return FACTIONS.find((faction) => faction.id === id);
}

export type FactionLeaderboardEntry = {
  factionId: FactionId;
  members: number;
  totalPoints: number;
};
export type FactionLeaderboardResponse = { entries: FactionLeaderboardEntry[] };
