import { useNavigate } from "react-router-dom";
import { acceptPvp, acceptTrade, cancelPvp, cancelTrade } from "../../../api";
import { useEffect, useState, useRef } from "react"
import {  PvpStateDto, TradeStateDto } from "@mmobot/shared";
type NotificationButton = {
    notifRef: React.RefObject<HTMLDivElement | null>
    setIsShowModal: React.Dispatch<React.SetStateAction<boolean>>;
    tradeIncoiming:boolean
    pvpIncoiming:boolean
    showIsModal:boolean
}
type NotificationWindow = {
    token: string | null
    onError: (error: string) => void
    pvpState: PvpStateDto | null
    tradeState: TradeStateDto | null
    notifRef: React.RefObject<HTMLDivElement | null>
    tradeIncoiming:boolean
    pvpIncoiming:boolean
    showIsModal:boolean
}

export  function NotificationButton({notifRef,showIsModal,setIsShowModal,tradeIncoiming,pvpIncoiming}:NotificationButton){
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

    return(
        <>
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
        </>
        
    )
}
export function NotificationWindow({token,pvpState,tradeState,onError,notifRef,showIsModal,tradeIncoiming,pvpIncoiming}:NotificationWindow){
    const navigate = useNavigate()
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
    return(
        <>
            {showIsModal && (
                <div ref={notifRef} className="absolute top-0 left-2 right-2 z-[100] mt-2 rounded-2xl border bg-white p-3 shadow-2xl">
                    <p className="font-bold mb-2">Уведомления</p>

                    {pvpIncoiming && (
                        <div className="flex flex-col gap-2 border-b pb-2">
                            <div className="flex w-full">
                                <svg  height="20px" width="20px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" version="1.1" fill="none" stroke="#E85D2F" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" > <g id="SVGRepo_bgCarrier" stroke-width="0"></g> <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" ></g> <g id="SVGRepo_iconCarrier">{" "}<path d="m2.75 9.25 1.5 2.5 2 1.5m-4.5 0 1 1m1.5-2.5-1.5 1.5m3-1 8.5-8.5v-2h-2l-8.5 8.5"></path>{" "} <path d="m10.25 12.25-2.25-2.25m2-2 2.25 2.25m1-1-1.5 2.5-2 1.5m4.5 0-1 1m-1.5-2.5 1.5 1.5m-7.25-5.25-4.25-4.25v-2h2l4.25 4.25"></path>{" "}</g></svg>
                                <p className="text-sm">{pvpState?.partnerName} вызывает вас на бой!</p>
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
                            <p className="text-sm">{tradeState?.partnerName} предлагает вам обмен</p>
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
        </>
    )
}