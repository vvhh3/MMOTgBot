import React, { useEffect } from "react";
import { TypeModal } from "../../Modal";

type NotificationButtonProps = {
    notifRef: React.RefObject<HTMLDivElement | null>
    setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
    incoming:boolean
    showIsModal:boolean
    setTypeShowIsModal: (value: TypeModal) => void;
}

export function NotificationButton({notifRef,setTypeShowIsModal,showIsModal,setShowModal,incoming}:NotificationButtonProps){
    // Закрываем панель уведомлений при клике вне её
    useEffect(() => {
        if (!showIsModal) return
        const handleClickOutside = (event: Event) => {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setShowModal(false)
            }
        }
        document.addEventListener("pointerdown", handleClickOutside)
        return () => document.removeEventListener("pointerdown", handleClickOutside)
    }, [showIsModal])

    return(
        <>
            {/* Кнопка уведомлений (свг-иконка тут) */}
            <button onClick={() => {setShowModal(true),setTypeShowIsModal(TypeModal.Notification)}} className="relative">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="#8A7A60" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {(incoming)  && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
                        <div className=" bg-red-500 rounded-full"></div>
                    </span>
                )}
            </button>
        </>
        
    )
}