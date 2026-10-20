import React, { useEffect, useRef } from "react";
import { TypeModal } from "../../Modal";

type NotificationButtonProps = {
    notifRef: React.RefObject<HTMLDivElement | null>
    setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
    incoming:boolean
    showIsModal:boolean
    setTypeShowIsModal: (value: TypeModal) => void;
}

export function NotificationButton({notifRef,setTypeShowIsModal,showIsModal,setShowModal,incoming}:NotificationButtonProps){
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    // Закрываем панель уведомлений при клике вне её
    useEffect(() => {
        if (!showIsModal) return
        const handleClickOutside = (event: Event) => {
            if (notifRef.current && !notifRef.current.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) {
                setShowModal(false)
            }
        }
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setShowModal(false);
                buttonRef.current?.focus();
            }
        };
        document.addEventListener("pointerdown", handleClickOutside)
        document.addEventListener("keydown", handleEscape)
        return () => {
            document.removeEventListener("pointerdown", handleClickOutside)
            document.removeEventListener("keydown", handleEscape)
        }
    }, [showIsModal, notifRef, setShowModal])

    return(
        <>
            {/* Кнопка уведомлений (свг-иконка тут) */}
            <button ref={buttonRef} aria-label={incoming ? "Уведомления — есть новые" : "Уведомления"} aria-haspopup="dialog" aria-expanded={showIsModal} onClick={() => {setShowModal(!showIsModal);setTypeShowIsModal(TypeModal.Notification)}} className="flex justify-center relative w-11">
                <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {(incoming)  && (
                    <span aria-hidden="true" className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#E8603C] ring-2 ring-white/80" />
                )}
            </button>
        </>
        
    )
}
