import React, { useEffect, useState } from "react";
import { Card, Text, Button } from "@radix-ui/themes";
import { FriendDto } from "@mmobot/shared";
import { createTrade, getFriends } from "../../../api";
import { useNavigate } from "react-router-dom";

type ModalSelectOfFriendProps = {
    isShow: boolean
    token: string | null
    onClose: () => void
}

export default function ModalSelectOfFriend({ isShow, token, onClose }: ModalSelectOfFriendProps) {
    const [friends, setFriends] = useState<FriendDto[]>([])
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()

    useEffect(() => {
        if (!isShow || !token) return
        getFriends(token)
            .then((data) => setFriends(data.friends))
            .catch((e) => setError(e instanceof Error ? e.message : "Не удалось загрузить друзей"))
    }, [isShow, token])

    if (!isShow) return null

    const handleTrade = async (friendId: number) => {
        if (!token) return
        setBusy(true)
        setError(null)
        try {
            await createTrade(token, friendId)
            onClose()
            navigate("/Exchange")
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось предложить обмен")
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40">
            <div className="relative w-full max-h-[80%] overflow-y-auto rounded-t-2xl bg-white p-4">
                <button
                    onClick={onClose}
                    aria-label="Закрыть"
                    className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 border-black text-lg leading-none"
                >
                    ×
                </button>
                <Text size="3" weight="bold">Выберите друга для обмена</Text>
                {error && <Text color="red" size="1" className="block mt-2">{error}</Text>}
                {friends.length === 0 && !error && (
                    <Text color="gray" size="1" className="block mt-3">У вас пока нет друзей</Text>
                )}
                <div className="flex flex-col gap-2 mt-3">
                    {friends.map((f) => (
                        <Card key={f.id} className="flex flex-row items-center justify-between">
                            <div className="flex flex-col">
                                <Text size="2" weight="bold">{f.name}</Text>
                                <Text size="1" color="gray">Lv {f.level} {f.online ? "• в сети" : ""}</Text>
                            </div>
                            <Button
                                disabled={busy}
                                onClick={() => handleTrade(f.id)}
                                style={{ background: "#E8603C", border: "solid 2px black" }}
                            >
                                Обмен
                            </Button>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    )
}
