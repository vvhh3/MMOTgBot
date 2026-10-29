import { CasinoCellIcon } from "./CasinoCellIcon";
import type { CasinoSessionResponse,PlayerDto } from "@mmobot/shared";
import { Badge,Button,Card,Text } from "@radix-ui/themes";
import { useEffect,useState } from "react";
import { getLocationImage } from "../../locations/lib/getLocationImage";
import { cashoutLadder,chooseLadderCell,getCasinoSession,startCasinoGame } from "../api";

type Props = { token: string | null; player: PlayerDto | null; onPlayer: (player: PlayerDto) => void };
export default function LadderGame({ token, player, onPlayer }: Props) {
  const [session, setSession] = useState<CasinoSessionResponse | null>(null); const [bet, setBet] = useState(10); const [bombCount, setBombCount] = useState<1 | 2>(1); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => { if (token) getCasinoSession(token).then((s) => { if (s.game === "ladder") setSession(s); }).catch(() => undefined); }, [token]);
  const run = async (work: () => Promise<CasinoSessionResponse>) => { setLoading(true); setError(""); try { const next = await work(); setSession(next); onPlayer(next.player); } catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); } finally { setLoading(false); } };
  const ladder = session?.ladder;
  const revealedBombs = session?.status !== "active" ? ladder?.bombCells : undefined;
  const validBet = Number.isInteger(bet) && bet > 0 && bet <= (player?.money ?? 0);
  return <div className="flex h-full min-h-0 w-full items-start justify-center overflow-x-hidden overflow-y-auto bg-cover bg-center px-2 py-2 sm:items-center sm:px-3" style={{ backgroundImage: `url(${getLocationImage("market-fight.svg")})` }}>
    <Card className="game-card game-card--glass my-auto w-full max-w-xl shrink-0 overflow-hidden p-0!">
      <section className="flex flex-col gap-3 p-2 sm:p-3">
        <div className="flex items-center justify-between gap-2"><Text size="4" weight="bold">Лестница</Text><Badge className="game-badge" color="orange">Монеты: {session?.player.money ?? player?.money ?? 0}</Badge></div>
        <Text className="text-[#756b5c]" size="1">На каждом уровне одна из трёх ступеней безопасна.</Text>
        {session && <div className="flex items-center justify-between gap-1.5 text-xs min-[380px]:gap-2 min-[380px]:text-sm sm:text-base"><Text className="whitespace-nowrap text-[#756b5c]" weight="medium">Уровень: {ladder?.level}/{ladder?.maxLevels}</Text><Badge className="game-badge" color="orange">×{session.multiplier}</Badge><Text className="whitespace-nowrap" weight="bold">Забрать: {session.potentialPayout}</Text></div>}
        {session && <div className="flex flex-col-reverse gap-1.5 sm:gap-2">{Array.from({ length: ladder?.maxLevels ?? 8 }, (_, level) => <div key={level} className={`grid grid-cols-[1.5rem_repeat(3,minmax(0,1fr))] items-center gap-1.5 sm:grid-cols-[2rem_repeat(3,minmax(0,1fr))] sm:gap-2 ${session.status !== "active" || level === ladder?.level ? "opacity-100" : level < (ladder?.level ?? 0) ? "opacity-75" : "opacity-40"}`}><Text className="text-[#756b5c]" size="1">{level + 1}</Text>{[0, 1, 2].map((cell) => {
        const failed = session.status === "lost" && level === (ladder?.level ?? 0) - 1 && ladder?.failedCell === cell;
        const levelBombs = revealedBombs?.[level];
        const isBomb = failed || (levelBombs?.includes(cell) ?? false);
        const safe = !isBomb && (levelBombs !== undefined || ladder?.revealedSafeCells[level] === cell);
        return <button key={cell} aria-label={`Уровень ${level + 1}, ступень ${cell + 1}: ${isBomb ? "бомба" : safe ? "безопасно" : "закрыта"}`} disabled={loading || session.status !== "active" || level !== ladder?.level} onClick={() => run(() => chooseLadderCell(token!, cell))} className="casino-cell h-9 sm:h-10" data-state={isBomb ? "bomb" : safe ? "safe" : "closed"} data-exploded={failed || undefined}><CasinoCellIcon state={isBomb ? "bomb" : safe ? "safe" : "closed"} /></button>;
      })}</div>)}</div>}
      </section>

      <section className="flex flex-col gap-3 border-t border-white/80 p-3">
        {error && <Text role="alert" align="center" color="red" weight="bold">{error}</Text>}
        {!session ? <>
          <label className="flex flex-col gap-2"><span className="flex items-center justify-between gap-3"><Text size="2" weight="bold">Ставка в монетах</Text><Text className="text-[#756b5c]" size="2">Доступно: {player?.money ?? 0}</Text></span><input className="game-input w-full" type="number" min="1" max={String(player?.money ?? 0)} value={String(bet)} onChange={(event) => setBet(Number(event.target.value))} /></label>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-bold">Бомб на уровне</legend>
            <div className="grid grid-cols-2 gap-2">
              {([1, 2] as const).map((count) => <button className="casino-choice" key={count} type="button" aria-pressed={bombCount === count} onClick={() => setBombCount(count)}>{count}</button>)}
            </div>
          </fieldset>
          <Text className="text-[#756b5c]" size="1">После каждого удачного шага можно забрать монеты. Чем больше бомб, тем выше множитель.</Text>
          <Button className="game-button game-button--glass w-full" color="orange" size="3" disabled={!token || loading || !validBet} onClick={() => run(() => startCasinoGame(token!, "ladder", bet, { ladderBombCount: bombCount }))}>Начать подъём</Button>
        </> : session.status === "active" ? <Button className="game-button game-button--glass w-full" color="orange" size="3" disabled={loading || (ladder?.level ?? 0) === 0} onClick={() => run(() => cashoutLadder(token!))}>Забрать {session.potentialPayout} монет</Button> : <><Text as="div" align="center" weight="bold" color={session.status === "won" ? "green" : "red"}>{session.status === "won" ? `Вы выиграли ${session.potentialPayout} монет` : "Неверная ступень"}</Text><Button className="game-button game-button--glass w-full" color="orange" size="3" onClick={() => setSession(null)}>Новая игра</Button></>}
      </section>
    </Card>
  </div>;
}
