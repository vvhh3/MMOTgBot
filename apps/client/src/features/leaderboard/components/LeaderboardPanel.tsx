import { useRef } from "react";
import type { LeaderboardMetric, LeaderboardMode, RankingEntry } from "../ranking";
import { EntryDetail, formatRankingNumber as number, OwnMark, ParticipantAvatar, RankMark, TrophyIcon } from "./LeaderboardUi";

type LeaderboardPanelProps = {
  mode: LeaderboardMode;
  onModeChange: (mode: LeaderboardMode) => void;
  entries: RankingEntry[];
  hasIdentity: boolean;
  playerPoints?: number | null;
  metric?: LeaderboardMetric;
  onMetricChange?: (metric: LeaderboardMetric) => void;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
};

export default function LeaderboardPanel({ mode, onModeChange, entries, hasIdentity, playerPoints = null, metric = "members", onMetricChange, loading = false, error, onRefresh, refreshDisabled = false }: LeaderboardPanelProps) {
  const list = useRef<HTMLDivElement>(null);
  const standing = useRef<HTMLElement>(null);
  const own = !loading && !error ? entries.find(entry => entry.own) : undefined;
  const membersMode = mode === "factions" && metric === "members";
  const score = (entry: RankingEntry) => membersMode ? entry.members ?? 0 : entry.points;
  const ownScore = mode === "players" ? playerPoints : own ? score(own) : null;
  const outside = mode === "players" && hasIdentity && !own && entries.length >= 10 && !loading && !error;
  const noMembers = mode === "factions" && entries.length > 0 && entries.every(entry => entry.members === 0);
  const leaders = entries.slice(0, 3);
  const podium = leaders.length > 1 ? [leaders[1], leaders[0], ...leaders.slice(2)] : leaders;
  const unit = membersMode ? "участников" : "очков";
  const ownTitle = loading ? "Загружаем место…" : error ? "Место недоступно" : !hasIdentity
    ? mode === "players" ? "Результат недоступен" : "Группировка не выбрана"
    : own ? mode === "players" ? `${own.rank} место` : own.name : outside ? "Вне топ-10" : "Пока нет места";

  const showOwn = () => {
    const target = list.current?.querySelector<HTMLElement>('[data-current="true"]') ?? standing.current;
    target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    target?.focus({ preventScroll: true });
  };

  return <div className="text-[#2b2a27]">
    <header className="flex flex-wrap items-center justify-between gap-2 px-1 py-2">
      <div><p className="text-[10px] text-[#756b5c]">Лидеры города</p><h1 className="mt-0.5 text-xl font-bold">Рейтинг</h1></div>
      <button type="button" className="game-button game-button--sm" disabled={!hasIdentity || loading || !!error} onClick={showOwn}>{mode === "players" ? "Моё место" : "Моя группа"}</button>
    </header>
    <div role="group" aria-label="Вид рейтинга" className="mt-3 flex justify-center border-b border-neutral-200">
      {([["players", "Игроки"], ["factions", "Группировки"]] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={mode === id} className={`relative flex min-h-11 min-w-0 flex-1 items-center justify-center px-1 text-xs font-medium outline-none focus-visible:outline-2 focus-visible:outline-[#e8603c] ${mode === id ? "text-[#2b2a27] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#e8603c]" : "text-[#756b5c]"}`} onClick={() => onModeChange(id)}>{label}</button>)}
    </div>

    <section ref={standing} tabIndex={-1} aria-label={mode === "players" ? "Ваш результат" : "Ваша группировка"} className="game-card mt-3 p-3 outline-none focus-visible:outline-2 focus-visible:outline-[#e8603c]">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black text-[#e8603c]"><TrophyIcon /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] leading-4 text-[#756b5c]">{mode === "players" ? "Ваш результат" : `Ваша группировка${own ? ` · ${own.rank} место` : ""}`}</p>
          <p className="mt-0.5 truncate text-[13px] font-bold" title={ownTitle}>{ownTitle}</p>
        </div>
        <div className="shrink-0 text-right"><p className="text-xl font-bold tabular-nums">{ownScore === null ? "—" : number(ownScore)}</p><p className="text-[10px] text-[#756b5c]">{unit}</p></div>
      </div>
      {outside && <p className="mt-2 text-[10px] leading-4 text-[#756b5c]">Вы пока вне первой десятки. Ваши очки всегда видны здесь.</p>}
    </section>

    {mode === "factions" && <label className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#756b5c]">Сортировка<select value={metric} onChange={event => onMetricChange?.(event.target.value === "totalPoints" ? "totalPoints" : "members")} className="min-h-10 max-w-full rounded-xl border border-black bg-white px-2 text-xs text-[#2b2a27] outline-none focus-visible:outline-2 focus-visible:outline-[#e8603c]"><option value="members">По численности</option><option value="totalPoints">По очкам</option></select></label>}
    <div className="mt-4 mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
      <h2 className="text-xs font-bold">{mode === "players" ? "Топ-10 игроков" : "Группировки города"}</h2>
      <div className="flex items-center gap-2"><span className="text-[10px] text-[#756b5c]">{mode === "players" ? "По очкам" : `${entries.length} группировок`}</span>
        {onRefresh && <button type="button" className="game-button game-button--neutral game-button--step border-black!" aria-label="Обновить рейтинг" disabled={loading || refreshDisabled} onClick={onRefresh}><svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></svg></button>}
      </div>
    </div>

    <div ref={list} aria-busy={loading}>
      {loading ? <p role="status" className="py-7 text-center text-xs text-[#756b5c]">Загружаем рейтинг…</p>
        : error ? <p role="alert" className="py-4 text-xs leading-5 text-red-600">{error}</p>
        : entries.length === 0 ? <p className="game-card p-5 text-center text-xs leading-5 text-[#756b5c]">{mode === "players" ? "Пока нет игроков в рейтинге." : "Пока нет данных о группировках."}</p>
        : <>
          {noMembers ? <p className="mb-3 text-xs leading-5 text-[#756b5c]">Пока никто не вступил. Группировки ждут первых участников.</p> : <ol className={`mb-3 grid items-end gap-1.5 ${podium.length === 1 ? "mx-auto max-w-40 grid-cols-1" : podium.length === 2 ? "grid-cols-2" : "grid-cols-3"}`} aria-label="Первая тройка">
            {podium.map(entry => <li key={entry.id} value={entry.rank} className={`game-card flex min-w-0 flex-col items-center gap-2 px-1.5 pb-3 text-center ${entry.rank === 1 ? "pt-5" : "pt-3"}`}>
              {entry.rank === 1 && <span className="text-[#e8603c]"><TrophyIcon /></span>}
              <RankMark rank={entry.rank} />
              <ParticipantAvatar name={entry.name} />
              <p className="w-full truncate text-[11px] font-semibold" title={entry.name}>{entry.name}</p>
              <div><p className="text-sm font-bold tabular-nums">{number(score(entry))}</p><p className="text-[9px] text-[#756b5c]">{unit}</p></div>
            </li>)}
          </ol>}
          <ol className="game-card divide-y divide-neutral-200 px-3" aria-label="Полный рейтинг">
            {entries.map(entry => <li key={entry.id} value={entry.rank} data-current={entry.own || undefined} tabIndex={entry.own ? -1 : undefined} className="flex min-w-0 items-center gap-2 py-3 outline-none focus-visible:outline-2 focus-visible:outline-[#e8603c]">
              <RankMark rank={entry.rank} />
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold" title={entry.name}>{entry.name}</p><div className="mt-1 flex flex-wrap items-center gap-1"><EntryDetail entry={entry} metric={metric} />{entry.own && <OwnMark mode={mode} />}</div></div>
              <strong className="shrink-0 text-sm tabular-nums">{number(score(entry))}</strong>
            </li>)}
          </ol>
        </>}
    </div>
  </div>;
}
