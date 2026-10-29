import LevelBadge from "../../../shared/ui/LevelBadge";
import type { LeaderboardMetric, LeaderboardMode, RankingEntry } from "../ranking";

export const formatRankingNumber = (value: number) => value.toLocaleString("ru-RU");

export function TrophyIcon() {
  return <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4" /></svg>;
}

export function RankMark({ rank }: { rank: number }) {
  return <span aria-label={`Место ${rank}`} className={`inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full border bg-white px-1 text-[11px] font-bold tabular-nums ${rank <= 3 ? "border-[#e8603c] text-[#c2410c]" : "border-neutral-200 text-[#756b5c]"}`}>{rank}</span>;
}

export function ParticipantAvatar({ name, large = false }: { name: string; large?: boolean }) {
  return <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full border border-black bg-white font-bold text-[#594f43] ${large ? "h-12 w-12 text-lg" : "h-8 w-8 text-xs"}`}>{Array.from(name.trim())[0] || "?"}</span>;
}

export function EntryDetail({ entry, metric }: { entry: RankingEntry; metric: LeaderboardMetric }) {
  if (entry.level !== undefined) return <LevelBadge level={entry.level} />;
  return <span className="text-[10px] leading-4 text-[#756b5c]">{metric === "members" ? `${formatRankingNumber(entry.points)} очков` : `Участники: ${formatRankingNumber(entry.members ?? 0)}`}</span>;
}

export function OwnMark({ mode }: { mode: LeaderboardMode }) {
  return <span className="game-badge min-h-0! px-1.5! py-0! text-[9px]! leading-4!">{mode === "players" ? "Вы" : "Ваша"}</span>;
}
