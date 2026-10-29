import type { GroupEventActionRequest, InventoryItemDto, PlayerDto } from '@mmobot/shared';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe } from '../../character/api';
import { getSkins } from '../../character/lib/skins';
import BattleScreen from '../../combat/components/BattleScreen';
import BattleConsole from '../../combat/components/BattleConsole';
import MovePanel from '../../combat/components/MovePanel';
import CombatInventoryDialog from '../../combat/components/CombatInventoryDialog';
import { useBattlePlayback } from '../../combat/hooks/useBattlePlayback';
import { getLocationImage } from '../../locations/lib/getLocationImage';
import { useGroupEvent } from '../GroupEventProvider';
import { remainingEventSeconds } from '../lib/state';

export default function GroupEventFight({ token, player, inventory, onPlayer, onInventory }: {
  token: string | null; player: PlayerDto | null; inventory: InventoryItemDto[];
  onPlayer: (p: PlayerDto) => void; onInventory: (i: InventoryItemDto[]) => void;
}) {
  const { overview, command, refresh, runSolo } = useGroupEvent();
  const state = overview?.run;
  const [targetId, setTargetId] = useState<string | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
  const [movesOpen, setMovesOpen] = useState(false), [inventoryOpen, setInventoryOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0), receipt = useRef(Date.now());
  const locked = useRef(false), navigate = useNavigate();
  useEffect(() => { receipt.current = Date.now(); setElapsed(0); }, [state?.serverTime]);
  useEffect(() => { const timer = setInterval(() => setElapsed(Date.now() - receipt.current), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { setMovesOpen(false); setInventoryOpen(false); }, [state?.round]);
  const health: number[] = [], statuses: NonNullable<typeof state>['fighters'][number]['statuses'][] = [];
  for (const f of state?.fighters ?? []) { health[f.index] = f.hp; statuses[f.index] = f.statuses; }
  const playback = useBattlePlayback(`group-${state?.id}-wave-${state?.wave}`, health, state?.events ?? [], statuses);
  const enemies = state?.fighters.filter(f => f.team === 1) ?? [];
  const target = enemies.find(f => f.id === targetId && f.hp > 0) ?? enemies.find(f => f.hp > 0);
  const me = state?.fighters.find(f => f.id === state.myFighterId);
  const disabled = pending || playback.busy || state?.status !== 'active' || state.actionSubmitted || !me || me.hp <= 0 || me.left;
  const handleAction = async (choice: Pick<GroupEventActionRequest, 'moveId' | 'itemType'>) => {
    if (!state || disabled || locked.current) return false;
    locked.current = true; setPending(true); setError(null);
    try {
      await command(`/group-event-runs/${state.id}/actions`, { ...choice, targetId: target?.id, wave: state.wave, round: state.round, expectedVersion: state.stateVersion });
      setMovesOpen(false); return true;
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сделать ход'); void refresh(); return false; }
    finally { locked.current = false; setPending(false); }
  };
  useEffect(() => {
    if (token && state && state.status !== 'active') void getMe(token).then(d => { onPlayer(d.player); onInventory(d.inventory); });
  }, [token, state?.id, state?.status, onPlayer, onInventory]);
  if (!state || !me) return <div className="p-5"><p>Восстанавливаем особую прогулку…</p><button className="game-button mt-3" onClick={() => navigate('/')}>На Площадь</button></div>;
  const displayFighter = (f: typeof me, enemy: boolean) => ({
    id: f.id, name: f.name, hp: f.left ? 0 : playback.hp[f.index] ?? f.hp, maxHp: f.maxHp,
    image: getSkins(f.avatar ?? (enemy ? '/character-images/monstr.svg' : player?.avatar)),
    statuses: playback.statuses[f.index] ?? f.statuses,
    selected: enemy && target?.id === f.id,
    onSelect: enemy && !disabled ? () => setTargetId(f.id) : undefined,
  });
  const allies = state.fighters.filter(f => f.team === 0).map(f => displayFighter(f, false));
  const foes = enemies.map(f => displayFighter(f, true));
  const status = `Волна ${state.wave}/${state.totalWaves}${state.wave === state.totalWaves ? ' · Босс' : ''} · ${me.hp <= 0 ? 'Вы выбыли. Наблюдайте за командой.' : state.actionSubmitted ? 'Ход принят. Ждём команду.' : `Цель: ${target?.name ?? '—'}`}`;
  const controls = playback.message ? <BattleConsole message={playback.message} remainingMessages={playback.remainingMessages} onNext={playback.next} onSkip={playback.skip} />
    : movesOpen ? <MovePanel state={state} disabled={disabled} onMove={moveId => void handleAction({ moveId })} onBack={() => setMovesOpen(false)} /> : undefined;
  return <>
    <BattleScreen battleId={`group-${state.id}`} background={getLocationImage('square-fight.svg')} player={allies[0]} opponent={foes[0]}
      teams={{ allies, enemies: foes }} error={error} status={status} round={state.round}
      remainingSeconds={state.status === 'active' ? remainingEventSeconds(state.deadline, state.serverTime, elapsed) : undefined}
      controls={controls} actions={state.status === 'active' ? {
        attack: { label: 'Выбрать приём', disabled, onClick: () => setMovesOpen(true) },
        inventory: { label: 'Инвентарь', disabled, onClick: () => setInventoryOpen(true) },
        leave: { label: 'Покинуть группу', disabled: pending, onClick: () => void runSolo('покинуть зачистку', async () => navigate('/')) },
        extra: { label: `${state.fighters.filter(f => f.team === 0 && f.hp > 0 && !f.left && f.submitted).length}/${state.fighters.filter(f => f.team === 0 && f.hp > 0 && !f.left).length} ходов`, disabled: true, onClick: () => undefined },
      } : null}>
      {state.status !== 'active' && !playback.busy && <div className="group-event-result">
        <strong>{state.status === 'victory' ? 'Победа над боссом!' : state.status === 'defeat' ? 'Поражение группы' : 'Прохождение завершено'}</strong>
        {state.reward && <><p>+{state.reward.xp} опыта · +{state.reward.coins} монет · +{state.reward.points} очков</p>
          {state.reward.items.map((item, i) => <p key={i}>{item.name} ×{item.quantity}</p>)}</>}
        <button className="game-button mt-3" onClick={() => navigate('/')}>На Площадь</button>
      </div>}
    </BattleScreen>
    {inventoryOpen && <CombatInventoryDialog title="Инвентарь в командном бою" token={token} player={player} inventory={inventory}
      onPlayer={onPlayer} onInventory={onInventory} onClose={() => setInventoryOpen(false)} closeDisabled={pending}
      combat={{ onUsePotion: itemType => handleAction({ itemType }), busy: !!disabled, healthFull: me.hp >= me.maxHp,
        healingAvailable: state.healingAvailable, hasNegativeEffects: me.statuses.some(s => !s.positive) }} />}
  </>;
}
