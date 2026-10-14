import { useEffect, useState } from "react";
import { Badge, Button, Card, Text } from "@radix-ui/themes";
import type { CasinoSessionResponse, PlayerDto } from "@mmobot/shared";
import { blackjackAction, getCasinoSession, startCasinoGame } from "../api";
import PlayingCard from "./casino/PlayingCard";
import { getLocationImage } from "../utils/getLocationImage";

type Props = { token: string | null; player: PlayerDto | null; onPlayer: (player: PlayerDto) => void };
export default function BlackjackGame({ token, player, onPlayer }: Props) {
  const [session, setSession] = useState<CasinoSessionResponse | null>(null); const [bet, setBet] = useState(10); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => { if (token) getCasinoSession(token).then((s) => { if (s.game === "blackjack") setSession(s); }).catch(() => undefined); }, [token]);
  const run = async (work: () => Promise<CasinoSessionResponse>) => { setLoading(true); setError(""); try { const next = await work(); setSession(next); onPlayer(next.player); } catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); } finally { setLoading(false); } };
  const game = session?.blackjack;
  const validBet = Number.isInteger(bet) && bet > 0 && bet <= (player?.money ?? 0);
  return <div className="flex h-full min-h-0 w-full items-start justify-center overflow-x-hidden overflow-y-auto bg-cover bg-center px-2 py-2 sm:items-center sm:px-3" style={{ backgroundImage: `url(${getLocationImage("market-fight.svg")})` }}>
    <Card className="my-auto w-full max-w-xl shrink-0 overflow-hidden border-[#76678e]! bg-[#251c3c]/95! p-0! text-[#f7f3ff] shadow-2xl">
      <section className="flex flex-col gap-3 bg-[#251c3c]/95! p-2 sm:p-3">
        <div className="flex items-center justify-between gap-2">
          <Text size="4" weight="bold">Blackjack · 21</Text>
          <Badge className="bg-[#5b3c2d]! px-3! py-2! text-[#ffb545]!" color="orange">Монет: {session?.player.money ?? player?.money ?? 0}</Badge>
        </div>
        <Text className="text-[#c9bed9]" size="1">Наберите больше очков, чем дилер, но не превысьте 21.</Text>
        {session && <div className="flex items-center justify-between gap-2 text-sm sm:text-base"><Text className="whitespace-nowrap text-[#c9bed9]" weight="medium">Ставка: {session.bet}</Text><Text weight="bold">Игрок против дилера</Text></div>}
        {session && <>
          <section className="rounded-xl border border-[#76678e] bg-[#211936]/80 p-2.5 sm:p-3">
            <Text as="div" weight="bold" className="mb-3">Дилер {game?.dealerTotal !== undefined ? `· ${game.dealerTotal} очков` : "· ? очков"}</Text>
            <div className="flex min-h-24 flex-wrap justify-center gap-2 sm:justify-start">
              {game?.dealerCards.map((card, i) => <PlayingCard key={i} card={card} />)}
            </div>
          </section>
          <section className="rounded-xl border border-[#76678e] bg-[#211936]/80 p-2.5 sm:p-3">
            <Text as="div" weight="bold" className="mb-3">Вы · {game?.playerTotal} очков</Text>
            <div className="flex min-h-24 flex-wrap justify-center gap-2 sm:justify-start">
              {game?.playerCards.map((card, i) => <PlayingCard key={i} card={card} />)}
            </div>
          </section>
        </>}
      </section>

      <section className="flex flex-col gap-3 border-t border-[#594d70] bg-[#211936]/95 p-3 text-[#f7f3ff]">
        {error && <Text role="alert" align="center" color="red" weight="bold">{error}</Text>}
        {!session ? <>
          <label className="flex flex-col gap-2">
            <span className="flex items-center justify-between gap-3"><Text size="2" weight="bold">Ставка в монетах</Text><Text className="text-[#b9adc9]" size="2">Доступно: {player?.money ?? 0}</Text></span>
            <input className="h-10 w-full rounded-lg border border-[#76678e] bg-[#171126] px-3 text-lg font-medium text-[#f7f3ff] outline-none focus:border-[#ffb545]" type="number" min="1" max={String(player?.money ?? 0)} value={String(bet)} onChange={(event) => setBet(Number(event.target.value))} />
          </label>
          <Text className="text-[#b9adc9]" size="1">Дилер берёт карты до 17. Blackjack оплачивается 3:2.</Text>
          <Button className="h-12! w-full bg-[#ffb545]! text-base! font-bold! text-[#20162f]!" color="orange" size="3" disabled={!token || loading || !validBet} onClick={() => run(() => startCasinoGame(token!, "blackjack", bet))}>Раздать карты</Button>
        </> : session.status === "active" ? <div className="grid grid-cols-2 gap-3"><Button className="h-12! bg-[#ffb545]! text-base! font-bold! text-[#20162f]!" color="orange" size="3" disabled={loading} onClick={() => run(() => blackjackAction(token!, "hit"))}>Ещё</Button><Button className="h-12! border-[#ffb545]! text-base! font-bold! text-[#ffb545]!" color="orange" variant="outline" size="3" disabled={loading} onClick={() => run(() => blackjackAction(token!, "stand"))}>Хватит</Button></div> : <><Text as="div" align="center" weight="bold" color={session.status === "won" ? "green" : "red"}>{game?.result}{session.potentialPayout > 0 && ` · Выплата ${session.potentialPayout}`}</Text><Button className="h-12! w-full bg-[#ffb545]! text-base! font-bold! text-[#20162f]!" color="orange" size="3" onClick={() => setSession(null)}>Новая игра</Button></>}
      </section>
    </Card>
  </div>;
}
