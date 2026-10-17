import { MobDto, ItemDto } from "@mmobot/shared"
import { useEffect, useState } from "react"
import { createMob, deleteMob, getLocations, getMobs, getItems, updateMob } from "../../api"
import {
    Button,
    Callout,
    Card,
    Flex,
    Grid,
    Heading,
    Table,
    Text,
    TextField,
    Select
} from "@radix-ui/themes"


type MobAdminProps = {
    token: string | null
}

const emptyMob: MobDto = {
    id: 0,
    name: "",
    description: "",
    level: 0,
    maxHealth: 0,
    strength: 0,
    defense: 0,
    loot: [],
    pointsReward: 0,
    coinReward: 0,
    locationId: "square",
    respawnSeconds: 0
}

type NumberFieldProps = {
    label: string
    value: number
    min?: number
    onChange: (value: number) => void
}

const NumberField = ({ label, value, min, onChange }: NumberFieldProps) => (
    <label>
        <Text as="div" size="1" weight="medium" mb="1" color="gray">
            {label}
        </Text>
        <TextField.Root
            type="number"
            min={min}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
        />
    </label>
)

export const MobAdmin = ({ token }: MobAdminProps) => {

    const [editingId, setEditingId] = useState<number | null>(null)
    const [catalog, setCatalog] = useState<ItemDto[]>([])
    const [busy, setBusy] = useState(false)
    const resetDraft = () => { setDraft(emptyMob); setEditingId(null); }
    const [mobs, setMobs] = useState<MobDto[]>([])
    const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
    const [draft, setDraft] = useState<MobDto>(emptyMob)
    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)

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
        try {
            if (!token) return
            await deleteMob(token, id)
            refresh()
        } catch (e) {
            setError(e instanceof Error ? e.message : "Ошибка удаления")
        }
    }

    return (
        <Flex direction="column" gap="4">
            <Card size="3">
                <Flex direction="column" gap="4">
                    <Flex align="center" gap="2">
                        <Heading size="4">
                            {editingId !== null ? `Редактирование моба #${draft.id}` : "Новый моб"}
                        </Heading>
                        {editingId !== null && (
                            <Button variant="ghost" size="1" color="gray" onClick={resetDraft}>
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

                    <Grid  gap="3">
                        <label>
                            <Text as="div" color="gray">
                                Название
                            </Text>
                            <TextField.Root
                                placeholder="Например: Гоблин"
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
                                        <Select.Item key={loc.id} value={loc.id}>
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
                                placeholder="Описание моба"
                                value={draft.description}
                                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                            />
                        </label>

                        <NumberField label="Уровень" min={1} value={draft.level}
                            onChange={(v) => setDraft({ ...draft, level: v })} />
                        <NumberField label="Макс. HP" min={1} value={draft.maxHealth}
                            onChange={(v) => setDraft({ ...draft, maxHealth: v })} />
                        <NumberField label="Сила" min={0} value={draft.strength}
                            onChange={(v) => setDraft({ ...draft, strength: v })} />
                        <NumberField label="Защита" min={0} value={draft.defense}
                            onChange={(v) => setDraft({ ...draft, defense: v })} />
                        <NumberField label="Награда (очки)" min={0} value={draft.pointsReward}
                            onChange={(v) => setDraft({ ...draft, pointsReward: v })} />
                        <NumberField label="Награда (монеты)" min={0} value={draft.coinReward}
                            onChange={(v) => setDraft({ ...draft, coinReward: v })} />
                        <NumberField label="Респавн (сек)" min={1} value={draft.respawnSeconds}
                            onChange={(v) => setDraft({ ...draft, respawnSeconds: v })} />
                    </Grid>

                    <div className="space-y-3 rounded-lg border p-3">
                        <Text as="div" weight="bold">Добыча с монстра</Text>
                        <p className="text-sm text-gray-600">Каждая строка — независимый шанс получить одну штуку. 0% — никогда, 100% — всегда. Сумма шансов может превышать 100%.</p>
                        {draft.loot.length === 0 && <p className="text-sm text-gray-500">Предметы не выпадают.</p>}
                        {draft.loot.map((entry, index) => (
                            <div key={index} className="flex flex-wrap items-end gap-2 rounded border p-2">
                                <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                                    Предмет
                                    <select className="min-w-0 rounded border p-2" value={entry.itemType}
                                        onChange={(event) => setDraft({ ...draft, loot: draft.loot.map((row, i) => i === index ? { ...row, itemType: Number(event.target.value) } : row) })}>
                                        {catalog.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                                        {!catalog.some((item) => item.id === entry.itemType) && <option value={entry.itemType}>Предмет #{entry.itemType} недоступен</option>}
                                    </select>
                                </label>
                                <label className="flex flex-col gap-1 text-sm">
                                    Шанс, %
                                    <input className="w-24 rounded border p-2" type="number" min={0} max={100} step="any" value={entry.chancePercent}
                                        onChange={(event) => setDraft({ ...draft, loot: draft.loot.map((row, i) => i === index ? { ...row, chancePercent: Number(event.target.value) } : row) })} />
                                </label>
                                <Button type="button" color="red" variant="soft" onClick={() => setDraft({ ...draft, loot: draft.loot.filter((_, i) => i !== index) })}>Удалить</Button>
                            </div>
                        ))}
                        <Button type="button" variant="soft" disabled={catalog.length === 0}
                            onClick={() => setDraft({ ...draft, loot: [...draft.loot, { itemType: catalog[0].id, chancePercent: 100 }] })}>Добавить предмет</Button>
                    </div>

                    <Flex gap="3" justify="end">
                        {editingId !== null && (
                            <Button variant="soft" color="gray" onClick={resetDraft}>
                                Отмена
                            </Button>
                        )}
                        <Button disabled={busy} onClick={save}>
                            {editingId !== null ? "Сохранить" : "Создать"}
                        </Button>
                    </Flex>
                </Flex>
            </Card>

            <Card size="3">
                <Table.Root variant="surface">
                    <Table.Header>
                        <Table.Row>
                            <Table.ColumnHeaderCell justify="center">id</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Имя</Table.ColumnHeaderCell>
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
                                <Table.Cell colSpan={11}>
                                    <Text color="gray">Мобов пока нет</Text>
                                </Table.Cell>
                            </Table.Row>
                        )}
                        {mobs.map((mob) => (
                            <Table.Row key={mob.id}>
                                <Table.Cell justify="center">{mob.id}</Table.Cell>
                                <Table.Cell><Text weight="medium">{mob.name}</Text></Table.Cell>
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
                                        <Button size="1" variant="soft" onClick={() => {
                                            setDraft(mob)
                                            setEditingId(mob.id)
                                            setError(null)
                                            window.scrollTo({ top: 0, behavior: "smooth" })
                                        }}>
                                            Изменить
                                        </Button>
                                        <Button size="1" color="red" variant="soft" onClick={() => remove(mob.id)}>
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
