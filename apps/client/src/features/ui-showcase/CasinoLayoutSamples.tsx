import type { PlayingCardDto } from "@mmobot/shared";
import { useState } from "react";
import { CasinoCellIcon } from "../casino/components/CasinoCellIcon";
import PlayingCard from "../casino/components/PlayingCard";
import type { SampleActions } from "./ComponentShowcase";
import Specimen from "./Specimen";
import "./casino-layouts.css";

const games = [["mines", "Мины"], ["blackjack", "21"], ["ladder", "Лестница"]] as const;
type Game = typeof games[number][0];
type Phase = "ready" | "active" | "won" | "lost";
type CellState = "closed" | "safe" | "bomb";

function CasinoGamePreview({ game, notify }: { game: Game; notify: SampleActions["notify"] }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [balance, setBalance] = useState(1250);
  const [bet, setBet] = useState(50);
  const [mineCount, setMineCount] = useState(3);
  const [bombCount, setBombCount] = useState(1);
  const [opened, setOpened] = useState<number[]>([]);
  const [path, setPath] = useState<number[]>([]);
  const [failedCell, setFailedCell] = useState<number | null>(null);
  const [hits, setHits] = useState(0);
  const [payout, setPayout] = useState(0);
  const active = phase === "active";
  const steps = game === "ladder" ? path.length : opened.length;
  const multiplier = Number((1 + steps * (game === "ladder" ? 0.35 : 0.25)).toFixed(2));
  const potential = Math.floor(bet * multiplier);
  const validBet = Number.isInteger(bet) && bet >= 1 && bet <= balance;
  const bombs = Array.from({ length: mineCount }, (_, index) => (index * 7 + 3) % 25);
  const playerTotal = hits === 0 ? 18 : hits === 1 ? 20 : 24;

  const finish = (won: boolean, amount = 0) => {
    setPhase(won ? "won" : "lost");
    setPayout(amount);
    if (won) setBalance(current => current + amount);
    notify(won ? `Макет: получено ${amount} монет` : "Макет: раунд завершён");
  };
  const resetRound = () => {
    setPhase("ready"); setOpened([]); setPath([]); setFailedCell(null); setHits(0); setPayout(0);
  };
  const start = () => {
    if (!validBet) return;
    resetRound();
    setBalance(current => current - bet);
    setPhase("active");
  };
  const revealMine = (cell: number) => {
    if (!active || opened.includes(cell)) return;
    if (bombs.includes(cell)) { setFailedCell(cell); finish(false); return; }
    const next = [...opened, cell];
    setOpened(next);
    if (next.length === 25 - mineCount) finish(true, Math.floor(bet * (1 + next.length * 0.25)));
  };
  const chooseStep = (row: number, cell: number) => {
    if (!active || row !== path.length) return;
    const safe = bombCount === 1 ? cell !== (row + 1) % 3 : cell === (row + 1) % 3;
    if (!safe) { setFailedCell(row * 3 + cell); finish(false); return; }
    const next = [...path, cell];
    setPath(next);
    if (next.length === 8) finish(true, Math.floor(bet * (1 + next.length * 0.35)));
  };
  const cellLabel = (state: CellState) => state === "bomb" ? "бомба" : state === "safe" ? "безопасно" : "закрыта";
  const playerCards: PlayingCardDto[] = [{ suit: "hearts", rank: "10" }, { suit: "clubs", rank: "8" }, ...(hits >= 1 ? [{ suit: "diamonds", rank: "2" } as const] : []), ...(hits >= 2 ? [{ suit: "spades", rank: "4" } as const] : [])];

  return <div className="ui-casino-game">
    <div className="ui-casino-balance"><span>Игровые монеты</span><strong>{balance.toLocaleString("ru-RU")}</strong></div>
    <div className="ui-casino-stats">
      <span>Ставка <strong>{bet || 0}</strong></span>
      {game !== "blackjack" && <span className="ui-casino-multiplier">×{multiplier}</span>}
      <span>{game === "blackjack" ? "Цель" : "Забрать"} <strong>{game === "blackjack" ? "21" : phase === "ready" ? 0 : phase === "won" ? payout : phase === "lost" ? 0 : potential}</strong></span>
    </div>

    {game === "mines" ? <div className="ui-casino-mines">
      {Array.from({ length: 25 }, (_, cell) => {
        const state: CellState = phase === "lost" && bombs.includes(cell) ? "bomb" : opened.includes(cell) ? "safe" : "closed";
        return <button key={cell} type="button" className="casino-cell aspect-square ui-casino-cell" data-state={state} data-exploded={failedCell === cell || undefined} aria-label={`Клетка ${cell + 1}: ${cellLabel(state)}`} disabled={!active || state !== "closed"} onClick={() => revealMine(cell)}><CasinoCellIcon state={state} /></button>;
      })}
    </div> : game === "ladder" ? <div className="ui-casino-ladder">
      {Array.from({ length: 8 }, (_, row) => <div key={row} className="ui-casino-ladder-row" data-current={active && row === path.length || undefined}>
        <span className="ui-casino-row-number">{row + 1}</span>
        {[0, 1, 2].map(cell => {
          const state: CellState = failedCell === row * 3 + cell ? "bomb" : path[row] === cell ? "safe" : "closed";
          return <button key={cell} type="button" className="casino-cell aspect-square ui-casino-cell" data-state={state} aria-label={`Уровень ${row + 1}, ступень ${cell + 1}: ${cellLabel(state)}`} disabled={!active || row !== path.length} onClick={() => chooseStep(row, cell)}>{state === "closed" ? "?" : <CasinoCellIcon state={state} />}</button>;
        })}
      </div>)}
    </div> : <div className="ui-casino-hands">
      <div className="casino-field ui-casino-hand"><div className="ui-casino-hand-label"><span>Дилер</span><strong>{phase === "ready" || active ? "?" : 17} очков</strong></div><div className="ui-casino-cards"><PlayingCard card={phase === "ready" ? null : { suit: "spades", rank: "9" }} /><PlayingCard card={phase === "ready" || active ? null : { suit: "hearts", rank: "8" }} /></div></div>
      <div className="casino-field ui-casino-hand"><div className="ui-casino-hand-label"><span>Вы</span><strong>{phase === "ready" ? "—" : playerTotal} очков</strong></div><div className="ui-casino-cards">{phase === "ready" ? <><PlayingCard card={null} /><PlayingCard card={null} /></> : playerCards.map((card, index) => <PlayingCard key={index} card={card} />)}</div></div>
    </div>}

    <div className="ui-casino-controls">
      {phase === "ready" ? <>
        <label className="ui-casino-bet-label">Ставка в монетах<input className="game-input w-full ui-casino-input" type="number" min={1} max={balance} value={bet || ""} onChange={event => setBet(Number(event.target.value))} /></label>
        <div className="ui-casino-quick-bets"><button className="casino-choice" type="button" onClick={() => setBet(Math.max(1, Math.floor(bet / 2)))}>½</button><button className="casino-choice" type="button" onClick={() => setBet(Math.min(balance, Math.max(1, bet * 2)))}>×2</button><button className="casino-choice" type="button" onClick={() => setBet(Math.min(balance, 50))}>50</button><button className="casino-choice" type="button" onClick={() => setBet(Math.min(balance, 100))}>100</button></div>
        {game === "mines" && <label className="ui-casino-setting">Мин на поле: {mineCount}<input type="range" min={1} max={24} value={mineCount} onChange={event => setMineCount(Number(event.target.value))} /></label>}
        {game === "ladder" && <div className="ui-casino-setting">Бомб на уровне<div className="ui-casino-risk" role="group" aria-label="Бомб на уровне">{[1, 2].map(count => <button className="casino-choice" key={count} type="button" aria-pressed={bombCount === count} onClick={() => setBombCount(count)}>{count}</button>)}</div></div>}
        <button type="button" className="game-button w-full game-button--glass ui-casino-button" disabled={!validBet} onClick={start}>{game === "blackjack" ? "Раздать карты" : game === "ladder" ? "Начать подъём" : "Начать игру"}</button>
      </> : active ? <>
        <p className="ui-casino-help">{game === "mines" ? "Откройте безопасную клетку или заберите монеты." : game === "ladder" ? `Выберите ступень на уровне ${path.length + 1}.` : "Возьмите карту или завершите ход."}</p>
        {game === "blackjack" ? <div className="ui-casino-actions"><button type="button" className="game-button w-full game-button--glass ui-casino-button" onClick={() => { setHits(hits + 1); if (hits >= 1) finish(false); }}>Ещё</button><button type="button" className="game-button w-full game-button--outline ui-casino-button ui-casino-button--secondary" onClick={() => finish(true, bet * 2)}>Хватит</button></div> : <button type="button" className="game-button w-full game-button--glass ui-casino-button" disabled={steps === 0} onClick={() => finish(true, potential)}>Забрать {potential} монет</button>}
      </> : <>
        <p className="ui-casino-result" data-result={phase} role="status">{phase === "won" ? `Получено ${payout} монет` : game === "mines" ? "Вы попали на мину" : game === "ladder" ? "Неверная ступень" : "Перебор · 24 очка"}</p>
        <button type="button" className="game-button w-full game-button--glass ui-casino-button" onClick={resetRound}>Новая игра</button>
      </>}
    </div>
  </div>;
}

function CasinoPreview({ notify }: Pick<SampleActions, "notify">) {
  const [game, setGame] = useState<Game>("mines");
  return <div className="ui-casino-backdrop">
    <div className="game-card game-card--glass ui-casino-layout">
      <div className="ui-casino-game-switch" role="group" aria-label="Игра казино">{games.map(([id, title]) => <button className="casino-choice" key={id} type="button" aria-pressed={game === id} onClick={() => setGame(id)}>{title}</button>)}</div>
      <CasinoGamePreview key={game} game={game} notify={notify} />
    </div>
  </div>;
}

export default function CasinoLayoutSamples({ notify }: Pick<SampleActions, "notify">) {
  return <Specimen preserveStyle title="Казино · Жидкое стекло" usage="Мины, 21 и Лестница · Демо на игровых монетах" wide>
    <CasinoPreview notify={notify} />
  </Specimen>;
}
