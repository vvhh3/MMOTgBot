import { CasinoCellIcon } from "./CasinoCellIcon";
import type { CasinoSessionResponse,PlayerDto } from "@mmobot/shared";
import { Badge,Button,Card,Text } from "@radix-ui/themes";
import { useEffect,useState } from "react";
import { getLocationImage } from "../../locations/lib/getLocationImage";
import { cashoutMines,getCasinoSession,revealMineCell,startCasinoGame } from "../api";
type Props = { token: string | null; player: PlayerDto | null; onPlayer: (player: PlayerDto) => void };

export default function MinesGame({ token, player, onPlayer }: Props) {
  const [session, setSession] = useState<CasinoSessionResponse | null>(null);
  const [bet, setBet] = useState(10); const [mineCount, setMineCount] = useState(3);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => { if (token) getCasinoSession(token).then((s) => { if (s.game === "mines") setSession(s); }).catch(() => undefined); }, [token]);
  const run = async (work: () => Promise<CasinoSessionResponse>) => { setLoading(true); setError(""); try { const next = await work(); setSession(next); onPlayer(next.player); } catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); } finally { setLoading(false); } };
  const opened = new Set(session?.mines?.revealed ?? []);
  const revealedBombs = session?.status !== "active" ? session?.mines?.bombCells : undefined;
  const validBet = Number.isInteger(bet) && bet > 0 && bet <= (player?.money ?? 0);
  return(
  <div className="flex h-full min-h-0 w-full items-start justify-center overflow-x-hidden overflow-y-auto bg-cover bg-center px-2 py-2 sm:items-center sm:px-3" style={{backgroundImage: `url(${getLocationImage("market-fight.svg")})`}}>
    <Card className="game-card game-card--glass my-auto w-full max-w-xl shrink-0 overflow-hidden p-0!">
      <section className="p-2 sm:p-3">
          <div className="mb-2 flex w-full items-center justify-between gap-1.5 text-xs min-[380px]:gap-2 min-[380px]:text-sm sm:text-base">
            <Text className="min-w-0 whitespace-nowrap text-[#756b5c]" weight="medium">Ставка: {session?.bet ?? bet}</Text>
            <Badge className="game-badge" color="orange">×{session?.multiplier ?? 1}</Badge>
            <Text className="min-w-0 whitespace-nowrap" weight="bold">Забрать: {session?.potentialPayout ?? 0}</Text>
          </div>
          <div className="mx-auto grid w-full max-w-[34rem] grid-cols-5 gap-1.5 sm:gap-2">{Array.from({ length: 25 }, (_, cell) => {
            const exploded = session?.mines?.explodedCell === cell;
            const isBomb = exploded || (revealedBombs?.includes(cell) ?? false);
            const isSafe = !isBomb && (opened.has(cell) || revealedBombs !== undefined);
            return <button key={cell} aria-label={`Клетка ${cell + 1}: ${isBomb ? "бомба" : isSafe ? "безопасно" : "закрыта"}`} disabled={!session || loading || session.status !== "active" || opened.has(cell)} onClick={() => run(() => revealMineCell(token!, cell))} className="casino-cell aspect-square" data-state={isBomb ? "bomb" : isSafe ? "safe" : "closed"} data-exploded={exploded || undefined}><CasinoCellIcon state={isBomb ? "bomb" : isSafe ? "safe" : "closed"} /></button>;
          })}</div>
      </section>

      <section className="flex flex-col gap-3 border-t border-white/80 p-3">
        {error && <Text role="alert" align="center" color="red" weight="bold">{error}</Text>}
        {session?.status == "active" ?
        <Button className="game-button game-button--glass w-full" color="orange" size="3" disabled={loading || opened.size === 0} onClick={() => run(() => cashoutMines(token!))}>Забрать {session.potentialPayout} монет</Button>
        :
        <>
        {session ?
          <Text as="div" align="center" weight="bold" color={session.status === "won" ? "green" : "red"}>{session.status === "won" ? `Вы выиграли ${session.potentialPayout} монет` : "Вы попали на мину"}</Text>
          :
          null
        }

          <label className="flex flex-col gap-2">
            <span className="flex items-center justify-between gap-3">
              <Text size="2" weight="bold">Ставка в монетах</Text>
              <Badge className="game-badge" color="orange">Монет: {session?.player.money ?? player?.money ?? 0}</Badge>
            </span>
            <input className="game-input w-full" type="number" min="1" max={String(player?.money ?? 0)} value={String(bet)} onChange={(event) => setBet(Number(event.target.value))} />
          </label>
          <label className="flex flex-col gap-2"><Text size="2" weight="bold">Мин на поле: {mineCount}</Text><input className="w-full accent-[#e8603c]" type="range" min={1} max={24} value={mineCount} onChange={(e) => setMineCount(Number(e.target.value))} /></label>
          <Button className="game-button game-button--glass w-full" color="orange" size="3" disabled={!token || loading || !validBet} onClick={() => run(() => startCasinoGame(token!, "mines", bet, { mineCount }))}>Начать игру</Button>
        </> }
      </section>
    </Card>
  </div>
  )

}
