import { getDefaultPassiveParams, getPassiveDefinition, getPassiveIdsForType, resolvePassiveParams, type ItemDto, type ItemPassiveId } from '@mmobot/shared';
import { Button, Callout, Flex, Heading, Select, Text, TextField } from '@radix-ui/themes';

type ItemPassiveEditorProps = {
    item: ItemDto;
    onChange: (patch: Pick<ItemDto, 'passiveId' | 'passiveParams'>) => void;
};

export default function ItemPassiveEditor({ item, onChange }: ItemPassiveEditorProps) {
    const ids = getPassiveIdsForType(item.type);
    if (!ids.length) return null;
    const definition = item.passiveId ? getPassiveDefinition(item.passiveId) : null;
    const parameters = item.passiveId ? { ...resolvePassiveParams(item.passiveId, item.passiveParams), ...item.passiveParams } : {};

    return (
        <Flex direction="column" gap="3" className="rounded-lg border border-orange-200 p-3">
            <Heading size="3">Пассивная способность</Heading>
            <Text size="1" color="gray">Одна способность на предмет. Выберите механику и настройте её параметры. Для расходника способность действует при использовании в бою.</Text>
            <Text as="label" size="2">
                Механика
                <Select.Root value={item.passiveId ?? 'none'} onValueChange={(value) => {
                    const passiveId = value === 'none' ? null : value as ItemPassiveId;
                    onChange({ passiveId, passiveParams: passiveId ? getDefaultPassiveParams(passiveId) : {} });
                }}>
                    <Select.Trigger className="mt-1 w-full" aria-label="Механика пассивной способности" />
                    <Select.Content>
                        <Select.Item value="none">Без способности</Select.Item>
                        {ids.filter(id => getPassiveDefinition(id).available !== false || item.passiveId === id).map(id => (
                            <Select.Item key={id} value={id} disabled={getPassiveDefinition(id).available === false}>
                                {getPassiveDefinition(id).name}{getPassiveDefinition(id).available === false ? ' (архивная)' : ''}
                            </Select.Item>
                        ))}
                    </Select.Content>
                </Select.Root>
            </Text>
            {definition && (
                <>
                    {definition.available !== false && Object.entries(definition.parameters).map(([key, rule]) => (
                        <label key={key}>
                            <Text as="div" size="1" mb="1">{rule.label} · {rule.min}–{rule.max}</Text>
                            <TextField.Root type="number" min={rule.min} max={rule.max} step={1} required value={parameters[key]}
                                onChange={event => onChange({ passiveId: item.passiveId, passiveParams: { ...parameters, [key]: Number(event.target.value) } })} />
                        </label>
                    ))}
                    <Callout.Root color={definition.available === false ? 'gray' : 'orange'}>
                        <Callout.Text>{definition.describe(parameters)}</Callout.Text>
                    </Callout.Root>
                    {definition.available !== false && <Button type="button" size="1" variant="soft" onClick={() => onChange({ passiveId: item.passiveId, passiveParams: getDefaultPassiveParams(item.passiveId!) })}>Рекомендуемые параметры способности</Button>}
                </>
            )}
        </Flex>
    );
}
