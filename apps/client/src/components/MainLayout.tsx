import { Avatar, Button } from "@radix-ui/themes";
import { Header } from "@radix-ui/themes/components/table";
import Map from "./ui/Maps/Maps";
import Profile from "./Profile";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { StrictMode, useEffect, useState, useRef } from "react"
import { PlayerDto, PvpStateDto, TradeStateDto } from "@mmobot/shared";
import { acceptPvp, acceptTrade, cancelPvp, cancelTrade } from "../api";

type LayoutProps = {
    player: PlayerDto | null
    token: string | null
    error: string | null
    onError: (error: string) => void
    pvpState: PvpStateDto | null
    tradeState: TradeStateDto | null
}

export default function MainLayout({ player, token, error,onError, pvpState, tradeState }: LayoutProps) {

    const [showIsModal,setIsShowModal] = useState(false)
    const notifRef = useRef<HTMLDivElement | null>(null) // ссылка на панель уведомлений
    const navigate = useNavigate()

    // Закрываем панель уведомлений при клике вне её
    useEffect(() => {
        if (!showIsModal) return
        const handleClickOutside = (event: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setIsShowModal(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [showIsModal])

    const pvpIncoiming = pvpState?.status === "pending" && pvpState.direction === "incoming"
    const tradeIncoiming = tradeState?.status === "pending" && tradeState.direction === "incoming"

    // Принять/отклонить бой
    const handlePvpAccept = async () => {
        if (!token || !pvpState) return
        try { 
            await acceptPvp(token, pvpState.id)
            navigate("/Fight")
        } catch (e) { 
            onError(e instanceof Error ? e.message : "Ошибка принятия боя")
        }
    }
    const handlePvpDecline = async () => {
        if (!token || !pvpState) return
        try { 
            await cancelPvp(token, pvpState.id) 
        } catch (e) { 
           onError(e instanceof Error ? e.message : "Ошибка отклонения боя")
        }
    }

    // Принять/отклонить трейд
    const handleTradeAccept = async () => {
        if (!token || !tradeState) return
        try { 
            await acceptTrade(token, tradeState.id); 
            navigate("/Exchange") 
        } catch (e) {
            onError(e instanceof Error ? e.message : "Ошибка принятия обмена")
        }
    }
    const handleTradeDecline = async () => {
        if (!token || !tradeState) return
        try { 
            await cancelTrade(token, tradeState.id) 
        } catch (e) { 
            onError(e instanceof Error ? e.message : "Ошибка отклонения обмена") 
        }
    }

    useEffect(() => {
        const tg = window.Telegram?.WebApp;

        tg?.ready?.();
        tg?.expand?.();
    }, [])

    const ids = [828311361,1762717096]
    // const adminId = (import.meta.env.VITE_ADMIN_IDS ?? "").split(",").map(Number).filter(Boolean)
    const isAdmin = (import.meta.env.VITE_ADMIN_PANEL == "true" ? true :  (ids.map(Number).filter(Boolean).includes(player?.id ?? -1) ? true : false ))
    
    return (
        <div className="flex flex-col w-full overflow-hidden" style={{ height: "var(--tg-viewport-stable-height, 100dvh)", }}>
            <div className="flex justify-between items-center p-1 shrink-0 border-b-2" style={{ paddingTop: "calc(var(--tg-safe-area-inset-top, 0px) + var(--tg-content-safe-area-inset-top, 0px) + 4px)", }}>
                <Link to="/">
                    <header className="font-bold pl-3 w-fit">MMONSK</header>
                </Link>
                <p className="text-red-500 w-full">{error}</p>
                <div className="flex flex-row items-center gap-4">

                    {/* Кнопка уведомлений (свг-иконка тут) */}
                    <button onClick={() => setIsShowModal(v => !v)} className="relative">
                        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="#8A7A60" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                        {(pvpIncoiming || tradeIncoiming)  && (
                            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
                                <div className=" bg-red-500 rounded-full"></div>
                            </span>
                        )}
                    </button>

                    <Link to="/Profile">
                        <div className="flex flex-row items-center gap-2">
                            <div className="w-10 text-[#E8603C] ">
                                <p className="text-[13px]">Lv {player?.level}</p>
                            </div>
                            <Avatar radius="full" fallback={`${player ? player.name[0] : "А"}`} color="green" size="4" ></Avatar>
                        </div>
                    </Link>
                </div>
            </div>
            
            <div className="relative w-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                {/* Выпадающая панель уведомлений */}
                    {showIsModal && (
                        <div ref={notifRef} className="absolute top-0 left-2 right-2 z-[100] mt-2 rounded-2xl border bg-white p-3 shadow-2xl">
                            <p className="font-bold mb-2">Уведомления</p>

                            {pvpIncoiming && (
                                <div className="flex flex-col gap-2 border-b pb-2">
                                    <div className="flex w-full">
                                        <svg  height="20px" width="20px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" version="1.1" fill="none" stroke="#E85D2F" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" > <g id="SVGRepo_bgCarrier" stroke-width="0"></g> <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" ></g> <g id="SVGRepo_iconCarrier">{" "}<path d="m2.75 9.25 1.5 2.5 2 1.5m-4.5 0 1 1m1.5-2.5-1.5 1.5m3-1 8.5-8.5v-2h-2l-8.5 8.5"></path>{" "} <path d="m10.25 12.25-2.25-2.25m2-2 2.25 2.25m1-1-1.5 2.5-2 1.5m4.5 0-1 1m-1.5-2.5 1.5 1.5m-7.25-5.25-4.25-4.25v-2h2l4.25 4.25"></path>{" "}</g></svg>
                                        <p className="text-sm">{pvpState.partnerName} вызывает вас на бой!</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={handlePvpAccept} className="flex-1 p-2 bg-green-600 text-white rounded-lg">Принять</button>
                                        <button onClick={handlePvpDecline} className="flex-1 p-2 bg-red-500 text-white rounded-lg">Отклонить</button>
                                    </div>
                                </div>
                            )}

                            {tradeIncoiming && (
                                <div className="flex flex-col gap-2 border-b pb-2">
                                     <svg height="20px" width="20px"  viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" > <g id="SVGRepo_bgCarrier" stroke-width="0"></g>  <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" ></g> <g id="SVGRepo_iconCarrier"> {" "} <path d="M19.9381 13C19.979 12.6724 20 12.3387 20 12C20 7.58172 16.4183 4 12 4C9.49942 4 7.26681 5.14727 5.7998 6.94416M4.06189 11C4.02104 11.3276 4 11.6613 4 12C4 16.4183 7.58172 20 12 20C14.3894 20 16.5341 18.9525 18 17.2916M15 17H18V17.2916M5.7998 4V6.94416M5.7998 6.94416V6.99993L8.7998 7M18 20V17.2916" stroke="#E85D2F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ></path>{" "} </g> </svg>
                                    <p className="text-sm">{tradeState.partnerName} предлагает вам обмен</p>
                                    <div className="flex gap-2">
                                        <button onClick={handleTradeAccept} className="flex-1 p-2 bg-green-600 text-white rounded-lg">Принять</button>
                                        <button onClick={handleTradeDecline} className="flex-1 p-2 bg-red-500 text-white rounded-lg">Отклонить</button>
                                    </div>
                                </div>
                            )}

                            {!pvpIncoiming && !tradeIncoiming && (
                                <p className="text-sm text-gray-400">Уведомлений нет</p>
                            )}
                        </div>
                    )}
                <Outlet></Outlet>
            </div>

            <div className="flex flex-row w-full justify-around shadow-[0_4px_20px_rgba(0,0,0,0.15)] h-20 shrink-0 border-t-2" style={{ paddingBottom: "var(--tg-safe-area-inset-bottom, 0px)", }} >
                <Link to="/">
                    <div className=" flex flex-col justify-center items-center h-20 w-16.25">
                        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M21.4498 10.275L11.9998 3.1875L2.5498 10.275L2.9998 11.625H3.7498V20.25H20.2498V11.625H20.9998L21.4498 10.275ZM5.2498 18.75V10.125L11.9998 5.0625L18.7498 10.125V18.75H14.9999V14.3333L14.2499 13.5833H9.74988L8.99988 14.3333V18.75H5.2498ZM10.4999 18.75H13.4999V15.0833H10.4999V18.75Z" fill="#8A7A60"></path> </g></svg>
                        <p className="text-[13px] font-normal text-[#8A7A60]">Главная</p>
                    </div>
                </Link>
                <Link to="/Tasks">
                    <div className=" flex flex-col justify-center items-center h-20 w-16.25">
                        <svg className="h-7.5 w-7.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M12 10.4V20M12 10.4C12 8.15979 12 7.03969 11.564 6.18404C11.1805 5.43139 10.5686 4.81947 9.81596 4.43597C8.96031 4 7.84021 4 5.6 4H4.6C4.03995 4 3.75992 4 3.54601 4.10899C3.35785 4.20487 3.20487 4.35785 3.10899 4.54601C3 4.75992 3 5.03995 3 5.6V16.4C3 16.9601 3 17.2401 3.10899 17.454C3.20487 17.6422 3.35785 17.7951 3.54601 17.891C3.75992 18 4.03995 18 4.6 18H7.54668C8.08687 18 8.35696 18 8.61814 18.0466C8.84995 18.0879 9.0761 18.1563 9.29191 18.2506C9.53504 18.3567 9.75977 18.5065 10.2092 18.8062L12 20M12 10.4C12 8.15979 12 7.03969 12.436 6.18404C12.8195 5.43139 13.4314 4.81947 14.184 4.43597C15.0397 4 16.1598 4 18.4 4H19.4C19.9601 4 20.2401 4 20.454 4.10899C20.6422 4.20487 20.7951 4.35785 20.891 4.54601C21 4.75992 21 5.03995 21 5.6V16.4C21 16.9601 21 17.2401 20.891 17.454C20.7951 17.6422 20.6422 17.7951 20.454 17.891C20.2401 18 19.9601 18 19.4 18H16.4533C15.9131 18 15.643 18 15.3819 18.0466C15.15 18.0879 14.9239 18.1563 14.7081 18.2506C14.465 18.3567 14.2402 18.5065 13.7908 18.8062L12 20" stroke="#8A7A60" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></g></svg>
                        <p className="text-[13px] font-normal text-[#8A7A60]">Задания</p>
                    </div>
                </Link>
                <Link to="/Team">
                    <div className=" flex flex-col justify-center items-center h-20 w-16.25">
                        <svg className="h-7.5 w-7.5" fill="#8A7A60" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" stroke="#8A7A60"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M824.2 699.9a301.55 301.55 0 0 0-86.4-60.4C783.1 602.8 812 546.8 812 484c0-110.8-92.4-201.7-203.2-200-109.1 1.7-197 90.6-197 200 0 62.8 29 118.8 74.2 155.5a300.95 300.95 0 0 0-86.4 60.4C345 754.6 314 826.8 312 903.8a8 8 0 0 0 8 8.2h56c4.3 0 7.9-3.4 8-7.7 1.9-58 25.4-112.3 66.7-153.5A226.62 226.62 0 0 1 612 684c60.9 0 118.2 23.7 161.3 66.8C814.5 792 838 846.3 840 904.3c.1 4.3 3.7 7.7 8 7.7h56a8 8 0 0 0 8-8.2c-2-77-33-149.2-87.8-203.9zM612 612c-34.2 0-66.4-13.3-90.5-37.5a126.86 126.86 0 0 1-37.5-91.8c.3-32.8 13.4-64.5 36.3-88 24-24.6 56.1-38.3 90.4-38.7 33.9-.3 66.8 12.9 91 36.6 24.8 24.3 38.4 56.8 38.4 91.4 0 34.2-13.3 66.3-37.5 90.5A127.3 127.3 0 0 1 612 612zM361.5 510.4c-.9-8.7-1.4-17.5-1.4-26.4 0-15.9 1.5-31.4 4.3-46.5.7-3.6-1.2-7.3-4.5-8.8-13.6-6.1-26.1-14.5-36.9-25.1a127.54 127.54 0 0 1-38.7-95.4c.9-32.1 13.8-62.6 36.3-85.6 24.7-25.3 57.9-39.1 93.2-38.7 31.9.3 62.7 12.6 86 34.4 7.9 7.4 14.7 15.6 20.4 24.4 2 3.1 5.9 4.4 9.3 3.2 17.6-6.1 36.2-10.4 55.3-12.4 5.6-.6 8.8-6.6 6.3-11.6-32.5-64.3-98.9-108.7-175.7-109.9-110.9-1.7-203.3 89.2-203.3 199.9 0 62.8 28.9 118.8 74.2 155.5-31.8 14.7-61.1 35-86.5 60.4-54.8 54.7-85.8 126.9-87.8 204a8 8 0 0 0 8 8.2h56.1c4.3 0 7.9-3.4 8-7.7 1.9-58 25.4-112.3 66.7-153.5 29.4-29.4 65.4-49.8 104.7-59.7 3.9-1 6.5-4.7 6-8.7z"></path> </g></svg>                    <p className="text-[13px] font-normal text-[#8A7A60]">Друзья</p>
                    </div>
                </Link>

                {isAdmin && (
                    <>
                        <Link to="/AdminPanel">
                            <div className=" flex flex-col justify-center items-center h-20 w-16.25">
                                <svg className="h-7.5 w-7.5" fill="#8A7A60" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" stroke="#8A7A60"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M824.2 699.9a301.55 301.55 0 0 0-86.4-60.4C783.1 602.8 812 546.8 812 484c0-110.8-92.4-201.7-203.2-200-109.1 1.7-197 90.6-197 200 0 62.8 29 118.8 74.2 155.5a300.95 300.95 0 0 0-86.4 60.4C345 754.6 314 826.8 312 903.8a8 8 0 0 0 8 8.2h56c4.3 0 7.9-3.4 8-7.7 1.9-58 25.4-112.3 66.7-153.5A226.62 226.62 0 0 1 612 684c60.9 0 118.2 23.7 161.3 66.8C814.5 792 838 846.3 840 904.3c.1 4.3 3.7 7.7 8 7.7h56a8 8 0 0 0 8-8.2c-2-77-33-149.2-87.8-203.9zM612 612c-34.2 0-66.4-13.3-90.5-37.5a126.86 126.86 0 0 1-37.5-91.8c.3-32.8 13.4-64.5 36.3-88 24-24.6 56.1-38.3 90.4-38.7 33.9-.3 66.8 12.9 91 36.6 24.8 24.3 38.4 56.8 38.4 91.4 0 34.2-13.3 66.3-37.5 90.5A127.3 127.3 0 0 1 612 612zM361.5 510.4c-.9-8.7-1.4-17.5-1.4-26.4 0-15.9 1.5-31.4 4.3-46.5.7-3.6-1.2-7.3-4.5-8.8-13.6-6.1-26.1-14.5-36.9-25.1a127.54 127.54 0 0 1-38.7-95.4c.9-32.1 13.8-62.6 36.3-85.6 24.7-25.3 57.9-39.1 93.2-38.7 31.9.3 62.7 12.6 86 34.4 7.9 7.4 14.7 15.6 20.4 24.4 2 3.1 5.9 4.4 9.3 3.2 17.6-6.1 36.2-10.4 55.3-12.4 5.6-.6 8.8-6.6 6.3-11.6-32.5-64.3-98.9-108.7-175.7-109.9-110.9-1.7-203.3 89.2-203.3 199.9 0 62.8 28.9 118.8 74.2 155.5-31.8 14.7-61.1 35-86.5 60.4-54.8 54.7-85.8 126.9-87.8 204a8 8 0 0 0 8 8.2h56.1c4.3 0 7.9-3.4 8-7.7 1.9-58 25.4-112.3 66.7-153.5 29.4-29.4 65.4-49.8 104.7-59.7 3.9-1 6.5-4.7 6-8.7z"></path> </g></svg>                    <p className="text-[13px] font-normal text-[#8A7A60]">Admin</p>
                            </div>
                        </Link>
                    </>
                )}

            </div>
        </div>
    )
}