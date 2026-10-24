import {
DAMAGE_CATEGORY_LABELS,
DAMAGE_TYPE_LABELS,DAMAGE_TYPES_BY_CATEGORY,
getDefaultPassiveParams,getPassiveDefinition,
getPassiveIdsForType,
ItemDto,
RARITY_COLORS,
RARITY_LABELS,
WEAPON_FAMILY_LABELS,
type ItemPassiveId,
} from "@mmobot/shared";
import {
Button,
Callout,
Card,
Flex,
Grid,
Heading,
Select,
Table,
Text,
TextField
} from "@radix-ui/themes";
import { useEffect,useState } from "react";
import { createItem,deleteItem,getItems,updateItem } from "../../items/api";

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
    shopAvailable: false,
    icon: '',
    rarity: 'common', weaponFamily: null, damageCategory: null, damageType: null, passiveId: null, passiveParams: {},
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

const ChoiceField = ({ label, value, options, onChange }: {
    label: string; value: string; options: Record<string, string>; onChange: (value: string) => void;
}) => (
    <label className="flex flex-col gap-1 text-sm">
        {label}
        <select className="rounded border p-2" value={value} onChange={(event) => onChange(event.target.value)}>
            {Object.entries(options).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
    </label>
);

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
                                onValueChange={(value) => setDraft({ ...draft, type: value as ItemDto["type"],
                                    weaponFamily: null, damageCategory: null, damageType: null, passiveId: null, passiveParams: {},
                                })}>
                                <Select.Trigger placeholder="Выберите тип предмета" style={{ width: "100%" }} />
                                <Select.Content>
                                    <Select.Item value="other">Прочее</Select.Item>
                                    <Select.Item value="weapon">Оружие</Select.Item>
                                    <Select.Item value="armor">Броня</Select.Item>
                                    <Select.Item value="potion">Расходник</Select.Item>
                                    <Select.Item value="material">Материал</Select.Item>
                                </Select.Content>
                            </Select.Root>
                        </label>


                        <ChoiceField label="Редкость" value={draft.rarity} options={RARITY_LABELS}
                            onChange={(rarity) => setDraft({ ...draft, rarity: rarity as ItemDto["rarity"] })} />
                        {draft.type === "weapon" && (
                            <div className="grid gap-3 rounded-lg border p-3">
                                <p className="text-sm text-gray-600">Новые экземпляры получают уровень 1. Категории урона и пассивки подготовлены для будущей боевой системы и пока не действуют.</p>
                                <ChoiceField label="Семейство оружия" value={draft.weaponFamily ?? "legacy"} options={WEAPON_FAMILY_LABELS}
                                    onChange={(weaponFamily) => setDraft({ ...draft, weaponFamily: weaponFamily as ItemDto["weaponFamily"] })} />
                                <ChoiceField label="Категория урона" value={draft.damageCategory ?? "physical"} options={DAMAGE_CATEGORY_LABELS}
                                    onChange={(value) => {
                                        const damageCategory = value as NonNullable<ItemDto["damageCategory"]>;
                                        setDraft({ ...draft, damageCategory, damageType: DAMAGE_TYPES_BY_CATEGORY[damageCategory][0] });
                                    }} />
                                <ChoiceField label="Тип урона" value={draft.damageType ?? "blunt"}
                                    options={Object.fromEntries(DAMAGE_TYPES_BY_CATEGORY[draft.damageCategory ?? "physical"].map((type) => [type, DAMAGE_TYPE_LABELS[type]]))}
                                    onChange={(damageType) => setDraft({ ...draft, damageType: damageType as ItemDto["damageType"] })} />
                            </div>
                        )}
                        {getPassiveIdsForType(draft.type).length > 0 && (
                            <div className="grid gap-3 rounded-lg border p-3">
                                <p className="text-sm text-gray-600">Особые эффекты подготовлены для будущей боевой системы и пока не действуют.</p>
                                <ChoiceField label="Будущий эффект" value={draft.passiveId ?? "none"}
                                    options={{ none: "Без эффекта", ...Object.fromEntries(getPassiveIdsForType(draft.type).map((id) => [id, getPassiveDefinition(id).name])) }}
                                    onChange={(value) => {
                                        const passiveId = value === "none" ? null : value as ItemPassiveId;
                                        setDraft({ ...draft, passiveId, passiveParams: passiveId ? getDefaultPassiveParams(passiveId) : {} });
                                    }} />
                                {draft.passiveId && Object.entries(getPassiveDefinition(draft.passiveId).parameters).map(([key, rule]) => (
                                    <NumberField key={key} label={rule.label} min={rule.min} value={draft.passiveParams[key] ?? rule.default}
                                        onChange={(value) => setDraft({ ...draft, passiveParams: { ...draft.passiveParams, [key]: value } })} />
                                ))}
                                {draft.passiveId && <p className="text-sm text-gray-600">{getPassiveDefinition(draft.passiveId).describe(draft.passiveParams)}</p>}
                            </div>
                        )}
                        <NumberField label="Сила оружия (текущий бонус атаки)" min={0} value={draft.damage}
                            onChange={(v) => setDraft({ ...draft, damage: v })} />

                        <NumberField label="Защита" min={0} value={draft.defense}
                            onChange={(v) => setDraft({ ...draft, defense: v })} />

                        <NumberField label="Лечение" min={0} value={draft.healAmount}
                            onChange={(v) => setDraft({ ...draft, healAmount: v })} />

                        <NumberField label="Цена" min={0} value={draft.price}
                            onChange={(v) => setDraft({ ...draft, price: v })} />
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={draft.shopAvailable}
                                onChange={(e) => setDraft({ ...draft, shopAvailable: e.target.checked })}
                            />
                            <Text size="2">Доступен в магазине и для продажи игроком</Text>
                        </label>
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
                            <Table.ColumnHeaderCell>Редкость</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Семейство</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Категория урона</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Тип урона</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Будущий эффект</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Начальный уровень</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="center">Сила</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="center">Защита</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="center">Лечение</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="center">Цена</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="center">Магазин</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="center">Иконка</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell justify="end"></Table.ColumnHeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {items.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={17}>
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
                                <Table.Cell><span style={{ color: RARITY_COLORS[item.rarity] }}>{RARITY_LABELS[item.rarity]}</span></Table.Cell>
                                <Table.Cell>{item.weaponFamily ? WEAPON_FAMILY_LABELS[item.weaponFamily] : "—"}</Table.Cell>
                                <Table.Cell>{item.damageCategory ? DAMAGE_CATEGORY_LABELS[item.damageCategory] : "—"}</Table.Cell>
                                <Table.Cell>{item.damageType ? DAMAGE_TYPE_LABELS[item.damageType] : "—"}</Table.Cell>
                                <Table.Cell>{item.passiveId ? getPassiveDefinition(item.passiveId).name : "—"}</Table.Cell>
                                <Table.Cell>{item.type === "weapon" ? 1 : "—"}</Table.Cell>
                                <Table.Cell justify="center">{item.damage}</Table.Cell>
                                <Table.Cell justify="center">{item.defense}</Table.Cell>
                                <Table.Cell>{item.healAmount}</Table.Cell>
                                <Table.Cell>{item.price}</Table.Cell>
                                <Table.Cell justify="center">{item.shopAvailable ? "Да" : "Нет"}</Table.Cell>
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
