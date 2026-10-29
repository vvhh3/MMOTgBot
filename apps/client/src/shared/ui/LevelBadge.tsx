export default function LevelBadge({ level, className = "" }: { level: number; className?: string }) {
  return <span className={`level-badge self-start ${className}`}>
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" /></svg>
    <span>Ур.</span><strong>{level}</strong>
  </span>;
}
