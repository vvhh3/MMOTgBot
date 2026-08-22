import { ItemDto } from "@mmobot/shared"
import { useState } from "react"

type ItemAdminProps = {
    token: string | null
}

export const ItemAdmin = ({ token }: ItemAdminProps) => {

    const [items,setItems] = useState<ItemDto[]>([])
    return(
        <div>


        </div>
    )
}