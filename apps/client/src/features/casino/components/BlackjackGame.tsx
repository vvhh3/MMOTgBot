import type { CasinoSessionResponse,PlayerDto } from "@mmobot/shared";
import { Badge,Button,Card,Text } from "@radix-ui/themes";
import { useEffect,useState } from "react";
import { getLocationImage } from "../../locations/lib/getLocationImage";
import { blackjackAction,getCasinoSession,startCasinoGame } from "../api";
import PlayingCard from "./PlayingCard";

type Props = { token: string | null; player: PlayerDto | null; onPlayer: (player: PlayerDto) => void };
export default function BlackjackGame({ token, player, onPlayer }: Props) {
  const [session, setSession] = useState<CasinoSessionResponse | null>(null); const [bet, setBet] = useState(10); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => { if (token) getCasinoSession(token).then((s) => { if (s.game === "blackjack") setSession(s); }).catch(() => undefined); }, [token]);
  const run = async (work: () => Promise<CasinoSessionResponse>) => { setLoading(true); setError(""); try { const next = await work(); setSession(next); onPlayer(next.player); } catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); } finally { setLoading(false); } };
  const game = session?.blackjack;
  const validBet = Number.isInteger(bet) && bet > 0 && bet <= (player?.money ?? 0);
  return <div className="flex h-full min-h-0 w-full items-start justify-center overflow-x-hidden overflow-y-auto bg-cover bg-center px-2 py-2 sm:items-center sm:px-3" style={{ backgroundImage: `url(${getLocationImage("market-fight.svg")})` }}>
    <Card className="game-card game-card--glass my-auto w-full max-w-xl shrink-0 overflow-hidden p-0!">
      <section className="flex flex-col gap-3 p-2 sm:p-3">
        <div className="flex items-center justify-between gap-2">
          <Text size="4" weight="bold">Blackjack · 21</Text>
          <Badge className="game-badge" color="orange">Монет: {session?.player.money ?? player?.money ?? 0}</Badge>
        </div>
        <Text className="text-[#756b5c]" size="1">Наберите больше очков, чем дилер, но не превысьте 21.</Text>
        {session && <div className="flex items-center justify-between gap-2 text-sm sm:text-base"><Text className="whitespace-nowrap text-[#756b5c]" weight="medium">Ставка: {session.bet}</Text><Text weight="bold">Игрок против дилера</Text></div>}
        {session && <>
          <section className="casino-field p-2.5 sm:p-3">
            <Text as="div" weight="bold" className="mb-3">Дилер {game?.dealerTotal !== undefined ? `· ${game.dealerTotal} очков` : "· ? очков"}</Text>
            <div className="flex min-h-24 flex-wrap justify-center gap-2 sm:justify-start">
              {game?.dealerCards.map((card, i) => <PlayingCard key={i} card={card} />)}
            </div>
          </section>
          <section className="casino-field p-2.5 sm:p-3">
            <Text as="div" weight="bold" className="mb-3">Вы · {game?.playerTotal} очков</Text>
            <div className="flex min-h-24 flex-wrap justify-center gap-2 sm:justify-start">
              {game?.playerCards.map((card, i) => <PlayingCard key={i} card={card} />)}
            </div>
          </section>
        </>}
      </section>

      <section className="flex flex-col gap-3 border-t border-white/80 p-3">
        {error && <Text role="alert" align="center" color="red" weight="bold">{error}</Text>}
        {!session ? <>
          <label className="flex flex-col gap-2">
            <span className="flex items-center justify-between gap-3"><Text size="2" weight="bold">Ставка в монетах</Text><Text className="text-[#756b5c]" size="2">Доступно: {player?.money ?? 0}</Text></span>
            <input className="game-input w-full" type="number" min="1" max={String(player?.money ?? 0)} value={String(bet)} onChange={(event) => setBet(Number(event.target.value))} />
          </label>
          <Text className="text-[#756b5c]" size="1">Дилер берёт карты до 17. Blackjack оплачивается 3:2.</Text>
          <Button className="game-button game-button--glass w-full" color="orange" size="3" disabled={!token || loading || !validBet} onClick={() => run(() => startCasinoGame(token!, "blackjack", bet))}>Раздать карты</Button>
        </> : session.status === "active" ? <div className="grid grid-cols-2 gap-3"><Button className="game-button game-button--glass w-full" color="orange" size="3" disabled={loading} onClick={() => run(() => blackjackAction(token!, "hit"))}>Ещё</Button><Button className="game-button game-button--outline w-full" color="orange" variant="outline" size="3" disabled={loading} onClick={() => run(() => blackjackAction(token!, "stand"))}>Хватит</Button></div> : <><Text as="div" align="center" weight="bold" color={session.status === "won" ? "green" : "red"}>{game?.result}{session.potentialPayout > 0 && ` · Выплата ${session.potentialPayout}`}</Text><Button className="game-button game-button--glass w-full" color="orange" size="3" onClick={() => setSession(null)}>Новая игра</Button></>}
      </section>
    </Card>
  </div>;
}
