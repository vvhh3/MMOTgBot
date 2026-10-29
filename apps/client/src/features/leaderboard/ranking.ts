import { getFaction, type FactionId, type FactionLeaderboardEntry, type PlayerDto } from "@mmobot/shared";

export type LeaderboardMode = "players" | "factions";
export type LeaderboardMetric = "members" | "totalPoints";
export type RankingEntry = { id: string; name: string; points: number; level?: number; members?: number; rank: number; own: boolean };

export function playerRanking(entries: readonly { player: Pick<PlayerDto, "id" | "name" | "level">; points: number }[], playerId: number | null): RankingEntry[] {
  return entries.map(({ player, points }, index) => ({
    id: String(player.id), name: player.name, level: player.level, points, rank: index + 1, own: player.id === playerId,
  }));
}

export function factionRanking(entries: readonly FactionLeaderboardEntry[], metric: LeaderboardMetric, factionId: FactionId | null): RankingEntry[] {
  const secondary = metric === "members" ? "totalPoints" : "members";
  const sorted = [...entries].sort((a, b) => b[metric] - a[metric] || b[secondary] - a[secondary] || a.factionId.localeCompare(b.factionId));
  return sorted.map(entry => ({
    id: entry.factionId, name: getFaction(entry.factionId)!.name, points: entry.totalPoints, members: entry.members,
    rank: sorted.findIndex(other => other[metric] === entry[metric]) + 1, own: entry.factionId === factionId,
  }));
}
