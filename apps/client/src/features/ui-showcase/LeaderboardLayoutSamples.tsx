import { FACTIONS, type FactionLeaderboardEntry } from "@mmobot/shared";
import { useRef, useState } from "react";
import LeaderboardPanel from "../leaderboard/components/LeaderboardPanel";
import { EntryDetail, formatRankingNumber as number, OwnMark, ParticipantAvatar, RankMark, TrophyIcon } from "../leaderboard/components/LeaderboardUi";
import { factionRanking, type LeaderboardMode as Mode, type LeaderboardMetric as Metric, type RankingEntry as Entry } from "../leaderboard/ranking";
import Specimen from "./Specimen";

type Layout = "table" | "podium" | "cards";

const layouts = [
  { id: "table", title: "1 · Компактная таблица", description: "Место, игрок и очки. Уровень под именем, ваш результат отдельным блоком." },
  { id: "podium", title: "2 · Подиум", description: "Первая тройка на виду, полный рейтинг ниже. Акцент на лидерах города." },
  { id: "cards", title: "3 · Карточки лидеров", description: "Сетка как во вкладке друзей: аватар, место, уровень и крупные очки." },
] as const;

const players = [
  { id: "artem", name: "Артём", level: 12, points: 480 },
  { id: "denis", name: "Денис", level: 11, points: 360 },
  { id: "dasha", name: "Даша", level: 9, points: 290 },
  { id: "misha", name: "Миша", level: 7, points: 220 },
  { id: "sasha", name: "Саша", level: 6, points: 160 },
  { id: "me", name: "Тестовый герой", level: 8, points: 125 },
  { id: "nikita", name: "Никита", level: 4, points: 100 },
  { id: "lena", name: "Лена", level: 5, points: 80 },
  { id: "long-name", name: "Игрок с очень длинным именем", level: 6, points: 65 },
  { id: "kirill", name: "Кирилл", level: 3, points: 50 },
];
const factions: FactionLeaderboardEntry[] = [
  { factionId: "nefors", members: 48, totalPoints: 2600 },
  { factionId: "normies", members: 32, totalPoints: 3500 },
  { factionId: "offniks", members: 61, totalPoints: 4100 },
  { factionId: "skufs", members: 28, totalPoints: 1750 },
  { factionId: "gamers", members: 52, totalPoints: 3200 },
  { factionId: "anime", members: 45, totalPoints: 2400 },
];
function LeaderboardPreview({ layout }: { layout: Layout }) {
  const [mode, setMode] = useState<Mode>("players");
  const [metric, setMetric] = useState<Metric>("members");
  const [outside, setOutside] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const standing = useRef<HTMLElement>(null);
  const entries: Entry[] = mode === "players" ? players.map((person, index) => {
    const entry = outside && person.id === "me" ? { ...person, id: "vadim", name: "Вадим" } : person;
    return { ...entry, rank: index + 1, own: entry.id === "me" };
  }) : factionRanking(factions, metric, "gamers");
  const own = entries.find(entry => entry.own);
  const membersMode = mode === "factions" && metric === "members";
  const unit = membersMode ? "участников" : "очков";
  const score = (entry: Entry) => membersMode ? entry.members ?? 0 : entry.points;
  const ownScore = own ? score(own) : 42;
  const showOwn = () => {
    const target = list.current?.querySelector<HTMLElement>('[data-current="true"]') ?? standing.current;
    target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    target?.focus({ preventScroll: true });
  };

  const ownStanding = <section ref={standing} tabIndex={-1} aria-label={mode === "players" ? "Ваш результат" : "Ваша группировка"} className="game-card mt-3 p-3 outline-none focus-visible:outline-2 focus-visible:outline-[#e8603c]">
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black text-[#e8603c]"><TrophyIcon /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] leading-4 text-[#756b5c]">{mode === "players" ? "Ваш результат" : `Ваша группировка · ${own?.rank} место`}</p>
        <p className="mt-0.5 truncate text-[13px] font-bold">{mode === "factions" ? own?.name : own ? `${own.rank} место` : "Вне топ-10"}</p>
      </div>
      <div className="shrink-0 text-right"><p className="text-xl font-bold tabular-nums">{number(ownScore)}</p><p className="text-[10px] text-[#756b5c]">{unit}</p></div>
    </div>
    {mode === "players" && outside && <p className="mt-2 text-[10px] leading-4 text-[#756b5c]">Вы пока вне первой десятки. Ваши очки всегда видны здесь.</p>}
  </section>;

  const table = <div className="game-card overflow-hidden">
    <table className="w-full table-fixed border-collapse text-left text-[11px]">
      <caption className="sr-only">{mode === "players" ? "Топ-10 игроков по очкам" : `Рейтинг группировок ${membersMode ? "по численности" : "по очкам"}`}</caption>
      <thead className="border-b border-neutral-200 text-[10px] text-[#756b5c]"><tr>
        <th scope="col" className="w-11 px-2 py-3 font-medium"><span className="sr-only">Место</span><span aria-hidden="true">№</span></th>
        <th scope="col" className="min-w-0 py-3 pr-1 font-medium">{mode === "players" ? "Игрок" : "Группировка"}</th>
        <th scope="col" className="w-16 py-3 pr-3 text-right font-medium">{membersMode ? "Люди" : "Очки"}</th>
      </tr></thead>
      <tbody className="divide-y divide-neutral-200">{entries.map(entry => <tr key={entry.id} data-current={entry.own || undefined} tabIndex={entry.own ? -1 : undefined} className="outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#e8603c]">
        <td className={`px-2 py-3 align-middle ${entry.own ? "shadow-[inset_3px_0_0_#e8603c]" : ""}`}><RankMark rank={entry.rank} /></td>
        <th scope="row" className="min-w-0 py-3 pr-1 font-normal"><div className="flex min-w-0 flex-col items-start gap-1">
          <span className="block w-full truncate text-xs font-semibold" title={entry.name}>{entry.name}</span>
          <div className="flex flex-wrap items-center gap-1"><EntryDetail entry={entry} metric={metric} />{entry.own && <OwnMark mode={mode} />}</div>
        </div></th>
        <td className="py-3 pr-3 text-right align-middle text-sm font-bold tabular-nums">{number(score(entry))}</td>
      </tr>)}</tbody>
    </table>
  </div>;

  const cards = <ol className="grid grid-cols-2 gap-2" aria-label="Карточки участников рейтинга">
    {entries.map(entry => <li key={entry.id} value={entry.rank} data-current={entry.own || undefined} tabIndex={entry.own ? -1 : undefined} className="game-card flex min-w-0 flex-col items-center gap-2 p-3 text-center outline-none focus-visible:outline-2 focus-visible:outline-[#e8603c]">
      <div className="flex w-full items-center justify-between gap-1"><RankMark rank={entry.rank} />{entry.own ? <OwnMark mode={mode} /> : entry.rank <= 3 ? <span className="text-[#e8603c]"><TrophyIcon /></span> : null}</div>
      <ParticipantAvatar name={entry.name} large />
      <p className="w-full truncate text-xs font-semibold" title={entry.name}>{entry.name}</p>
      <div className="flex min-h-6 items-center justify-center"><EntryDetail entry={entry} metric={metric} /></div>
      <div><p className="text-xl font-bold tabular-nums">{number(score(entry))}</p><p className="text-[10px] text-[#756b5c]">{unit}</p></div>
    </li>)}
  </ol>;

  const outsideToggle = <label className={`mt-3 flex min-h-9 cursor-pointer items-center gap-2 text-[10px] text-[#756b5c] ${mode === "factions" ? "opacity-50" : ""}`}><input type="checkbox" className="h-4 w-4 shrink-0 accent-[#e8603c]" checked={outside} disabled={mode === "factions"} onChange={event => setOutside(event.target.checked)} />Показать меня вне топ-10</label>;

  if (layout === "podium") return <div className="mx-auto w-full max-w-[420px]">
    <div className="rounded-[28px] border border-black bg-white p-3">
      <LeaderboardPanel mode={mode} onModeChange={setMode} entries={entries} hasIdentity playerPoints={outside ? 42 : 125} metric={metric} onMetricChange={setMetric} />
    </div>
    {outsideToggle}
  </div>;

  return <div className="mx-auto w-full max-w-[420px]">
    <div className="rounded-[28px] border border-black bg-white p-3 text-[#2b2a27]">
      <header className="flex flex-wrap items-center justify-between gap-2 px-1 py-2">
        <div><p className="text-[10px] text-[#756b5c]">Лидеры города</p><h4 className="mt-0.5 text-xl font-bold">Рейтинг</h4></div>
        <button type="button" className="game-button game-button--sm" onClick={showOwn}>{mode === "players" ? "Моё место" : "Моя группа"}</button>
      </header>
      <div role="group" aria-label="Вид рейтинга" className="mt-3 flex justify-center border-b border-neutral-200">
        {([["players", "Игроки"], ["factions", "Группировки"]] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={mode === id} className={`relative flex min-h-11 min-w-0 flex-1 items-center justify-center px-1 text-xs font-medium outline-none focus-visible:outline-2 focus-visible:outline-[#e8603c] ${mode === id ? "text-[#2b2a27] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#e8603c]" : "text-[#756b5c]"}`} onClick={() => setMode(id)}>{label}</button>)}
      </div>
      {ownStanding}
      {mode === "factions" && <label className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#756b5c]">Сортировка<select value={metric} onChange={event => setMetric(event.target.value === "totalPoints" ? "totalPoints" : "members")} className="min-h-10 max-w-full rounded-xl border border-black bg-white px-2 text-xs text-[#2b2a27] outline-none focus-visible:outline-2 focus-visible:outline-[#e8603c]"><option value="members">По численности</option><option value="totalPoints">По очкам</option></select></label>}
      <div className="mt-4 mb-2 flex items-center justify-between gap-2 px-1"><h5 className="text-xs font-bold">{mode === "players" ? "Топ-10 игроков" : "Группировки города"}</h5><span className="text-[10px] text-[#756b5c]">{mode === "players" ? "По очкам" : `${FACTIONS.length} группировок`}</span></div>
      <div ref={list}>{layout === "cards" ? cards : table}</div>
    </div>
    {outsideToggle}
  </div>;
}

export default function LeaderboardLayoutSamples() {
  return <Specimen preserveStyle title="Таблица лидеров · варианты на выбор" usage="Игроки · Группировки · Ваше место" wide>
    <p className="mb-5 text-xs leading-5 text-[#756b5c]">Три варианта рейтинга в общем стиле сайта. Переключайте игроков и группировки, меняйте сортировку и сравнивайте свой результат в топ-10 и за его пределами. В примерах используются локальные данные.</p>
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-start gap-5">
      {layouts.map(({ id, title, description }) => <section key={id} className="min-w-0" aria-labelledby={`leaderboard-layout-${id}`}>
        <div className="mx-auto mb-4 max-w-[420px]"><h4 id={`leaderboard-layout-${id}`} className="text-sm font-bold text-[#2b2a27]">{title}</h4><p className="mt-1 min-h-10 text-[11px] leading-5 text-[#756b5c]">{description}</p></div>
        <LeaderboardPreview layout={id} />
      </section>)}
    </div>
  </Specimen>;
}
