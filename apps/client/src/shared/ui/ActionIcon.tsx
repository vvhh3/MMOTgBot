const iconShapes = {
  walk: '<circle cx="13" cy="4" r="2"/><path d="m7 21 3-6m6 6-2-5-3-3 1-5m-6 4 3-4h3l3 4 4 1"/>',
  fight: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4m-1 1 2-2M14.5 6.5 18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3m-1-1 2 2"/>',
  fountain: '<path d="M5 6c0-3 4-4 7-1 3-3 7-2 7 1M12 3v7M7 10h10a5 3 0 0 1-10 0ZM12 13v3M3 16h18a9 5 0 0 1-18 0ZM12 21v1M8 22h8"/>',
  shop: '<path d="m3 9 2-6h14l2 6M4 12v9h16v-9M9 21v-6h6v6M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0ZM9 3v6m6-6v6"/>',
  exchange: '<path d="M4 7h16l-4-4m4 4-4 4M20 17H4l4-4m-4 4 4 4"/>',
  mines: '<circle cx="11" cy="14" r="7"/><path d="m16 9 2-2c1-1 1-3-1-3h-1M19 2v1m3 2h-1M8 11a4 4 0 0 0-1 3"/>',
  blackjack: '<rect x="8" y="6" width="12" height="15" rx="2"/><path d="M6 18H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2m-2 5-3 4 3 4 3-4-3-4Z"/>',
  ladder: '<path d="M6 3v18M18 3v18M6 5h12M6 10h12M6 15h12M6 20h12"/>',
  group: '<circle cx="12" cy="7" r="3"/><path d="M7 21v-3a5 5 0 0 1 10 0v3M5 5a3 3 0 0 0 0 6m14-6a3 3 0 0 1 0 6M2 20v-2a4 4 0 0 1 3-4m17 6v-2a4 4 0 0 0-3-4"/>',
} as const;

export type ActionIconName = keyof typeof iconShapes;
export function ActionIcon({ name }: { name: ActionIconName }) {
 return <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-[#e8603c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: iconShapes[name] }} />;
}
