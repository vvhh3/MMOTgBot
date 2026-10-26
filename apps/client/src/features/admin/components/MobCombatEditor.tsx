import { createMobCombatProfile,type MobCombatProfile } from '@mmobot/shared';
import { Checkbox,Flex,Grid,Heading,Text,TextField } from '@radix-ui/themes';

type NumberFieldProps = {
    label: string;
    value: number;
    min?: number;
    max?: number;
    step?: number | 'any';
    onChange: (value: number) => void;
};

export function MobNumberField({ label,value,min,max,step = 1,onChange }: NumberFieldProps) {
    return (
        <label>
            <Text as="div" size="1" weight="medium" mb="1" color="gray">{label}</Text>
            <TextField.Root type="number" required min={min} max={max} step={step} value={value}
                onChange={(event) => onChange(Number(event.target.value))} />
        </label>
    );
}

type Props = {
    profile: MobCombatProfile;
    onChange: (profile: MobCombatProfile) => void;
};

export default function MobCombatEditor({ profile,onChange }: Props) {
    const strong = profile.strongAttack;
    const guard = profile.guard;

    return (
        <Flex direction="column" gap="4">
            <Heading size="3">Приёмы</Heading>
            <Grid columns={{ initial: '1', sm: '2' }} gap="3">
                <label>
                    <Text as="div" size="1" mb="1" color="gray">Обычная атака</Text>
                    <TextField.Root required maxLength={100} value={profile.attack.name}
                        onChange={(event) => onChange({ ...profile, attack: { ...profile.attack, name: event.target.value } })} />
                </label>
                <MobNumberField label="Точность, %" min={0} max={100} step="any" value={profile.attack.accuracy}
                    onChange={(accuracy) => onChange({ ...profile, attack: { ...profile.attack, accuracy } })} />
            </Grid>
            <Text size="1" color="gray">Обычная атака имеет мощность ×1 и доступна каждый раунд.</Text>

            <Text as="label" size="2">
                <Flex align="center" gap="2">
                    <Checkbox checked={!!strong} onCheckedChange={(checked) => onChange({ ...profile,
                        strongAttack: checked === true ? createMobCombatProfile(profile.rank).strongAttack : null })} />
                    Сильная атака
                </Flex>
            </Text>
            {strong && (
                <Grid columns={{ initial: '1', sm: '2' }} gap="3">
                    <label>
                        <Text as="div" size="1" mb="1" color="gray">Название сильной атаки</Text>
                        <TextField.Root required maxLength={100} value={strong.name}
                            onChange={(event) => onChange({ ...profile, strongAttack: { ...strong, name: event.target.value } })} />
                    </label>
                    <MobNumberField label="Мощность, множитель" min={0.1} max={5} step="any" value={strong.power}
                        onChange={(power) => onChange({ ...profile, strongAttack: { ...strong, power } })} />
                    <MobNumberField label="Точность сильной атаки, %" min={0} max={100} step="any" value={strong.accuracy}
                        onChange={(accuracy) => onChange({ ...profile, strongAttack: { ...strong, accuracy } })} />
                    <MobNumberField label="Перезарядка, полных раундов" min={0} max={20} value={strong.cooldownRounds}
                        onChange={(cooldownRounds) => onChange({ ...profile, strongAttack: { ...strong, cooldownRounds } })} />
                </Grid>
            )}

            <Text as="label" size="2">
                <Flex align="center" gap="2">
                    <Checkbox checked={!!guard} onCheckedChange={(checked) => onChange({ ...profile,
                        guard: checked === true ? createMobCombatProfile(profile.rank === 'boss' ? 'boss' : 'elite').guard : null })} />
                    Защитный приём
                </Flex>
            </Text>
            {guard && (
                <Flex direction="column" gap="3">
                    <Grid columns={{ initial: '1', sm: '2' }} gap="3">
                        <label>
                            <Text as="div" size="1" mb="1" color="gray">Название защиты</Text>
                            <TextField.Root required maxLength={100} value={guard.name}
                                onChange={(event) => onChange({ ...profile, guard: { ...guard, name: event.target.value } })} />
                        </label>
                        <MobNumberField label="Перезарядка защиты, раундов" min={0} max={20} value={guard.cooldownRounds}
                            onChange={(cooldownRounds) => onChange({ ...profile, guard: { ...guard, cooldownRounds } })} />
                        <MobNumberField label="Полный блок, %" min={0} max={100} step="any" value={guard.fullBlockChance}
                            onChange={(fullBlockChance) => onChange({ ...profile, guard: { ...guard, fullBlockChance } })} />
                        <MobNumberField label="Частичный блок, %" min={0} max={100} step="any" value={guard.partialBlockChance}
                            onChange={(partialBlockChance) => onChange({ ...profile, guard: { ...guard, partialBlockChance } })} />
                        <MobNumberField label="Проходит урона при частичном блоке, %" min={0} max={100} step="any" value={guard.partialMultiplier * 100}
                            onChange={(percent) => onChange({ ...profile, guard: { ...guard, partialMultiplier: percent / 100 } })} />
                        <MobNumberField label="Шанс отражения при блоке, %" min={0} max={100} step="any" value={guard.reflectChance}
                            onChange={(reflectChance) => onChange({ ...profile, guard: { ...guard, reflectChance } })} />
                    </Grid>
                    <Text size="1" color={guard.fullBlockChance + guard.partialBlockChance > 100 ? 'red' : 'gray'}>
                        Блок: {guard.fullBlockChance + guard.partialBlockChance}%. Полный урон: {Math.max(0, 100 - guard.fullBlockChance - guard.partialBlockChance)}%.
                        {' '}При отражении возвращается половина удара до активного блока.
                    </Text>
                </Flex>
            )}
        </Flex>
    );
}
