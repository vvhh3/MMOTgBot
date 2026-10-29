export function CasinoCellIcon({ state }: { state: "closed" | "safe" | "bomb" }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {state === "bomb" ? <><circle cx="10" cy="14" r="7" /><path d="m15 9 3-3c1-1 1-3-1-3h-1m5-1v1m2 3h-1" /></> : state === "safe" ? <path d="m12 3 8 9-8 9-8-9Zm-8 9h16M12 3l-3 9 3 9 3-9-3-9" /> : <path d="m12 4 2.3 5.7L20 12l-5.7 2.3L12 20l-2.3-5.7L4 12l5.7-2.3Z" />}
  </svg>;
}

