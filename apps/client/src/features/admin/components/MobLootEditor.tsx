import { getItemMinLevel,RARITY_LABELS,recommendedMobLootChance,type ItemDto,type MobLootEntry,type MobRank } from '@mmobot/shared';
import { Button,Flex,Heading,Text,TextField } from '@radix-ui/themes';
import { useState } from 'react';
import { MobNumberField } from './MobCombatEditor';

type Props = {
    loot: MobLootEntry[];
    catalog: ItemDto[];
    rank: MobRank;
    level: number;
    onChange: (loot: MobLootEntry[]) => void;
};

export default function MobLootEditor({ loot,catalog,rank,level,onChange }: Props) {
    const [search,setSearch] = useState('');
    const filtered = catalog.filter(item => item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
    const recommend = () => onChange(loot.map(entry => {
        const item = catalog.find(item => item.id === entry.itemType);
        if (!item) return entry;
        const count = loot.filter(row => {
            const other = catalog.find(item => item.id === row.itemType);
            return other && ['weapon', 'armor'].includes(other.type) && other.rarity === item.rarity;
        }).length;
        return { ...entry, chancePercent: Number(recommendedMobLootChance(rank, item, count).toFixed(4)) };
    }));
    const add = () => {
        const item = filtered.find(item => !loot.some(entry => entry.itemType === item.id)) ?? filtered[0];
        if (item) onChange([...loot, { itemType: item.id, chancePercent: recommendedMobLootChance(rank, item) }]);
    };

    return (
        <Flex direction="column" gap="3">
            <Heading size="3">Добыча</Heading>
            <Text size="1" color="gray">Каждая строка независимо разыгрывает одну штуку. Повторная строка даёт шанс на ещё одну копию. Сумма шансов может превышать 100%.</Text>
            <TextField.Root placeholder="Поиск предметов" aria-label="Поиск предметов для добычи" value={search}
                onChange={(event) => setSearch(event.target.value)} />
            {loot.length === 0 && <Text size="2" color="gray">Предметы не выпадают.</Text>}
            {loot.map((entry,index) => {
                const selected = catalog.find(item => item.id === entry.itemType);
                const options = selected && !filtered.some(item => item.id === selected.id) ? [selected, ...filtered] : filtered;
                return (
                    <div key={index} className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
                        <label className="min-w-48 flex-1">
                            <Text as="div" size="1" mb="1" color="gray">Предмет</Text>
                            <select className="w-full min-w-0 rounded border p-2" value={entry.itemType}
                                onChange={(event) => onChange(loot.map((row,i) => i === index ? { ...row, itemType: Number(event.target.value) } : row))}>
                                {options.map(item => <option key={item.id} value={item.id}>{item.name} · {RARITY_LABELS[item.rarity]} · ур. {getItemMinLevel(item)}</option>)}
                                {!selected && <option value={entry.itemType}>Предмет #{entry.itemType} недоступен</option>}
                            </select>
                            {selected && getItemMinLevel(selected) > level && (
                                <Text as="div" size="1" color="orange">Начнёт выпадать с {getItemMinLevel(selected)} уровня моба.</Text>
                            )}
                        </label>
                        <div className="w-28">
                            <MobNumberField label="Шанс, %" min={0} max={100} step="any" value={entry.chancePercent}
                                onChange={(chancePercent) => onChange(loot.map((row,i) => i === index ? { ...row, chancePercent } : row))} />
                        </div>
                        <Button className="game-button game-button--danger" type="button" color="red" variant="soft" onClick={() => onChange(loot.filter((_,i) => i !== index))}>Удалить</Button>
                    </div>
                );
            })}
            <Flex gap="2" wrap="wrap">
                <Button className="game-button" type="button" variant="soft" disabled={filtered.length === 0} onClick={add}>Добавить предмет</Button>
                <Button className="game-button" type="button" variant="outline" disabled={loot.length === 0} onClick={recommend}>Подобрать шансы по классу</Button>
            </Flex>
        </Flex>
    );
}
