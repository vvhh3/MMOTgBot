import { useId, useRef, useState, type ReactNode } from "react";
import LevelBadge from "../../../shared/ui/LevelBadge";

type Person = { name: string; level: number; online?: boolean };

export function FriendIcon({ name }: { name: "search" | "copy" | "people" | "plus" | "more" | "trash" }) {
  const paths: Record<typeof name, ReactNode> = {
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    people: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6m4 11v-3a6 6 0 0 0-4-5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></>,
  };
  return <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function FriendAvatar({ person, large = false }: { person: Person; large?: boolean }) {
  return <div className={`relative flex shrink-0 items-center justify-center rounded-full border border-black bg-white font-bold text-[#594f43] ${large ? "h-14 w-14 text-lg" : "h-10 w-10 text-sm"}`}>
    {Array.from(person.name.trim())[0]?.toLocaleUpperCase("ru") || "?"}
    {typeof person.online === "boolean" && <span aria-hidden="true" className={`absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full ring-2 ring-white ${person.online ? "bg-green-500" : "bg-neutral-400"}`} />}
  </div>;
}

export function FriendPresence({ online }: { online: boolean }) {
  return <span className={`text-[10px] leading-4 ${online ? "text-green-700" : "text-[#756b5c]"}`}>{online ? "В сети" : "Не в сети"}</span>;
}

export function FriendRow({ person, action }: { person: Person; action?: ReactNode }) {
  return <div className="flex min-w-0 items-center gap-2.5">
    <FriendAvatar person={person} />
    <div className="min-w-0 flex-1">
      <p className="truncate text-[13px] font-semibold" title={person.name}>{person.name}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5"><LevelBadge level={person.level} />{typeof person.online === "boolean" && <FriendPresence online={person.online} />}</div>
    </div>
    {action}
  </div>;
}

export function FriendActions({ person, onRemove, disabled = false }: { person: Person; onRemove: () => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  return <div className="relative shrink-0" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={event => {
    if (event.key === "Escape") { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
  }}>
    <button type="button" ref={trigger} className="game-button game-button--neutral game-button--step border-black!" aria-label={`Действия: ${person.name}`} aria-expanded={open} aria-controls={open ? menuId : undefined} disabled={disabled} onClick={() => setOpen(!open)}><FriendIcon name="more" /></button>
    {open && <div id={menuId} role="group" aria-label={`Действия с другом ${person.name}`} className="game-card absolute top-full right-0 z-10 mt-1 min-w-32 p-2">
      <button type="button" className="game-button game-button--danger game-button--sm w-full" aria-label={`Удалить друга ${person.name}`} disabled={disabled} onClick={onRemove}><FriendIcon name="trash" />Удалить</button>
    </div>}
  </div>;
}

export function FriendsEmpty({ children }: { children: ReactNode }) {
  return <div className="flex flex-col items-center gap-2 px-3 py-7 text-center text-xs leading-5 text-[#756b5c]"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-[#e8603c]"><FriendIcon name="people" /></span>{children}</div>;
}
