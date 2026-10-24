import { Avatar, Button } from "@radix-ui/themes";
import { Header } from "@radix-ui/themes/components/table";
import Map from "./ui/Maps/Maps";
import Profile from "./Profile";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { StrictMode, useEffect, useState, useRef } from "react"
import { PlayerDto, PvpStateDto, TradeStateDto } from "@mmobot/shared";
import {NotificationButton } from "./ui/Modal/TopModall/Notification/NotificationButton.tsx";
import SkillPoints from "./ui/Modal/CenterModal/CenterModalSkillPoints.tsx";
import Modal, { TypeModal } from "./ui/Modal/Modal.tsx";
import { resetCharacter } from "../api";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

function BottomNavItem({ to, children }: { to: string; children: ReactNode }) {
    const reducedMotion = useReducedMotion();

    return (
        <NavLink
            to={to}
            end={to === "/"}
            className={({ isActive }) => `bottom-nav-item relative isolate flex min-w-0 flex-1 justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#E8603C] ${isActive ? "text-[#D94E2B]" : "text-[#756B5C]"}`}
        >
            {({ isActive }) => (
                <>
                    {isActive && (
                        <motion.div
                            layoutId="bottom-nav-active"
                            className="bottom-nav-glass pointer-events-none absolute inset-y-1 inset-x-0.5 -z-10 rounded-full"
                            initial={false}
                            transition={reducedMotion
                                ? { duration: 0 }
                                : { type: "spring", stiffness: 380, damping: 32, mass: 0.8 }}
                            aria-hidden="true"
                        />
                    )}
                    <motion.div
                        className="relative flex min-w-0 items-center justify-center"
                        animate={{ y: isActive && !reducedMotion ? -1 : 0 }}
                        whileTap={reducedMotion ? undefined : { scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    >
                        {children}
                    </motion.div>
                </>
            )}
        </NavLink>
    );
}

type LayoutProps = {
    player: PlayerDto | null
    token: string | null
    error: string | null
    onError: (error: string) => void
    onPlayer: (player: PlayerDto) => void
    pvpState: PvpStateDto | null
    tradeState: TradeStateDto | null
    showIsModal:boolean
    setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
    typeShowIsModal:TypeModal | null
    setTypeShowIsModal:(value: TypeModal | null) => void
    setTradeState:(value: TradeStateDto | null) => void;
    setPvpState:(value: PvpStateDto | null) => void;
    infoMessages:{
    title:string;
    info:string;
  }
}

export default function MainLayout({ infoMessages,player, setTypeShowIsModal,token, error,onError, onPlayer, pvpState, tradeState,showIsModal,setShowModal,typeShowIsModal,setTradeState,setPvpState }: LayoutProps) {
    const notifRef = useRef<HTMLDivElement | null>(null) // ссылка на панель уведомлений
    const topBarRef = useRef<HTMLDivElement | null>(null);
    const [topBarHeight, setTopBarHeight] = useState(62);

    useEffect(() => {
        const topBar = topBarRef.current;
        if (!topBar) return;
        const updateHeight = () => setTopBarHeight(topBar.getBoundingClientRect().height);
        updateHeight();
        const observer = new ResizeObserver(updateHeight);
        observer.observe(topBar);
        return () => observer.disconnect();
    }, []);
    const pvpIncoiming = pvpState?.status === "pending" && pvpState.direction === "incoming"
    const tradeIncoiming = tradeState?.status === "pending" && tradeState.direction === "incoming"
    useEffect(() => {
        const tg = window.Telegram?.WebApp;

        tg?.ready?.();
        tg?.expand?.();
    }, [])

    const ids = [828311361,1762717096]
    // const adminId = (import.meta.env.VITE_ADMIN_IDS ?? "").split(",").map(Number).filter(Boolean)
    const isAdmin = (import.meta.env.VITE_ADMIN_PANEL == "true" ? true :  (ids.map(Number).filter(Boolean).includes(player?.id ?? -1) ? true : false ))
    
    return (
        <div className="flex flex-col w-full overflow-hidden" style={{ height: "var(--tg-viewport-stable-height, 100dvh)", "--top-panel-offset": `calc(var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)) + var(--tg-content-safe-area-inset-top, 0px) + ${topBarHeight + 20}px)` } as React.CSSProperties}>
            <div  ref={topBarRef} className="pointer-events-none fixed inset-x-0 z-30 px-3 " style={{ top: "calc(var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)) + var(--tg-content-safe-area-inset-top, 0px) + 8px)", }}>
              <div className="top-bar  pointer-events-auto mx-auto flex w-full max-w-[600px] flex-wrap items-center justify-between gap-2 rounded-[28px] p-2">
                    <Link to="/" className="px-3 text-[13px] font-bold tracking-wide" aria-label="MMONSK — главная">
                        MMONSK
                    </Link>
                    <div className="ml-auto flex flex-row flex-wrap items-center justify-end gap-1.5">
                   
                    {import.meta.env.VITE_DEV_MODE === "true" && (
                        <button
                            className=" px-2 text-[10px] text-[#D94E2B]"
                            title="DEV: заново открыть конструктор персонажа"
                            onClick={async () => {
                                if (!token) return;
                                try {
                                    const { player: updated } = await resetCharacter(token);
                                    onPlayer(updated);
                                } catch (e) {
                                    onError(e instanceof Error ? e.message : "Ошибка сброса персонажа");
                                }
                            }}
                        >
                            Перс
                        </button>
                    )}
                    <NotificationButton incoming={pvpIncoiming || tradeIncoiming} setTypeShowIsModal={setTypeShowIsModal} setShowModal={setShowModal} showIsModal={showIsModal && typeShowIsModal === TypeModal.Notification} notifRef={notifRef} />
                    <div className="flex flex-row items-center gap-1.5">
                        <button className=" gap-1 px-3 text-[#D94E2B]" aria-label={`Уровень ${player?.level ?? 0} — очки навыков`} aria-haspopup="dialog" aria-expanded={showIsModal && typeShowIsModal === TypeModal.SkillPoints} onClick={()=>{setShowModal(true),setTypeShowIsModal(TypeModal.SkillPoints)}}>
                            <span className="text-[11px] font-semibold opacity-70 text-[#D94E2B]">Lv</span>
                            <span className="text-[13px] font-semibold text-[#D94E2B]">{player?.level ?? 0}</span>
                        </button>
                        <NavLink to="/Profile" className="  w-11" aria-label="Профиль">
                            <Avatar radius="full" fallback={player?.name?.[0] ?? "А"} color="orange" size="2" />
                        </NavLink>
                    </div>
                </div>
              </div>
              {error && <p role="alert" className="top-bar pointer-events-auto mx-auto mt-2 max-w-[600px] rounded-2xl px-3 py-2 text-xs text-red-500">{error}</p>}
            </div>
            
            <div className="relative w-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden" style={{ paddingTop: `calc(var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)) + var(--tg-content-safe-area-inset-top, 0px) + ${topBarHeight + 20}px)`, paddingBottom: "calc(108px + max(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)), var(--tg-content-safe-area-inset-bottom, 0px)))" }}>
                {/* Выпадающая панель уведомлений */}
                <Modal infoMessages={infoMessages} setPvpState={setPvpState}  setTradeState={setTradeState} typeModal={typeShowIsModal} token={token} pvpState={pvpState} tradeState={tradeState}  showIsModal={showIsModal} tradeIncoiming={tradeIncoiming} pvpIncoiming={pvpIncoiming} notifRef={notifRef}  onError={onError}  setShowModal={setShowModal} player={player}  onPlayer={onPlayer} />
                <Outlet></Outlet>
            </div>

        <LayoutGroup >
            <div className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-3" style={{ bottom: "calc(12px + max(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)), var(--tg-content-safe-area-inset-bottom, 0px)))" }}>
                <nav aria-label="Основная навигация" className="bottom-nav pointer-events-auto flex w-full max-w-[450px] shrink-0 flex-row justify-around rounded-full p-1" >
                    <BottomNavItem to="/">
                        <div className=" flex flex-col justify-center items-center h-20 w-16.25">
                            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"><path fillRule="evenodd" clipRule="evenodd" d="M21.4498 10.275L11.9998 3.1875L2.5498 10.275L2.9998 11.625H3.7498V20.25H20.2498V11.625H20.9998L21.4498 10.275ZM5.2498 18.75V10.125L11.9998 5.0625L18.7498 10.125V18.75H14.9999V14.3333L14.2499 13.5833H9.74988L8.99988 14.3333V18.75H5.2498ZM10.4999 18.75H13.4999V15.0833H10.4999V18.75Z" fill="currentColor"></path></g></svg>                        <p className="text-[13px] font-normal">Главная</p>
                        </div>
                    </BottomNavItem>
                    <BottomNavItem to="/Tasks">
                        <div className=" flex flex-col justify-center items-center h-20 w-16.25">
                            <svg className="h-7.5 w-7.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M12 10.4V20M12 10.4C12 8.15979 12 7.03969 11.564 6.18404C11.1805 5.43139 10.5686 4.81947 9.81596 4.43597C8.96031 4 7.84021 4 5.6 4H4.6C4.03995 4 3.75992 4 3.54601 4.10899C3.35785 4.20487 3.20487 4.35785 3.10899 4.54601C3 4.75992 3 5.03995 3 5.6V16.4C3 16.9601 3 17.2401 3.10899 17.454C3.20487 17.6422 3.35785 17.7951 3.54601 17.891C3.75992 18 4.03995 18 4.6 18H7.54668C8.08687 18 8.35696 18 8.61814 18.0466C8.84995 18.0879 9.0761 18.1563 9.29191 18.2506C9.53504 18.3567 9.75977 18.5065 10.2092 18.8062L12 20M12 10.4C12 8.15979 12 7.03969 12.436 6.18404C12.8195 5.43139 13.4314 4.81947 14.184 4.43597C15.0397 4 16.1598 4 18.4 4H19.4C19.9601 4 20.2401 4 20.454 4.10899C20.6422 4.20487 20.7951 4.35785 20.891 4.54601C21 4.75992 21 5.03995 21 5.6V16.4C21 16.9601 21 17.2401 20.891 17.454C20.7951 17.6422 20.6422 17.7951 20.454 17.891C20.2401 18 19.9601 18 19.4 18H16.4533C15.9131 18 15.643 18 15.3819 18.0466C15.15 18.0879 14.9239 18.1563 14.7081 18.2506C14.465 18.3567 14.2402 18.5065 13.7908 18.8062L12 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></g></svg>
                            <p className="text-[13px] font-normal">Задания</p>
                        </div>
                    </BottomNavItem>
                    <BottomNavItem to="/Leaderboard">
                        <div className="flex h-20 w-16.25 flex-col items-center justify-center">
                            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
                                <path d="M7 6H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4" />
                            </svg>
                            <p className="text-[13px] font-normal">Рейтинг</p>
                        </div>
                    </BottomNavItem>
                    <BottomNavItem to="/Team">
                        <div className=" flex flex-col justify-center items-center h-20 w-16.25">
                            <svg className="h-7.5 w-7.5" fill="currentColor" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" stroke="currentColor"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M824.2 699.9a301.55 301.55 0 0 0-86.4-60.4C783.1 602.8 812 546.8 812 484c0-110.8-92.4-201.7-203.2-200-109.1 1.7-197 90.6-197 200 0 62.8 29 118.8 74.2 155.5a300.95 300.95 0 0 0-86.4 60.4C345 754.6 314 826.8 312 903.8a8 8 0 0 0 8 8.2h56c4.3 0 7.9-3.4 8-7.7 1.9-58 25.4-112.3 66.7-153.5A226.62 226.62 0 0 1 612 684c60.9 0 118.2 23.7 161.3 66.8C814.5 792 838 846.3 840 904.3c.1 4.3 3.7 7.7 8 7.7h56a8 8 0 0 0 8-8.2c-2-77-33-149.2-87.8-203.9zM612 612c-34.2 0-66.4-13.3-90.5-37.5a126.86 126.86 0 0 1-37.5-91.8c.3-32.8 13.4-64.5 36.3-88 24-24.6 56.1-38.3 90.4-38.7 33.9-.3 66.8 12.9 91 36.6 24.8 24.3 38.4 56.8 38.4 91.4 0 34.2-13.3 66.3-37.5 90.5A127.3 127.3 0 0 1 612 612zM361.5 510.4c-.9-8.7-1.4-17.5-1.4-26.4 0-15.9 1.5-31.4 4.3-46.5.7-3.6-1.2-7.3-4.5-8.8-13.6-6.1-26.1-14.5-36.9-25.1a127.54 127.54 0 0 1-38.7-95.4c.9-32.1 13.8-62.6 36.3-85.6 24.7-25.3 57.9-39.1 93.2-38.7 31.9.3 62.7 12.6 86 34.4 7.9 7.4 14.7 15.6 20.4 24.4 2 3.1 5.9 4.4 9.3 3.2 17.6-6.1 36.2-10.4 55.3-12.4 5.6-.6 8.8-6.6 6.3-11.6-32.5-64.3-98.9-108.7-175.7-109.9-110.9-1.7-203.3 89.2-203.3 199.9 0 62.8 28.9 118.8 74.2 155.5-31.8 14.7-61.1 35-86.5 60.4-54.8 54.7-85.8 126.9-87.8 204a8 8 0 0 0 8 8.2h56.1c4.3 0 7.9-3.4 8-7.7 1.9-58 25.4-112.3 66.7-153.5 29.4-29.4 65.4-49.8 104.7-59.7 3.9-1 6.5-4.7 6-8.7z"></path></g></svg> <p className="text-[13px] font-normal">Друзья</p>
                        </div>
                    </BottomNavItem>

                    {isAdmin && (
                        <>
                            <BottomNavItem to="/AdminPanel">
                                <div className=" flex flex-col justify-center items-center h-20 w-16.25">
                                    <svg className="h-7.5 w-7.5" fill="currentColor" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" stroke="currentColor"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M824.2 699.9a301.55 301.55 0 0 0-86.4-60.4C783.1 602.8 812 546.8 812 484c0-110.8-92.4-201.7-203.2-200-109.1 1.7-197 90.6-197 200 0 62.8 29 118.8 74.2 155.5a300.95 300.95 0 0 0-86.4 60.4C345 754.6 314 826.8 312 903.8a8 8 0 0 0 8 8.2h56c4.3 0 7.9-3.4 8-7.7 1.9-58 25.4-112.3 66.7-153.5A226.62 226.62 0 0 1 612 684c60.9 0 118.2 23.7 161.3 66.8C814.5 792 838 846.3 840 904.3c.1 4.3 3.7 7.7 8 7.7h56a8 8 0 0 0 8-8.2c-2-77-33-149.2-87.8-203.9zM612 612c-34.2 0-66.4-13.3-90.5-37.5a126.86 126.86 0 0 1-37.5-91.8c.3-32.8 13.4-64.5 36.3-88 24-24.6 56.1-38.3 90.4-38.7 33.9-.3 66.8 12.9 91 36.6 24.8 24.3 38.4 56.8 38.4 91.4 0 34.2-13.3 66.3-37.5 90.5A127.3 127.3 0 0 1 612 612zM361.5 510.4c-.9-8.7-1.4-17.5-1.4-26.4 0-15.9 1.5-31.4 4.3-46.5.7-3.6-1.2-7.3-4.5-8.8-13.6-6.1-26.1-14.5-36.9-25.1a127.54 127.54 0 0 1-38.7-95.4c.9-32.1 13.8-62.6 36.3-85.6 24.7-25.3 57.9-39.1 93.2-38.7 31.9.3 62.7 12.6 86 34.4 7.9 7.4 14.7 15.6 20.4 24.4 2 3.1 5.9 4.4 9.3 3.2 17.6-6.1 36.2-10.4 55.3-12.4 5.6-.6 8.8-6.6 6.3-11.6-32.5-64.3-98.9-108.7-175.7-109.9-110.9-1.7-203.3 89.2-203.3 199.9 0 62.8 28.9 118.8 74.2 155.5-31.8 14.7-61.1 35-86.5 60.4-54.8 54.7-85.8 126.9-87.8 204a8 8 0 0 0 8 8.2h56.1c4.3 0 7.9-3.4 8-7.7 1.9-58 25.4-112.3 66.7-153.5 29.4-29.4 65.4-49.8 104.7-59.7 3.9-1 6.5-4.7 6-8.7z"></path></g></svg> <p className="text-[13px] font-normal">Admin</p>
                                </div>
                            </BottomNavItem>
                        </>
                    )}

                </nav>
            </div>
        </LayoutGroup>
    </div>
    )
}
