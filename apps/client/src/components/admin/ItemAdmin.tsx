import { ItemDto } from "@mmobot/shared"
import { useState } from "react"

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
    price: 0
}
export const ItemAdmin = ({ token }: ItemAdminProps) => {

    const [items, setItems] = useState<ItemDto[]>([])
    const [draft, setDraft] = useState<ItemDto>(emptyItem)
    return (
        <div>


        </div>
    )
}