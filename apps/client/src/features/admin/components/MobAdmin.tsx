import { calculateMobStats,createMobCombatProfile,legacyMobCombatProfile,MOB_RANK_LABELS,recommendedMobStats,type ItemDto,type MobDto,type MobRank } from "@mmobot/shared";
import {
Button,
Callout,
Card,
Checkbox,
Flex,
Grid,
Heading,
Select,
Table,
Text,
TextField
} from "@radix-ui/themes";
import { useEffect,useState } from "react";
import { getItems } from "../../items/api";
import { getLocations } from "../../locations/api";
import { createMob,deleteMob,getMobs,updateMob } from "../../mobs/api";
import MobCombatEditor,{ MobNumberField as NumberField } from './MobCombatEditor';
import MobLootEditor from './MobLootEditor';
import MobBalancePreview from './MobBalancePreview';


type MobAdminProps = {
    token: string | null
}

const emptyMob = (): MobDto => ({
    id: 0,
    name: "",
    description: "",
    ...recommendedMobStats('normal'),
    combatProfile: createMobCombatProfile(),
    loot: [],
    locationId: "square",
    respawnSeconds: 1
});

export const MobAdmin = ({ token }: MobAdminProps) => {

    const [editingId, setEditingId] = useState<number | null>(null)
    const [catalog, setCatalog] = useState<ItemDto[]>([])
    const [busy, setBusy] = useState(false)
    const resetDraft = () => { setDraft(emptyMob()); setEditingId(null); setPreviewLevel(1); }
    const [mobs, setMobs] = useState<MobDto[]>([])
    const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
    const [draft, setDraft] = useState<MobDto>(emptyMob)
    const [previewLevel,setPreviewLevel] = useState(1);
    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)
    const profile = draft.combatProfile ?? legacyMobCombatProfile();
    const otherWeight = mobs.filter(mob => mob.id !== editingId && mob.locationId === 'square')
        .reduce((sum,mob) => sum + (mob.combatProfile ?? legacyMobCombatProfile()).encounterWeight, 0);
    const totalWeight = otherWeight + profile.encounterWeight;
    const encounterPercent = draft.locationId === 'square' && totalWeight > 0 ? profile.encounterWeight / totalWeight * 100 : 0;
    const previewStats = calculateMobStats(draft, previewLevel, profile);
    const applyPreset = () => {
        const suggested = createMobCombatProfile(profile.rank);
        suggested.scaleToPlayer = profile.scaleToPlayer;
        suggested.attack.name = profile.attack.name;
        if (suggested.strongAttack && profile.strongAttack) suggested.strongAttack.name = profile.strongAttack.name;
        if (suggested.guard && profile.guard) suggested.guard.name = profile.guard.name;
        setDraft({ ...draft, ...recommendedMobStats(profile.rank, Math.max(1, draft.level)), combatProfile: suggested });
    };

    const refresh = () => {
        if (!token) return
        getMobs(token)
            .then((data) => setMobs(data.mobs))
            .catch((err) => setError(err.message))
        getItems(token)
            .then((data) => setCatalog(data.items))
            .catch((err) => setError(err.message))
        getLocations(token)
            .then((data) => setLocations(data.locations))
            .catch(() => { })
    }

    useEffect(() => {
        refresh()
    }, [token])

    const save = async () => {
        if (!token || busy) return
        setBusy(true)
        try {
            if (editingId !== null) {
                await updateMob(token, editingId, draft)
            } else {
                await createMob(token, draft)
            }
            resetDraft()
            setError(null)
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
            refresh()
        } catch (e) {
            setError(e instanceof Error ? e.message : "Ошибка сохранения")
        } finally { setBusy(false) }
    }

    const remove = async (id: number) => {
        if (!token || busy) return;
        setBusy(true);
        try {
            await deleteMob(token, id)
            refresh()
        } catch (e) {
            setError(e instanceof Error ? e.message : "Ошибка удаления")
        } finally { setBusy(false); }
    }

    return (
        <Flex direction="column" gap="4">
            <Card size="3">
                <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
                <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
                    <Flex align="center" gap="2">
                        <Heading size="4">
                            {editingId !== null ? `Редактирование моба #${draft.id}` : "Новый моб"}
                        </Heading>
                        {editingId !== null && (
                            <Button type="button" variant="ghost" size="1" color="gray" onClick={resetDraft}>
                                Отменить
                            </Button>
                        )}
                    </Flex>
                    {error && (
                        <Callout.Root color="red">
                            <Callout.Text>{error}</Callout.Text>
                        </Callout.Root>
                    )}
                    {saved && (
                        <Callout.Root color="green">
                            <Callout.Text>Моб сохранён</Callout.Text>
                        </Callout.Root>
                    )}

                    <Grid columns={{ initial: '1', sm: '2' }} gap="3">
                        <label>
                            <Text as="div" color="gray">
                                Название
                            </Text>
                            <TextField.Root
                                required placeholder="Например: Терминал без сдачи"
                                value={draft.name}
                                onChange={(e) => setDraft({ ...draft, name: e.target.value })}/>
                        </label>

                        <label>
                            <Text as="div" size="1" weight="medium" mb="1" color="gray">
                                Локация
                            </Text>
                            <Select.Root
                                value={draft.locationId}
                                onValueChange={(value) => setDraft({ ...draft, locationId: value })}>
                                <Select.Trigger placeholder="Выберите локацию" style={{ width: "100%" }} />
                                <Select.Content>
                                    {locations.map((loc) => (
                                        <Select.Item key={loc.id} value={loc.id} disabled={loc.id !== 'square'}>
                                            {loc.name} ({loc.id})
                                        </Select.Item>
                                    ))}
                                    {!locations.some((l) => l.id === draft.locationId) && draft.locationId !== "" && (
                                        <Select.Item value={draft.locationId}>{draft.locationId}</Select.Item>
                                    )}
                                </Select.Content>
                            </Select.Root>
                        </label>

                        <label>
                            <Text as="div" size="1" mb="1" color="gray">
                                Описание
                            </Text>
                            <TextField.Root
                                required placeholder="Описание моба"
                                value={draft.description}
                                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                            />
                        </label>

                        <label>
                            <Text as="div" size="1" mb="1" color="gray">Класс сложности</Text>
                            <Select.Root value={profile.rank} onValueChange={(rank) => setDraft({ ...draft, combatProfile: { ...profile, rank: rank as MobRank } })}>
                                <Select.Trigger style={{ width: '100%' }} />
                                <Select.Content>{Object.entries(MOB_RANK_LABELS).map(([rank,label]) => <Select.Item key={rank} value={rank}>{label}</Select.Item>)}</Select.Content>
                            </Select.Root>
                        </label>
                        <Text as="label" size="2"><Flex gap="2" align="center">
                            <Checkbox checked={profile.scaleToPlayer} onCheckedChange={(checked) => setDraft({ ...draft, combatProfile: { ...profile, scaleToPlayer: checked === true } })} />
                            Подстраивать уровень под персонажа
                        </Flex></Text>
                        <NumberField label="Вес встречи" min={0} max={10000} step="any" value={profile.encounterWeight}
                            onChange={(encounterWeight) => setDraft({ ...draft, combatProfile: { ...profile, encounterWeight } })} />
                        <Text size="1" color="gray">Вес 2 даёт вдвое больше встреч, чем вес 1. Точный процент рассчитан в предпросмотре.</Text>
                        <NumberField label={profile.scaleToPlayer ? 'Базовый уровень характеристик' : 'Фиксированный уровень моба'} min={1} max={8} value={draft.level}
                            onChange={(v) => setDraft({ ...draft, level: v })} />
                        <NumberField label="Макс. HP" min={1} value={draft.maxHealth}
                            onChange={(v) => setDraft({ ...draft, maxHealth: v })} />
                        <NumberField label="Сила" min={0} value={draft.strength}
                            onChange={(v) => setDraft({ ...draft, strength: v })} />
                        <NumberField label="Защита" min={0} value={draft.defense}
                            onChange={(v) => setDraft({ ...draft, defense: v })} />
                        <NumberField label="Награда: XP и очки" min={0} value={draft.pointsReward}
                            onChange={(v) => setDraft({ ...draft, pointsReward: v })} />
                        <NumberField label="Награда (монеты)" min={0} value={draft.coinReward}
                            onChange={(v) => setDraft({ ...draft, coinReward: v })} />
                    </Grid>
                    <Text size="1" color="gray">Характеристики и награды задаются для базового уровня. При подстройке они растут по классу. Встречи пока доступны только на Площади.</Text>
                    <Button type="button" variant="soft" onClick={applyPreset}>Применить рекомендуемые параметры класса</Button>
                    <Text size="1" color="gray">Кнопка обновит характеристики, приёмы и вес встречи. Названия и выбранная добыча сохранятся.</Text>
                    <MobCombatEditor profile={profile} onChange={(combatProfile) => setDraft({ ...draft, combatProfile })} />
                    <MobLootEditor loot={draft.loot} catalog={catalog} rank={profile.rank} level={previewStats.level}
                        onChange={(loot) => setDraft({ ...draft, loot })} />
                    <MobBalancePreview mob={draft} profile={profile} catalog={catalog} playerLevel={previewLevel}
                        onLevel={setPreviewLevel} encounterPercent={encounterPercent} />

                    <Flex gap="3" justify="end">
                        {editingId !== null && (
                            <Button type="button" variant="soft" color="gray" onClick={resetDraft}>
                                Отмена
                            </Button>
                        )}
                        <Button type="submit" disabled={busy || !!profile.guard && profile.guard.fullBlockChance + profile.guard.partialBlockChance > 100}>
                            {editingId !== null ? "Сохранить" : "Создать"}
                        </Button>
                    </Flex>
                </fieldset>
                </form>
            </Card>

            <Card size="3">
                <Table.Root variant="surface">
                    <Table.Header>
                        <Table.Row>
                            <Table.ColumnHeaderCell justify="center">id</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Имя</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Класс / вес</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="center">Lvl</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="center">HP</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="center">Сила</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="center">Защита</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Локация</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Награда</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Монеты</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Добыча и шанс</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="end"></Table.ColumnHeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {mobs.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={12}>
                                    <Text color="gray">Мобов пока нет</Text>
                                </Table.Cell>
                            </Table.Row>
                        )}
                        {mobs.map((mob) => (
                            <Table.Row key={mob.id}>
                                <Table.Cell justify="center">{mob.id}</Table.Cell>
                                <Table.Cell><Text weight="medium">{mob.name}</Text></Table.Cell>
                                <Table.Cell>{MOB_RANK_LABELS[(mob.combatProfile ?? legacyMobCombatProfile()).rank]} / {(mob.combatProfile ?? legacyMobCombatProfile()).encounterWeight}</Table.Cell>
                                <Table.Cell justify="center">{mob.level}</Table.Cell>
                                <Table.Cell justify="center">{mob.maxHealth}</Table.Cell>
                                <Table.Cell justify="center">{mob.strength}</Table.Cell>
                                <Table.Cell justify="center">{mob.defense}</Table.Cell>
                                <Table.Cell>{mob.locationId}</Table.Cell>
                                <Table.Cell>{mob.pointsReward}</Table.Cell>
                                <Table.Cell>{mob.coinReward}</Table.Cell>
                                <Table.Cell>{mob.loot.length === 0 ? "—" : mob.loot.map((entry, index) => (
                                    <div key={index}>{catalog.find((item) => item.id === entry.itemType)?.name ?? `#${entry.itemType}`} — {entry.chancePercent}%</div>
                                ))}</Table.Cell>
                                <Table.Cell justify="end">
                                    <Flex gap="2" justify="end">
                                        <Button disabled={busy} size="1" variant="soft" onClick={() => {
                                            setDraft(mob)
                                            setEditingId(mob.id)
                                            setError(null)
                                            window.scrollTo({ top: 0, behavior: "smooth" })
                                        }}>
                                            Изменить
                                        </Button>
                                        <Button disabled={busy} size="1" color="red" variant="soft" onClick={() => remove(mob.id)}>
                                            Удалить
                                        </Button>
                                    </Flex>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table.Root>
            </Card>
        </Flex>
    )
}
