import { getItemMinLevel, getPassiveDefinition, ITEM_BALANCE, type ItemDto } from '@mmobot/shared';
import { Button, Callout, Flex, Heading, Text } from '@radix-ui/themes';
import ItemDetails from '../../items/components/ItemDetails';

type ItemBalancePreviewProps = {
    item: ItemDto;
    onPreset: () => void;
};

export default function ItemBalancePreview({ item, onPreset }: ItemBalancePreviewProps) {
    const tier = ITEM_BALANCE[item.rarity];
    const warnings: string[] = [];
    if (item.type === 'weapon' && item.damage > tier.damage) warnings.push(`Бонус атаки выше ориентира редкости (+${tier.damage}).`);
    if (item.type === 'armor' && item.defense > tier.defense) warnings.push(`Защита выше ориентира редкости (+${tier.defense}).`);
    if (item.sellPrice > item.price) warnings.push('Выкуп не может превышать цену покупки.');
    if (item.passiveId && getPassiveDefinition(item.passiveId).available !== false) {
        const definition = getPassiveDefinition(item.passiveId);
        for (const [key, rule] of Object.entries(definition.parameters)) {
            const value = item.passiveParams[key] ?? rule.default;
            if (!Number.isSafeInteger(value) || value < rule.min || value > rule.max) warnings.push(`${rule.label}: требуется целое число ${rule.min}–${rule.max}.`);
            else if (value > rule.default * 1.5) warnings.push(`${rule.label}: заметно выше базовой настройки (${rule.default}). Проверьте баланс.`);
        }
    }

    return (
        <Flex direction="column" gap="3" className="rounded-lg border p-3">
            <Heading size="3">Предпросмотр предмета</Heading>
            <Text size="1" color="gray">Требуется уровень {getItemMinLevel(item)}. Сильная атака и защитный приём зависят от редкости. Смена редкости сама не перезаписывает введённые характеристики.</Text>
            {['weapon', 'armor', 'potion'].includes(item.type) && <Button type="button" variant="soft" onClick={onPreset}>Базовые характеристики и цены по редкости</Button>}
            {warnings.length > 0 && <Callout.Root color="orange"><div className="text-sm"><strong>Проверьте настройки:</strong><ul className="mt-1 list-disc space-y-1 pl-4">{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div></Callout.Root>}
            <ItemDetails item={{ ...item, minLevel: getItemMinLevel(item) }} />
        </Flex>
    );
}
