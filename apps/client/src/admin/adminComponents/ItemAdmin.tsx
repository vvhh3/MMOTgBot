import { ItemDto } from "@mmobot/shared"
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
import { createItem, deleteItem, getItems, updateItem } from "../../api"

type ItemAdminProps = {
    token: string | null
}
const emptyItem: ItemDto = {
    id: 0,
    name: "",
    description: "",
    type: "other",
    damage: 0,
    defense: 0,
    healAmount: 0,
    price: 0,
    icon: ''
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

export const ItemAdmin = ({ token }: ItemAdminProps) => {

    const [items, setItems] = useState<ItemDto[]>([])
    const [draft, setDraft] = useState<ItemDto>(emptyItem)

    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)

    const refresh = () => {
        if (!token) return
        getItems(token)
            .then((res) => setItems(res.items))
            .catch((e) => setError(e.message))
    }

    useEffect(() => {
        refresh()
    }, [token])

    const save = async () => {
        if (!token) return
        try {
            if (draft.id > 0) {
                await updateItem(token, draft.id, draft)
            } else {
                await createItem(token, draft)
            }
            setDraft(emptyItem)
            setSaved(true)
            setError(null)
            setTimeout(() => setSaved(false), 3000)
            refresh()
        } catch (e) {
            setError(e instanceof Error ? e.message : "Ошибка сохранения")
        }
    }

    const remove =async (id: number) => {
        if(!token) return
        try{
            await deleteItem(token,id)
            refresh()
        }catch(e){
            setError(e instanceof Error ? e.message : "Ошибка удаления")
        }
    }
    
    return (
        
        <Flex direction="column" gap="4">
            <Card size="3">
                <Flex direction="column" gap="4">
                    <Flex align="center" gap="2">
                        <Heading size="4">
                            {draft.id > 0 ? `Редактирование предмета #${draft.id}` : "Новый предмет"}
                        </Heading>
                        {draft.id > 0 && (
                            <Button variant="ghost" size="1" color="gray" onClick={() => setDraft(emptyItem)}>
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
                            <Callout.Text>Предмет сохранён</Callout.Text>
                        </Callout.Root>
                    )}

                    <Grid gap="3">
                        <label>
                            <Text as="div" color="gray">
                                Название
                            </Text>
                            <TextField.Root
                                placeholder="Например: Кирка"
                                value={draft.name}
                                onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                        </label>

                        <label>
                            <Text as="div" size="1" mb="1" color="gray">
                                Описание
                            </Text>
                            <TextField.Root
                                placeholder="Описание предмета"
                                value={draft.description}
                                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                            />
                        </label>

                        <label>
                            <Text as="div" size="1" weight="medium" mb="1" color="gray">
                                Тип предмета
                            </Text>
                            <Select.Root
                                value={draft.type}
                                onValueChange={(value) => setDraft({ ...draft, type: value as ItemDto["type"] })}>
                                <Select.Trigger placeholder="Выберите тип предмета" style={{ width: "100%" }} />
                                <Select.Content>
                                    <Select.Item value="other">other</Select.Item>
                                    <Select.Item value="weapon">weapon</Select.Item>
                                    <Select.Item value="armor">armor</Select.Item>
                                    <Select.Item value="potion">potion</Select.Item>
                                    <Select.Item value="material">material</Select.Item>
                                </Select.Content>
                            </Select.Root>
                        </label>


                        <NumberField label="damage" min={0} value={draft.damage}
                            onChange={(v) => setDraft({ ...draft, damage: v })} />

                        <NumberField label="defense" min={1} value={draft.defense}
                            onChange={(v) => setDraft({ ...draft, defense: v })} />

                        <NumberField label="healAmount" min={0} value={draft.healAmount}
                            onChange={(v) => setDraft({ ...draft, healAmount: v })} />

                        <NumberField label="price" min={0} value={draft.price}
                            onChange={(v) => setDraft({ ...draft, price: v })} />
                        <label>
                            <Text as="div" size="1" weight="medium" mb="1" color="gray">
                                SVG иконка
                            </Text>
                            <textarea
                                placeholder="Вставьте SVG код..."
                                value={draft.icon}
                                onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
                                style={{ width: "100%", minHeight: "80px", fontFamily: "monospace", fontSize: "12px", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                            />
                            {draft.icon && (
                                <div className="w-10 h-10 mt-1" dangerouslySetInnerHTML={{__html: draft.icon}}></div>
                            )}
                        </label>
                    </Grid>

                    <Flex gap="3" justify="end">
                        {draft.id > 0 && (
                            <Button variant="soft" color="gray" onClick={() => setDraft(emptyItem)}>
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
                            <Table.ColumnHeaderCell>Имя</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Описание</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Тип</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="center">Урон</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="center">Защита</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="center">Лечение</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="center">Цена</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="center">Иконка</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="end"></Table.ColumnHeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {items.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={10}>
                                    <Text color="gray">предметов пока нет</Text>
                                </Table.Cell>
                            </Table.Row>
                        )}
                        {items.map((item) => (
                            <Table.Row key={item.id}>
                                <Table.Cell justify="center">{item.id}</Table.Cell>
                                <Table.Cell><Text weight="medium">{item.name}</Text></Table.Cell>
                                <Table.Cell justify="center">{item.description}</Table.Cell>
                                <Table.Cell justify="center">{item.type}</Table.Cell>
                                <Table.Cell justify="center">{item.damage}</Table.Cell>
                                <Table.Cell justify="center">{item.defense}</Table.Cell>
                                <Table.Cell>{item.healAmount}</Table.Cell>
                                <Table.Cell>{item.price}</Table.Cell>
                                <Table.Cell justify="center">
                                    {item.icon ? (
                                        <div className="w-8 h-8 mx-auto" dangerouslySetInnerHTML={{__html: item.icon}}></div>
                                    ) : (
                                        <Text color="gray">—</Text>
                                    )}
                                </Table.Cell>
                                <Table.Cell justify="end">
                                    <Flex gap="2" justify="end">
                                        <Button size="1" variant="soft" onClick={() => {
                                            setDraft(item)
                                            setError(null)
                                            window.scrollTo({ top: 0, behavior: "smooth" }) // для скрола на верх
                                        }}>
                                            Изменить
                                        </Button>
                                        <Button size="1" color="red" variant="soft" onClick={() => remove(item.id)}>
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