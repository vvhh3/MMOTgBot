import {
    calculateMobStats,getItemMinLevel,ITEM_BALANCE,MOB_EQUIPMENT_DROP_BUDGET,RARITY_LABELS,recommendedMobStats,
    type ItemDto,type ItemRarity,type MobCombatProfile,type MobDto,
} from '@mmobot/shared';
import { Callout,Flex,Heading,Select,Table,Text } from '@radix-ui/themes';

type Props = {
    mob: MobDto;
    profile: MobCombatProfile;
    catalog: ItemDto[];
    playerLevel: number;
    onLevel: (level: number) => void;
    encounterPercent: number;
};

export default function MobBalancePreview({ mob,profile,catalog,playerLevel,onLevel,encounterPercent }: Props) {
    const stats = calculateMobStats(mob, playerLevel, profile);
    const recommended = recommendedMobStats(profile.rank, Math.max(1, mob.level));
    const warnings: string[] = [];
    if (profile.rank === 'boss' && encounterPercent > 2) warnings.push(`Этот босс займёт ${encounterPercent.toFixed(2)}% встреч. Для редкого босса начните с веса 1 и проверьте общий шанс.`);
    if (profile.attack.accuracy < 50) warnings.push('Обычная атака будет промахиваться чаще, чем попадать. Проверьте, соответствует ли этому награда.');
    for (const [key,label] of [['maxHealth', 'HP'], ['strength', 'Сила'], ['defense', 'Защита']] as const) {
        if (mob[key] > recommended[key] * 1.5 || mob[key] < recommended[key] * .65) {
            warnings.push(`${label}: ${mob[key]}, ориентир этого класса на базовом уровне — ${recommended[key]}.`);
        }
    }
    if (mob.pointsReward > recommended.pointsReward * 2 || mob.coinReward > recommended.coinReward * 2) {
        warnings.push(`Повышенные награды. Ориентир: ${recommended.pointsReward} XP/очков и ${recommended.coinReward} монет на базовом уровне.`);
    }
    if (profile.strongAttack && (profile.strongAttack.power > 2 || profile.strongAttack.cooldownRounds === 0)) {
        warnings.push('Сильная атака заметно опаснее стандартной: проверьте мощность и перезарядку.');
    }
    for (const [rarity,budget] of Object.entries(MOB_EQUIPMENT_DROP_BUDGET[profile.rank]) as [ItemRarity,number][]) {
        const sum = mob.loot.reduce((total,entry) => {
            const item = catalog.find(item => item.id === entry.itemType);
            return total + (item && ['weapon', 'armor'].includes(item.type) && item.rarity === rarity ? entry.chancePercent : 0);
        }, 0);
        if (sum > budget + .001) warnings.push(`${RARITY_LABELS[rarity]} экипировка: сумма шансов ${Number(sum.toFixed(3))}%, ориентир класса — ${budget}%.`);
    }
    const availableLoot = mob.loot.filter(entry => {
        const item = catalog.find(item => item.id === entry.itemType);
        return item && getItemMinLevel(item) <= stats.level;
    });
    const saleValue = availableLoot.reduce((sum,entry) => sum + entry.chancePercent / 100 * (catalog.find(item => item.id === entry.itemType)?.sellPrice ?? 0), 0);
    const tier = Object.values(ITEM_BALANCE).filter(tier => tier.minLevel <= playerLevel).at(-1) ?? ITEM_BALANCE.common;
    const points = playerLevel - 1;
    const attackPoints = Math.floor(points / 2);
    const defensePoints = Math.floor((points - attackPoints) / 2);
    const playerDefense = 5 + defensePoints + tier.defense;
    const playerStrength = 10 + attackPoints * 2 + tier.damage;
    const damage = (strength: number, defense: number, power = 1) => `${Math.max(1, Math.floor(strength * power - defense))}–${Math.max(1, Math.floor(strength * 2 * power - defense))}`;

    return (
        <Flex direction="column" gap="3">
            <Heading size="3">Предпросмотр баланса</Heading>
            <Flex gap="3" align="center" wrap="wrap">
                <Text as="label" size="2">Уровень персонажа</Text>
                <Select.Root value={String(playerLevel)} onValueChange={(value) => onLevel(Number(value))}>
                    <Select.Trigger aria-label="Уровень персонажа для предпросмотра" />
                    <Select.Content>{Array.from({ length: 8 }, (_,i) => <Select.Item key={i} value={String(i + 1)}>{i + 1}</Select.Item>)}</Select.Content>
                </Select.Root>
                <Text size="2">Шанс встречи: {Number(encounterPercent.toFixed(3))}%</Text>
            </Flex>
            <Text size="1" color="gray">Шанс учитывает веса остальных мобов Площади. Вес 0 исключает встречу. Ориентиры и предпросмотр обновляются до сохранения.</Text>
            {warnings.length > 0 && (
                <Callout.Root color="orange">
                    <div className="text-sm">
                        <strong>Проверьте отклонения от рекомендуемого баланса:</strong>
                        <ul className="mt-2 list-disc space-y-1 pl-4">{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
                    </div>
                </Callout.Root>
            )}
            <div className="overflow-x-auto">
                <Table.Root variant="surface">
                    <Table.Header><Table.Row>
                        <Table.ColumnHeaderCell>Игрок</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Моб</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>HP</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Сила</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Защита</Table.ColumnHeaderCell><Table.ColumnHeaderCell>XP/очки</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Монеты</Table.ColumnHeaderCell>
                    </Table.Row></Table.Header>
                    <Table.Body>{Array.from({ length: 8 }, (_,i) => {
                        const row = calculateMobStats(mob, i + 1, profile);
                        return <Table.Row key={i} className={playerLevel === i + 1 ? 'bg-orange-50' : undefined}>
                            <Table.Cell>{i + 1}</Table.Cell><Table.Cell>{row.level}</Table.Cell><Table.Cell>{row.maxHealth}</Table.Cell>
                            <Table.Cell>{row.strength}</Table.Cell><Table.Cell>{row.defense}</Table.Cell>
                            <Table.Cell>{row.pointsReward}</Table.Cell><Table.Cell>{row.coinReward}</Table.Cell>
                        </Table.Row>;
                    })}</Table.Body>
                </Table.Root>
            </div>
            <Text size="2">Против экипированного персонажа {playerLevel} уровня: обычный удар моба — {damage(stats.strength, playerDefense)} HP при попадании
                {profile.strongAttack ? `, сильный — ${damage(stats.strength, playerDefense, profile.strongAttack.power)} HP` : ''}.
                {' '}Ответная обычная атака персонажа — {damage(playerStrength, stats.defense)} HP.</Text>
            <Text size="1" color="gray">Пример использует распределение очков между силой, защитой и HP и экипировку доступной редкости. Активный блок и промахи в диапазоны урона не включены.</Text>
            <Text size="2">На {stats.level} уровне моба доступны {availableLoot.filter(entry => entry.chancePercent > 0).length} строк добычи.
                {' '}Ожидаемые монеты за победу с продажей добычи NPC: {(stats.coinReward + saleValue).toFixed(2)}.</Text>
            <Text size="1" color="gray">Расчёт использует цену быстрой продажи и независимые шансы предметов. Затраты на лечение и вероятность поражения в доход не включены.</Text>
        </Flex>
    );
}
