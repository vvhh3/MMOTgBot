import { MobDto } from "@mmobot/shared"
import { useEffect, useState } from "react"
import { createMob, deleteMob, getMobs, updateMob } from "../../api"
import { Button, Flex, Table, TextField } from "@radix-ui/themes"


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

export const MobAdmin = ({ token }: MobAdminProps) => {

    const [mobs, setMobs] = useState<MobDto[]>([])
    const [draft, setDraft] = useState<MobDto>(emptyMob)
    const [error, setError] = useState<string | null>(null)

    const refresh = () => {
        if (!token) return
        getMobs(token)
            .then((data) => setMobs(data.mobs))
            .catch((err) => setError(err.message))
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
            setError(e instanceof Error ? e.message : "Ошибка удаления") // instanceof - проверяет принадлжеит ли объект классу
        }
    }

    return (
        <div>
            <Flex gap="2" wrap="wrap">
                {error && (<div>
                    <p>{error}</p>
                </div>)}
                <p>Название</p>
                <TextField.Root placeholder="Название" value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                <p>Описание</p>
                <TextField.Root placeholder="Описание" value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                <p>Уровень</p>
                <TextField.Root type="number" placeholder="Уровень" value={draft.level}
                    onChange={(e) => setDraft({ ...draft, level: Number(e.target.value) })} />
                <p>Макс Hp</p>
                <TextField.Root type="number" placeholder="Макс. HP" value={draft.maxHealth}
                    onChange={(e) => setDraft({ ...draft, maxHealth: Number(e.target.value) })} />
                <p>Сила</p>
                <TextField.Root type="number" placeholder="Сила" value={draft.strength}
                    onChange={(e) => setDraft({ ...draft, strength: Number(e.target.value) })} />
                <p>Защита</p>
                <TextField.Root type="number" placeholder="Защита" value={draft.defense}
                    onChange={(e) => setDraft({ ...draft, defense: Number(e.target.value) })} />
                    <p>Локация id</p>
                <TextField.Root type="number" placeholder="Локация (id)" value={draft.locationId}
                    onChange={(e) => setDraft({ ...draft, locationId: e.target.value })} />

                    <p>Респавн</p>
                <TextField.Root type="number" placeholder="Респавн (сек)" value={draft.respawnSeconds}
                    onChange={(e) => setDraft({ ...draft, respawnSeconds: Number(e.target.value) })} />
                <Button onClick={save}>{draft.id > 0 ? "Сохранить" : "Создать"}</Button>
                {draft.id > 0 && <Button variant="soft" onClick={() => setDraft(emptyMob)}>Отмена</Button>}
            </Flex>
            <Table.Root>
                <Table.Header>
                    <Table.Row>
                        <Table.ColumnHeaderCell>id</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Имя</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Lvl</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>HP</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Сила</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Защита</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Локация</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {mobs.map((mob) => (
                        <Table.Row key={mob.id}>
                            <Table.Cell>{mob.id}</Table.Cell>
                            <Table.Cell>{mob.name}</Table.Cell>
                            <Table.Cell>{mob.level}</Table.Cell>
                            <Table.Cell>{mob.maxHealth}</Table.Cell>
                            <Table.Cell>{mob.strength}</Table.Cell>
                            <Table.Cell>{mob.defense}</Table.Cell>
                            <Table.Cell>{mob.locationId}</Table.Cell>
                            <Table.Cell>
                                <Flex gap="2">
                                    <Button size="1" variant="soft" onClick={() => setDraft(mob)}>Изменить</Button>
                                    <Button size="1" color="red" onClick={() => remove(mob.id)}>Удалить</Button>
                                </Flex>
                            </Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table.Root>
        </div>
    )
}