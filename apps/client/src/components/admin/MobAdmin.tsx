import { MobDto } from "@mmobot/shared"
import { useEffect, useState } from "react"
import { createMob, deleteMob, getMobs, updateMob } from "../../api"
import { Button, Flex, Table } from "@radix-ui/themes"


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
            if (draft.id > 0) {
                await updateMob(token, draft.id, draft)
            } else {
                await createMob(token, draft)
            }
            setDraft(emptyMob)
            setError(null)
        } catch (e) {
            setError(e instanceof Error ? e.message : "Ошибка сохранения")
        }
    }

    const remove = async (id: number) => {
        try {
            if (!token) return
            await deleteMob(token, id)
        } catch (e) {
            setError(e instanceof Error ? e.message : "Ошибка удаления") // instanceof - проверяет принадлжеит ли объект классу
        }
    }

    return (
        <div>

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