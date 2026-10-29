import { DEFAULT_GROUP_EVENT_CONFIG, type GroupEventConfig, type GroupEventWindowDto, type ItemDto, type MobDto } from '@mmobot/shared';
import { useEffect, useState } from 'react';
import { api, authHeader } from '../../../shared/api/http';
import { getEventWindows } from '../../group-events/api';
import { getItems } from '../../items/api';
import { getMobs } from '../../mobs/api';
import MobLootEditor from './MobLootEditor';

const localTimeInput = (iso: string) => {
  const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export default function GroupEventAdmin({ token }: { token: string | null }) {
  const [windows, setWindows] = useState<GroupEventWindowDto[]>([]), [id, setId] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(false), [minLevel, setMinLevel] = useState(1);
  const [start, setStart] = useState(() => localTimeInput(new Date().toISOString()));
  const [end, setEnd] = useState(() => localTimeInput(new Date(Date.now() + 3600000).toISOString()));
  const [config, setConfig] = useState<GroupEventConfig>(() => structuredClone(DEFAULT_GROUP_EVENT_CONFIG));
  const [catalog, setCatalog] = useState<ItemDto[]>([]), [mobCatalog, setMobCatalog] = useState<MobDto[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!token) return;
    void Promise.all([getEventWindows(token), getItems(token), getMobs(token)]).then(([rows, items, mobs]) => {
      setWindows(rows); setCatalog(items.items); setMobCatalog(mobs.mobs);
    }).catch(e => setError(e.message));
  }, [token]);
  const select = (row: GroupEventWindowDto) => {
    setId(row.id); setEnabled(row.enabled); setMinLevel(row.minLevel); setStart(localTimeInput(row.startsAt)); setEnd(localTimeInput(row.endsAt)); setConfig(structuredClone(row.config)); setSaved(false);
  };
  const save = async () => {
    if (!token || busy) return; setBusy(true); setError(null); setSaved(false);
    try {
      const response = await api.request<{ windows: GroupEventWindowDto[] }>({ method: id === null ? 'POST' : 'PATCH', url: id === null ? '/admin/group-events' : `/admin/group-events/${id}`,
        headers: authHeader(token), data: { enabled, minLevel, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), config } });
      setWindows(response.data.windows); if (id === null) setId(response.data.windows.at(-1)?.id ?? null); setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить событие'); }
    finally { setBusy(false); }
  };
  const updateWave = (index: number, patch: Partial<GroupEventConfig['waves'][number]>) => setConfig(c => ({ ...c, waves: c.waves.map((w, i) => i === index ? { ...w, ...patch } : w) }));
  return <div className="group-event-admin">
    <p className="font-bold">Особая прогулка с компанией</p>
    <p className="text-sm">Площадь · группа из трёх игроков. Время указано в часовом поясе вашего устройства.</p>
    <div className="flex flex-wrap gap-2">{windows.map(w => <button className="game-button" key={w.id} onClick={() => select(w)}>#{w.id} · {new Date(w.startsAt).toLocaleString('ru-RU')} · {w.enabled ? 'Включено' : 'Выключено'}</button>)}</div>
    <button className="game-button" onClick={() => { setId(null); setEnabled(false); setSaved(false); }}>Новое окно события</button>
    <label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Разрешить набор в указанное время</label>
    <div className="group-admin-fields">
      <label>Начало<input required type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label>
      <label>Конец<input required type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></label>
      <label>Минимальный уровень<input type="number" min={1} max={8} value={minLevel} onChange={e => setMinLevel(Number(e.target.value))} /></label>
      <label>Секунд на раунд<input type="number" min={15} max={300} value={config.roundSeconds} onChange={e => setConfig({ ...config, roundSeconds: Number(e.target.value) })} /></label>
      <label>Минут на прохождение<input type="number" min={5} max={120} value={config.durationMinutes} onChange={e => setConfig({ ...config, durationMinutes: Number(e.target.value) })} /></label>
    </div>
    {config.waves.map((wave, index) => <div className="group-admin-wave" key={index}>
      <strong>Волна {index + 1}{index === config.waves.length - 1 ? ' · Босс' : ''}</strong>
      {wave.mobKeys.map((key, position) => <label key={position}>Противник {position + 1}<select value={key} onChange={e => updateWave(index, { mobKeys: wave.mobKeys.map((v, i) => i === position ? e.target.value : v) })}>
        {mobCatalog.filter(m => m.catalogKey?.startsWith('square_') && (index !== config.waves.length - 1 || m.combatProfile?.rank === 'boss' || m.rank === 'boss')).map(m => <option key={m.id} value={m.catalogKey!}>{m.name}</option>)}
      </select></label>)}
      <div className="group-admin-fields"><label>Множитель HP<input type="number" step="0.1" min="0.25" max="20" value={wave.hpMultiplier} onChange={e => updateWave(index, { hpMultiplier: Number(e.target.value) })} /></label>
        <label>Множитель атаки<input type="number" step="0.1" min="0.25" max="20" value={wave.damageMultiplier} onChange={e => updateWave(index, { damageMultiplier: Number(e.target.value) })} /></label></div>
      {index < config.waves.length - 1 && config.waves.length > 2 && <button className="game-button game-button--danger" onClick={() => setConfig({ ...config, waves: config.waves.filter((_, i) => i !== index) })}>Убрать волну</button>}
    </div>)}
    <button className="game-button" disabled={config.waves.length >= 10} onClick={() => setConfig({ ...config, waves: [...config.waves.slice(0,-1), structuredClone(DEFAULT_GROUP_EVENT_CONFIG.waves[0]), config.waves.at(-1)!] })}>Добавить волну перед боссом</button>
    <p className="font-bold">Награда каждому участнику за победу</p>
    <div className="group-admin-fields">{(['xp','coins','points'] as const).map(key => <label key={key}>{key === 'xp' ? 'Опыт' : key === 'coins' ? 'Монеты' : 'Очки'}<input type="number" min={0} max={100000} value={config.reward[key]} onChange={e => setConfig({ ...config, reward: { ...config.reward, [key]: Number(e.target.value) } })} /></label>)}</div>
    <p className="text-xs">Пустой список добычи использует таблицу добычи выбранного босса.</p>
    <MobLootEditor loot={config.reward.loot} catalog={catalog} rank="boss" level={8} onChange={loot => setConfig({ ...config, reward: { ...config.reward, loot } })} />
    {error && <p role="alert" className="text-red-600">{error}</p>}{saved && <p role="status">Событие сохранено.</p>}
    <button className="game-button" disabled={busy} onClick={() => void save()}>{busy ? 'Сохраняем…' : 'Сохранить событие'}</button>
  </div>;
}
