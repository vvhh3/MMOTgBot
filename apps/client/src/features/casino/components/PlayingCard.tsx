import type { PlayingCardDto } from "@mmobot/shared";

const suitSymbols = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" } as const;

export default function PlayingCard({ card }: { card: PlayingCardDto | null }) {
  if (!card) return <div aria-label="Закрытая карта" className="playing-card playing-card--closed flex h-24 w-16 items-center justify-center text-2xl">✦</div>;
  const red = card.suit === "hearts" || card.suit === "diamonds";
  return <div aria-label={`${card.rank} ${card.suit}`} className={`playing-card flex h-24 w-16 flex-col justify-between p-2 font-bold ${red ? "text-[#C83F2A]" : "text-[#2B2A27]"}`}>
    <span>{card.rank}</span><span className="self-center text-3xl">{suitSymbols[card.suit]}</span><span className="rotate-180 self-end">{card.rank}</span>
  </div>;
}
