import { useId, useRef, useState, type FormEvent } from "react";
import type { FriendDto, FriendRequestDto } from "@mmobot/shared";
import FriendsPanel from "../friends/components/FriendsPanel";
import { FriendActions, FriendIcon as Icon, FriendRow as PersonRow, FriendsEmpty as Empty } from "../friends/components/FriendUi";
import type { SampleActions } from "./ComponentShowcase";
import Specimen from "./Specimen";

type Layout = "feed" | "directory" | "tiles";
type View = "all" | "online" | "requests";
type Person = { id: number; code: string; name: string; level: number; online: boolean };

const layouts = [
  { id: "feed", title: "1 · Лента", description: "Поиск сразу под рукой, отдельные карточки и привычные вкладки." },
  { id: "directory", title: "2 · Компактный список", description: "Общий блок поиска и аккуратный список без лишних рамок." },
  { id: "tiles", title: "3 · Карточки игроков", description: "Крупные аватары, сетка друзей и поиск по кнопке добавления." },
] as const;

const initialFriends: Person[] = [
  { id: 1, code: "9003", name: "Артём", level: 8, online: true },
  { id: 2, code: "9004", name: "Саша", level: 6, online: false },
  { id: 3, code: "9010", name: "Денис", level: 10, online: true },
];
const initialIncoming: Person[] = [{ id: 4, code: "9007", name: "Миша", level: 7, online: true }];
const initialOutgoing: Person[] = [{ id: 5, code: "9008", name: "Лена", level: 5, online: false }];
const directory: Person[] = [
  ...initialFriends, ...initialIncoming, ...initialOutgoing,
  { id: 6, code: "9005", name: "Даша", level: 9, online: true },
  { id: 7, code: "9011", name: "Никита", level: 4, online: false },
];

const toFriend = (person: Person): FriendDto => ({ id: person.id, friendId: Number(person.code), name: person.name, level: person.level, online: person.online });
const toRequest = (person: Person, direction: FriendRequestDto["direction"]): FriendRequestDto => ({ id: person.id + 1000, playerId: person.id, name: person.name, level: person.level, direction });

function FriendsPreview({ layout, notify }: { layout: Layout; notify: SampleActions["notify"] }) {
  const [friends, setFriends] = useState(initialFriends);
  const [incoming, setIncoming] = useState(initialIncoming);
  const [outgoing, setOutgoing] = useState(initialOutgoing);
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [searchedCode, setSearchedCode] = useState<string | null>(null);
  const [searchError, setSearchError] = useState("");
  const [resetCount, setResetCount] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const prefix = useId();
  const online = friends.filter(person => person.online);
  const visible = view === "online" ? online : friends;
  const requestsCount = incoming.length + outgoing.length;
  const result = directory.find(person => person.code === searchedCode);

  const runSearch = (value: string) => {
    const code = value.trim().replace(/^#/, "");
    setQuery(value); setSearchError(""); setSearchedCode(null);
    if (!/^\d+$/.test(code)) { setSearchError("Введите цифровой код друга."); return; }
    if (code === "9002") { setSearchError("Это ваш код. Введите код друга."); return; }
    setSearchedCode(code);
  };
  const onSearch = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); runSearch(query); };
  const copyCode = async () => {
    try { await navigator.clipboard.writeText("9002"); notify("Код дружбы скопирован"); }
    catch { notify("Ваш код дружбы: 9002"); }
  };
  const accept = (person: Person) => {
    setIncoming(current => current.filter(entry => entry.id !== person.id));
    setFriends(current => current.some(entry => entry.id === person.id) ? current : [...current, person]);
    notify(`${person.name} теперь в друзьях`);
  };
  const remove = (person: Person) => { setFriends(current => current.filter(entry => entry.id !== person.id)); notify(`${person.name} удалён из друзей`); };
  const reset = () => {
    setFriends(initialFriends); setIncoming(initialIncoming); setOutgoing(initialOutgoing);
    setView("all"); setQuery(""); setSearchedCode(null); setSearchError(""); setResetCount(current => current + 1);
    notify("Исходные данные макета восстановлены");
  };
  const resultIsFriend = result && friends.some(person => person.id === result.id);
  const resultIsPending = result && outgoing.some(person => person.id === result.id);
  const resultIsIncoming = result && incoming.some(person => person.id === result.id);

  const resetButton = <button type="button" className="mt-3 min-h-9 w-full text-center text-[10px] text-[#756b5c] underline underline-offset-2" onClick={reset}>Вернуть исходные данные</button>;

  if (layout === "tiles") return <div className="mx-auto w-full max-w-[420px]">
    <div className="overflow-visible rounded-[28px] border border-black bg-white p-3">
      <FriendsPanel
        key={resetCount}
        friendCode={9002}
        overview={{ friends: friends.map(toFriend), requests: [...incoming.map(person => toRequest(person, "incoming")), ...outgoing.map(person => toRequest(person, "outgoing"))] }}
        search={{ query, results: searchedCode === null ? null : result ? [toFriend(result)] : [], error: searchError, onChange: value => { setQuery(value); setSearchedCode(null); setSearchError(""); }, onSubmit: () => runSearch(query), hint: <button type="button" className="mt-1 min-h-7 text-[10px] font-semibold text-[#c2410c] underline underline-offset-2" onClick={() => runSearch("9005")}>Попробовать код 9005</button> }}
        onCopy={() => void copyCode()}
        onAdd={person => { const target = directory.find(entry => entry.id === person.id); if (target) { setOutgoing(current => [...current, target]); notify(`Заявка для ${target.name} отправлена`); } }}
        onRespond={(request, accepted) => {
          const target = incoming.find(person => person.id === request.playerId);
          if (!target) return;
          if (accepted) accept(target);
          else { setIncoming(current => current.filter(person => person.id !== target.id)); notify("Заявка отклонена"); }
        }}
        onRemove={person => { const target = friends.find(entry => entry.id === person.id); if (target) remove(target); }}
        onCancel={request => { setOutgoing(current => current.filter(person => person.id !== request.playerId)); notify("Заявка отменена"); }}
      />
    </div>
    {resetButton}
  </div>;

  const codeBlock = <div className="flex items-center justify-between gap-3">
    <div><p className="text-[10px] text-[#756b5c]">Ваш код дружбы</p><p className="mt-0.5 font-mono text-lg font-semibold tracking-widest">9002</p></div>
    <button type="button" className="game-button game-button--neutral game-button--step border-black!" aria-label="Скопировать код дружбы" onClick={() => void copyCode()}><Icon name="copy" /></button>
  </div>;
  const searchBlock = <div>
    <form onSubmit={onSearch}>
      <label className="mb-2 block text-xs font-semibold" htmlFor={`${prefix}-search`}>Найти друга по коду</label>
      <div className={`flex gap-2 ${layout === "directory" ? "flex-col" : "items-center"}`}>
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#756b5c]"><Icon name="search" /></span>
          <input ref={input} id={`${prefix}-search`} type="search" inputMode="numeric" autoComplete="off" maxLength={12} placeholder="Код друга" value={query} onChange={event => { setQuery(event.target.value); setSearchError(""); setSearchedCode(null); }} aria-invalid={!!searchError} aria-describedby={`${prefix}-search-help`} className="h-11 w-full min-w-0 rounded-xl border border-black bg-white pr-2 pl-9 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8603c]" />
        </div>
        <button type="submit" className="game-button shrink-0" disabled={!query.trim()}><Icon name="search" />Найти</button>
      </div>
      <p id={`${prefix}-search-help`} className="mt-2 text-[10px] leading-4 text-[#756b5c]">Попросите друга прислать его код.</p>
    </form>
    <button type="button" className="mt-1 min-h-7 text-[10px] font-semibold text-[#c2410c] underline underline-offset-2" onClick={() => runSearch("9005")}>Попробовать код 9005</button>
    {searchError && <p role="alert" className="mt-2 text-xs text-red-600">{searchError}</p>}
    <p className="sr-only" role="status">{searchedCode !== null ? result ? `Найден игрок: ${result.name}` : "Игрок не найден" : ""}</p>
    {searchedCode !== null && <div className="mt-3">
      {result ? <div className="game-card p-3">
        <PersonRow person={result} />
        <button type="button" className={`game-button game-button--sm mt-3 w-full${resultIsFriend || resultIsPending ? " game-button--neutral" : ""}`} disabled={!!resultIsFriend || !!resultIsPending} onClick={() => {
          if (resultIsIncoming) accept(result);
          else { setOutgoing(current => [...current, result]); notify(`Заявка для ${result.name} отправлена`); }
        }}>{resultIsFriend ? "Уже в друзьях" : resultIsPending ? "Заявка отправлена" : resultIsIncoming ? "Принять заявку" : "Добавить в друзья"}</button>
      </div> : <p className="rounded-xl bg-neutral-50 p-3 text-xs leading-5 text-[#756b5c]">Игрок с кодом {searchedCode} не найден. Проверьте код и попробуйте ещё раз.</p>}
    </div>}
  </div>;

  const navigation = <div className={`flex items-center ${layout === "directory" ? "gap-1 rounded-full border border-black p-1" : "border-b border-neutral-200"}`} role="group" aria-label="Список друзей">
    {([["all", "Все", friends.length], ["online", "В сети", online.length], ["requests", "Заявки", requestsCount]] as const).map(([id, label, count]) => <button key={id} type="button" aria-pressed={view === id} className={`relative flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1 px-1 text-[11px] font-medium outline-none focus-visible:outline-2 focus-visible:outline-[#e8603c] ${layout === "directory" ? `rounded-full ${view === id ? "bg-[#e8603c] text-white" : "text-[#756b5c]"}` : view === id ? "text-[#2b2a27] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#e8603c]" : "text-[#756b5c]"}`} onClick={() => setView(id)}>{label}<span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] ${layout === "directory" && view === id ? "bg-white/20 text-white" : "bg-neutral-100 text-[#594f43]"}`}>{count}</span></button>)}
  </div>;

  const friendsList = visible.length === 0 ? <Empty>{view === "online" ? "Сейчас никого нет в сети." : "Добавьте первого друга по его коду."}</Empty> : <div className={layout === "directory" ? "game-card divide-y divide-neutral-200 px-3" : "flex flex-col gap-2"}>
    {visible.map(person => <article key={person.id} className={layout === "directory" ? "py-3" : "game-card p-3"}><PersonRow person={person} action={<FriendActions person={person} onRemove={() => remove(person)} />} /></article>)}
  </div>;

  const requests = <div className="flex flex-col gap-4">
    {incoming.length > 0 && <section aria-label="Входящие заявки">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#756b5c]">Входящие · {incoming.length}</p>
      <div className="flex flex-col gap-2">{incoming.map(person => <article key={person.id} className="game-card p-3">
        <PersonRow person={person} />
        <div className="mt-3 flex gap-2">
          <button type="button" className="game-button game-button--sm flex-1" aria-label={`Принять заявку от ${person.name}`} onClick={() => accept(person)}>Принять</button>
          <button type="button" className="game-button game-button--danger game-button--sm flex-1" aria-label={`Отклонить заявку от ${person.name}`} onClick={() => { setIncoming(current => current.filter(entry => entry.id !== person.id)); notify("Заявка отклонена"); }}>Отклонить</button>
        </div>
      </article>)}</div>
    </section>}
    {outgoing.length > 0 && <section aria-label="Исходящие заявки">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#756b5c]">Исходящие · {outgoing.length}</p>
      <div className="flex flex-col gap-2">{outgoing.map(person => <article key={person.id} className="game-card p-3">
        <PersonRow person={person} />
        <p className="mt-2 text-[10px] text-[#756b5c]">Ожидает ответа</p>
        <button type="button" className="game-button game-button--danger game-button--sm mt-2 w-full" aria-label={`Отменить заявку для ${person.name}`} onClick={() => { setOutgoing(current => current.filter(entry => entry.id !== person.id)); notify("Заявка отменена"); }}>Отменить заявку</button>
      </article>)}</div>
    </section>}
    {requestsCount === 0 && <Empty>Новых заявок пока нет.</Empty>}
  </div>;

  return <div className="mx-auto w-full max-w-[420px]">
    <div className="overflow-visible rounded-[28px] border border-black bg-white p-3 text-[#2b2a27]">
      <header className="flex items-center justify-between gap-2 px-1 py-2">
        <div><p className="text-[10px] text-[#756b5c]">Ваша компания</p><h4 className="mt-0.5 text-xl font-bold">Друзья</h4></div>
        <span className="game-badge" data-tone="ready"><span className="game-badge-dot" />{online.length} в сети</span>
      </header>
      {layout === "feed" ? <section className="game-card mt-3 p-3" aria-label="Поиск и код дружбы">
        {codeBlock}<div className="mt-3 border-t border-neutral-200 pt-3">{searchBlock}</div>
      </section> : <section className="game-card mt-3 p-3" aria-label="Поиск и код дружбы">
        <h5 className="mb-3 text-sm font-bold">Найти своих</h5>{searchBlock}<div className="mt-3 border-t border-neutral-200 pt-3">{codeBlock}</div>
      </section>}
      <div className="mt-4">{navigation}</div>
      <div className="mt-3 min-h-52">{view === "requests" ? requests : friendsList}</div>
    </div>
    {resetButton}
  </div>;
}

export default function FriendsLayoutSamples({ notify }: SampleActions) {
  return <Specimen preserveStyle title="Вкладка «Друзья» · варианты на выбор" usage="Поиск по коду · Друзья · Входящие и исходящие заявки" wide>
    <p className="mb-5 text-xs leading-5 text-[#756b5c]">Сравните три макета. Поиск, фильтры и заявки работают на примерах. Для поиска можно использовать код 9005.</p>
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-start gap-5">
      {layouts.map(({ id, title, description }) => <section key={id} className="min-w-0" aria-labelledby={`friends-layout-${id}`}>
        <div className="mx-auto mb-4 max-w-[420px]"><h4 id={`friends-layout-${id}`} className="text-sm font-bold text-[#2b2a27]">{title}</h4><p className="mt-1 min-h-10 text-[11px] leading-5 text-[#756b5c]">{description}</p></div>
        <FriendsPreview layout={id} notify={notify} />
      </section>)}
    </div>
  </Specimen>;
}
