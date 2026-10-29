import type { FriendDto, FriendRequestDto, FriendsOverviewResponse } from "@mmobot/shared";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import LevelBadge from "../../../shared/ui/LevelBadge";
import { FriendActions, FriendAvatar, FriendIcon, FriendPresence, FriendRow, FriendsEmpty } from "./FriendUi";

type FriendsPanelProps = {
  friendCode: number | null;
  overview: FriendsOverviewResponse;
  search: {
    query: string;
    results: FriendDto[] | null;
    loading?: boolean;
    error?: string | null;
    onChange: (value: string) => void;
    onSubmit: () => void;
    hint?: ReactNode;
  };
  loading?: boolean;
  busy?: boolean;
  disabled?: boolean;
  error?: string | null;
  notice?: string | null;
  onCopy: () => void;
  onAdd: (person: FriendDto) => void;
  onRespond: (request: FriendRequestDto, accept: boolean) => void;
  onRemove: (person: FriendDto) => void;
  onCancel: (request: FriendRequestDto) => void;
};

export default function FriendsPanel({ friendCode, overview, search, loading = false, busy = false, disabled = false, error, notice, onCopy, onAdd, onRespond, onRemove, onCancel }: FriendsPanelProps) {
  const [view, setView] = useState<"all" | "online" | "requests">("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const prefix = useId();
  const incoming = overview.requests.filter(request => request.direction === "incoming");
  const outgoing = overview.requests.filter(request => request.direction === "outgoing");
  const online = overview.friends.filter(person => person.online);
  const visible = view === "online" ? online : overview.friends;
  const actionsDisabled = busy || disabled || loading;

  useEffect(() => {
    if (searchOpen) input.current?.focus();
  }, [searchOpen]);

  return <div className="text-[#2b2a27]">
    <header className="flex items-center justify-between gap-2 px-1 py-2">
      <div><p className="text-[10px] text-[#756b5c]">Ваша компания</p><h1 className="mt-0.5 text-xl font-bold">Друзья</h1></div>
      <button type="button" className="game-button game-button--icon" aria-label={searchOpen ? "Скрыть поиск друга" : "Найти друга"} aria-expanded={searchOpen} aria-controls={`${prefix}-search-panel`} onClick={() => setSearchOpen(!searchOpen)}><FriendIcon name="plus" /></button>
    </header>

    <section className="game-card mt-3 p-3" aria-label="Код дружбы">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-[10px] text-[#756b5c]">Ваш код дружбы</p><p className="mt-0.5 font-mono text-lg font-semibold tracking-widest">{friendCode ?? "—"}</p></div>
        <button type="button" className="game-button game-button--neutral game-button--step border-black!" aria-label="Скопировать код дружбы" disabled={friendCode === null} onClick={onCopy}><FriendIcon name="copy" /></button>
      </div>
    </section>

    <section id={`${prefix}-search-panel`} hidden={!searchOpen} className="game-card mt-2 p-3" aria-label="Поиск друга">
      <form onSubmit={event => { event.preventDefault(); search.onSubmit(); }}>
        <label className="mb-2 block text-xs font-semibold" htmlFor={`${prefix}-search`}>Найти друга по коду</label>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#756b5c]"><FriendIcon name="search" /></span>
            <input ref={input} id={`${prefix}-search`} type="search" inputMode="numeric" autoComplete="off" maxLength={12} placeholder="Код друга" value={search.query} onChange={event => search.onChange(event.target.value)} aria-invalid={!!search.error} aria-describedby={`${prefix}-search-help${search.error ? ` ${prefix}-search-error` : ""}`} className="h-11 w-full min-w-0 rounded-xl border border-black bg-white pr-2 pl-9 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8603c]" />
          </div>
          <button type="submit" className="game-button shrink-0" disabled={disabled || search.loading || !search.query.trim()} aria-busy={!!search.loading}><FriendIcon name="search" />{search.loading ? "Поиск…" : "Найти"}</button>
        </div>
        <p id={`${prefix}-search-help`} className="mt-2 text-[10px] leading-4 text-[#756b5c]">Попросите друга прислать его код.</p>
      </form>
      {search.hint}
      {search.error && <p id={`${prefix}-search-error`} role="alert" className="mt-2 text-xs text-red-600">{search.error}</p>}
      <p className="sr-only" role="status">{search.loading ? "Ищем игрока" : search.results !== null ? search.results.length > 0 ? `Найдено игроков: ${search.results.length}` : "Игрок не найден" : ""}</p>
      {search.results !== null && !search.loading && <div className="mt-3 flex flex-col gap-2">
        {search.results.length === 0 ? <p className="rounded-xl bg-neutral-50 p-3 text-xs leading-5 text-[#756b5c]">Игрок не найден. Проверьте код и попробуйте ещё раз.</p> : search.results.map(person => {
          const isFriend = overview.friends.some(friend => friend.id === person.id);
          const pending = outgoing.some(request => request.playerId === person.id);
          const received = incoming.find(request => request.playerId === person.id);
          return <article key={person.id} className="game-card p-3">
            <FriendRow person={person} />
            <button type="button" className={`game-button game-button--sm mt-3 w-full${isFriend || pending ? " game-button--neutral" : ""}`} disabled={actionsDisabled || isFriend || pending} onClick={() => received ? onRespond(received, true) : onAdd(person)}>{isFriend ? "Уже в друзьях" : pending ? "Заявка отправлена" : received ? "Принять заявку" : "Добавить в друзья"}</button>
          </article>;
        })}
      </div>}
    </section>

    <div className="mt-3 grid grid-cols-2 gap-2">
      <div className="rounded-2xl bg-neutral-50 p-3"><p className="text-xl font-bold">{overview.friends.length}</p><p className="mt-1 text-[10px] text-[#756b5c]">друзей</p></div>
      <div className="rounded-2xl bg-neutral-50 p-3"><p className="text-xl font-bold text-green-700">{online.length}</p><p className="mt-1 text-[10px] text-[#756b5c]">сейчас в сети</p></div>
    </div>
    {error && <p role="alert" className="mt-3 text-xs leading-5 text-red-600">{error}</p>}
    <p role="status" className={notice ? "mt-3 text-xs leading-5 text-green-700" : "sr-only"}>{notice}</p>

    <div className="mt-4 flex items-center border-b border-neutral-200" role="group" aria-label="Список друзей">
      {([["all", "Все", overview.friends.length], ["online", "В сети", online.length], ["requests", "Заявки", overview.requests.length]] as const).map(([id, label, count]) => <button key={id} type="button" aria-pressed={view === id} className={`relative flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1 px-1 text-[11px] font-medium outline-none focus-visible:outline-2 focus-visible:outline-[#e8603c] ${view === id ? "text-[#2b2a27] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#e8603c]" : "text-[#756b5c]"}`} onClick={() => setView(id)}>{label}<span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-100 px-1 text-[9px] text-[#594f43]">{count}</span></button>)}
    </div>

    <div className="mt-3 min-h-52" aria-busy={loading}>
      {loading && overview.friends.length === 0 && overview.requests.length === 0 ? <p role="status" className="py-7 text-center text-xs text-[#756b5c]">Загружаем список друзей…</p> : view === "requests" ? <div className="flex flex-col gap-4">
        {incoming.length > 0 && <section aria-label="Входящие заявки">
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#756b5c]">Входящие · {incoming.length}</h2>
          <div className="flex flex-col gap-2">{incoming.map(request => <article key={request.id} className="game-card p-3">
            <FriendRow person={request} />
            <div className="mt-3 flex gap-2">
              <button type="button" className="game-button game-button--sm flex-1" disabled={actionsDisabled} aria-label={`Принять заявку от ${request.name}`} onClick={() => onRespond(request, true)}>Принять</button>
              <button type="button" className="game-button game-button--danger game-button--sm flex-1" disabled={actionsDisabled} aria-label={`Отклонить заявку от ${request.name}`} onClick={() => onRespond(request, false)}>Отклонить</button>
            </div>
          </article>)}</div>
        </section>}
        {outgoing.length > 0 && <section aria-label="Исходящие заявки">
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#756b5c]">Исходящие · {outgoing.length}</h2>
          <div className="flex flex-col gap-2">{outgoing.map(request => <article key={request.id} className="game-card p-3">
            <FriendRow person={request} />
            <p className="mt-2 text-[10px] text-[#756b5c]">Ожидает ответа</p>
            <button type="button" className="game-button game-button--danger game-button--sm mt-2 w-full" disabled={actionsDisabled} aria-label={`Отменить заявку для ${request.name}`} onClick={() => onCancel(request)}>Отменить заявку</button>
          </article>)}</div>
        </section>}
        {overview.requests.length === 0 && <FriendsEmpty>Новых заявок пока нет.</FriendsEmpty>}
      </div> : visible.length === 0 ? <FriendsEmpty>{view === "online" ? "Сейчас никого нет в сети." : "Добавьте первого друга по его коду через «+»."}</FriendsEmpty> : <div className="grid grid-cols-2 gap-2">
        {visible.map(person => <article key={person.id} className="game-card flex min-w-0 flex-col items-center gap-2 p-3 text-center">
          <div className="flex w-full justify-end"><FriendActions person={person} disabled={actionsDisabled} onRemove={() => onRemove(person)} /></div>
          <FriendAvatar person={person} large />
          <p className="w-full truncate text-[13px] font-semibold" title={person.name}>{person.name}</p>
          <LevelBadge level={person.level} className="self-center!" />
          <FriendPresence online={person.online} />
        </article>)}
      </div>}
    </div>
  </div>;
}
