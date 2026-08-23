import { QuestsDto } from "@mmobot/shared"
import { useEffect, useState } from "react"
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
import { createQuest, deleteQuest, getQuests, updateQuest } from "../../api"

type QuestAdminProps = {
    token: string | null
}

const emptyQuest: QuestsDto = {
    id: 0,
    title: "",
    description: "",
    difficulty: "easy",
    objectiveType: "kill",
    targetId: null,
    targetCount: 1,
    targetXp: 0,
    targetPoints: 0
}

const DIFFICULTY_LABEL: Record<QuestsDto["difficulty"], string> = {
    easy: "Лёгкий",
    medium: "Средний",
    hard: "Тяжёлый"
}

const OBJECTIVE_LABEL: Record<QuestsDto["objectiveType"], string> = {
    kill: "Убийства",
    walk: "Прогулки",
    collect: "Предметы",
    visit: "Посещения"
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

export const QuestAdmin = ({ token }: QuestAdminProps) => {

    const [quests, setQuests] = useState<QuestsDto[]>([])
    const [draft, setDraft] = useState<QuestsDto>(emptyQuest)

    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)

    const refresh = () => {
        if (!token) return
        getQuests(token)
            .then((res) => setQuests(res.quests))
            .catch((e) => setError(e.message))
    }

    useEffect(() => {
        refresh()
    }, [token])

    const save = async () => {
        if (!token) return
        try {
            const payload: QuestsDto = {
                ...draft,
                targetId: draft.targetId?.trim() ? draft.targetId.trim() : null
            }
            if (draft.id > 0) {
                await updateQuest(token, draft.id, payload)
            } else {
                await createQuest(token, payload)
            }
            setDraft(emptyQuest)
            setSaved(true)
            setError(null)
            setTimeout(() => setSaved(false), 3000)
            refresh()
        } catch (e) {
            setError(e instanceof Error ? e.message : "Ошибка сохранения")
        }
    }

    const remove = async (id: number) => {
        if (!token) return
        try {
            await deleteQuest(token, id)
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
                            {draft.id > 0 ? `Редактирование квеста #${draft.id}` : "Новый квест"}
                        </Heading>
                        {draft.id > 0 && (
                            <Button variant="ghost" size="1" color="gray" onClick={() => setDraft(emptyQuest)}>
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
                            <Callout.Text>Квест сохранён</Callout.Text>
                        </Callout.Root>
                    )}

                    <Grid gap="3">
                        <label>
                            <Text as="div" color="gray">
                                Название
                            </Text>
                            <TextField.Root
                                placeholder="Например: Утренняя пробежка"
                                value={draft.title}
                                onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                        </label>

                        <label>
                            <Text as="div" size="1" mb="1" color="gray">
                                Описание
                            </Text>
                            <TextField.Root
                                placeholder="Описание квеста"
                                value={draft.description}
                                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                            />
                        </label>

                        <label>
                            <Text as="div" size="1" weight="medium" mb="1" color="gray">
                                Сложность
                            </Text>
                            <Select.Root
                                value={draft.difficulty}
                                onValueChange={(value) => setDraft({ ...draft, difficulty: value as QuestsDto["difficulty"] })}>
                                <Select.Trigger placeholder="Выберите сложность" style={{ width: "100%" }} />
                                <Select.Content>
                                    {(Object.keys(DIFFICULTY_LABEL) as Array<QuestsDto["difficulty"]>).map((d) => (
                                        <Select.Item key={d} value={d}>{DIFFICULTY_LABEL[d]}</Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Root>
                        </label>

                        <label>
                            <Text as="div" size="1" weight="medium" mb="1" color="gray">
                                Тип задания
                            </Text>
                            <Select.Root
                                value={draft.objectiveType}
                                onValueChange={(value) => setDraft({ ...draft, objectiveType: value as QuestsDto["objectiveType"] })}>
                                <Select.Trigger placeholder="Выберите тип задания" style={{ width: "100%" }} />
                                <Select.Content>
                                    {(Object.keys(OBJECTIVE_LABEL) as Array<QuestsDto["objectiveType"]>).map((t) => (
                                        <Select.Item key={t} value={t}>{OBJECTIVE_LABEL[t]}</Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Root>
                        </label>

                        <label>
                            <Text as="div" size="1" mb="1" color="gray">
                                Цель (id моба / предмета / локации, пусто = любая)
                            </Text>
                            <TextField.Root
                                type={draft.objectiveType === "walk" ? undefined : "text"}
                                placeholder={draft.objectiveType === "kill" ? "Например: rat" : draft.objectiveType === "visit" || draft.objectiveType === "collect" ? "Например: 1" : "не требуется"}
                                disabled={draft.objectiveType === "walk"}
                                value={draft.targetId ?? ""}
                                onChange={(e) => setDraft({ ...draft, targetId: e.target.value })}
                            />
                        </label>

                        <NumberField label="Количество для выполнения" min={1} value={draft.targetCount}
                            onChange={(v) => setDraft({ ...draft, targetCount: v })} />

                        <NumberField label="Награда: опыт" min={0} value={draft.targetXp}
                            onChange={(v) => setDraft({ ...draft, targetXp: v })} />

                        <NumberField label="Награда: очки" min={0} value={draft.targetPoints}
                            onChange={(v) => setDraft({ ...draft, targetPoints: v })} />
                    </Grid>

                    <Flex gap="3" justify="end">
                        {draft.id > 0 && (
                            <Button variant="soft" color="gray" onClick={() => setDraft(emptyQuest)}>
                                Отмена
                            </Button>
                        )}
                        <Button onClick={save}>
                            {draft.id > 0 ? "Сохранить" : "Создать"}
                        </Button>
                    </Flex>
                </Flex>
            </Card>

            <Card size="3">
                <Table.Root variant="surface">
                    <Table.Header>
                        <Table.Row>
                            <Table.ColumnHeaderCell justify="center">id</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Название</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Описание</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Сложность</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Тип</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="center">Цель</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="center">Кол-во</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="center">Опыт</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="center">Очки</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="end"></Table.ColumnHeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {quests.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={10}>
                                    <Text color="gray">квестов пока нет</Text>
                                </Table.Cell>
                            </Table.Row>
                        )}
                        {quests.map((quest) => (
                            <Table.Row key={quest.id}>
                                <Table.Cell justify="center">{quest.id}</Table.Cell>
                                <Table.Cell><Text weight="medium">{quest.title}</Text></Table.Cell>
                                <Table.Cell>{quest.description}</Table.Cell>
                                <Table.Cell>{DIFFICULTY_LABEL[quest.difficulty]}</Table.Cell>
                                <Table.Cell>{OBJECTIVE_LABEL[quest.objectiveType]}</Table.Cell>
                                <Table.Cell justify="center">{quest.targetId ?? "—"}</Table.Cell>
                                <Table.Cell justify="center">{quest.targetCount}</Table.Cell>
                                <Table.Cell justify="center">{quest.targetXp}</Table.Cell>
                                <Table.Cell justify="center">{quest.targetPoints}</Table.Cell>
                                <Table.Cell justify="end">
                                    <Flex gap="2" justify="end">
                                        <Button size="1" variant="soft" onClick={() => {
                                            setDraft(quest)
                                            setError(null)
                                            window.scrollTo({ top: 0, behavior: "smooth" }) // для скрола на верх
                                        }}>
                                            Изменить
                                        </Button>
                                        <Button size="1" color="red" variant="soft" onClick={() => remove(quest.id)}>
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
