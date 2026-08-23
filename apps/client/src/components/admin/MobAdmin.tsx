import { MobDto } from "@mmobot/shared"
import { useEffect, useState } from "react"
import { createMob, deleteMob, getLocations, getMobs, updateMob } from "../../api"
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
import { Cross2Icon, Pencil1Icon, PlusIcon, TrashIcon } from "@radix-ui/react-icons"


type MobAdminProps = {
    token: string | null
}

const emptyMob: MobDto = {
    id: 0,
    name: "",
    description: "",
    level: 1,
    maxHealth: 10,
    strength: 1,
    defense: 0,
    loot: [],
    pointsReward: 0,
    locationId: "square",
    respawnSeconds: 60
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
        getLocations(token)
            .then((data) => setLocations(data.locations))
            .catch(() => { })
    }

    useEffect(() => {
        refresh()
    }, [token])

    const save = async () => {
        try {
            if (!token) return
            const name = draft.name.trim()
            const description = draft.description.trim()
            const locationId = draft.locationId.trim()
            if (!name || !description || !locationId) {
                setError("Заполните имя, описание и локацию")
                return
            }
            const payload: MobDto = {
                ...draft,
                name,
                description,
                locationId,
                level: Math.max(1, Math.floor(draft.level) || 1),
                maxHealth: Math.max(1, Math.floor(draft.maxHealth) || 1),
                strength: Math.max(1, Math.floor(draft.strength) || 1),
                defense: Math.max(0, Math.floor(draft.defense) || 0),
                pointsReward: Math.max(0, Math.floor(draft.pointsReward) || 0),
                respawnSeconds: Math.max(1, Math.floor(draft.respawnSeconds) || 60),
                loot: Array.isArray(draft.loot) ? draft.loot : []
            }
            if (draft.id > 0) {
                await updateMob(token, draft.id, payload)
            } else {
                await createMob(token, payload)
            }
            setDraft(emptyMob)
            setError(null)
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
            refresh()
        } catch (e) {
            setError(e instanceof Error ? e.message : "Ошибка сохранения")
        }
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
                            {draft.id > 0 ? `Редактирование моба #${draft.id}` : "Новый моб"}
                        </Heading>
                        {draft.id > 0 && (
                            <Button variant="ghost" size="1" color="gray" onClick={() => setDraft(emptyMob)}>
                                <Cross2Icon /> Отменить
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

                    <Grid columns={{ initial: "1", md: "2" }} gap="3">
                        <label>
                            <Text as="div" size="1" weight="medium" mb="1" color="gray">
                                Название
                            </Text>
                            <TextField.Root
                                placeholder="Например: Гоблин"
                                value={draft.name}
                                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                            />
                        </label>

                        <label>
                            <Text as="div" size="1" weight="medium" mb="1" color="gray">
                                Локация
                            </Text>
                            <Select.Root
                                value={draft.locationId}
                                onValueChange={(value) => setDraft({ ...draft, locationId: value })}
                            >
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

                        <label style={{ gridColumn: "1 / -1" }}>
                            <Text as="div" size="1" weight="medium" mb="1" color="gray">
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
                        <NumberField label="Сила" min={1} value={draft.strength}
                            onChange={(v) => setDraft({ ...draft, strength: v })} />
                        <NumberField label="Защита" min={0} value={draft.defense}
                            onChange={(v) => setDraft({ ...draft, defense: v })} />
                        <NumberField label="Награда (очки)" min={0} value={draft.pointsReward}
                            onChange={(v) => setDraft({ ...draft, pointsReward: v })} />
                        <NumberField label="Респавн (сек)" min={1} value={draft.respawnSeconds}
                            onChange={(v) => setDraft({ ...draft, respawnSeconds: v })} />
                    </Grid>

                    <Flex gap="3" justify="end">
                        {draft.id > 0 && (
                            <Button variant="soft" color="gray" onClick={() => setDraft(emptyMob)}>
                                Отмена
                            </Button>
                        )}
                        <Button onClick={save}>
                            {draft.id > 0 ? <><Pencil1Icon /> Сохранить</> : <><PlusIcon /> Создать</>}
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
                            <Table.ColumnHeaderCell justify="end"></Table.ColumnHeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {mobs.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={9}>
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
                                <Table.Cell justify="end">
                                    <Flex gap="2" justify="end">
                                        <Button size="1" variant="soft" onClick={() => {
                                            setDraft(mob)
                                            setError(null)
                                            window.scrollTo({ top: 0, behavior: "smooth" })
                                        }}>
                                            <Pencil1Icon /> Изменить
                                        </Button>
                                        <Button size="1" color="red" variant="soft" onClick={() => remove(mob.id)}>
                                            <TrashIcon /> Удалить
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
