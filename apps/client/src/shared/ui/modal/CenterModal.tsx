import React from "react";
import EnterAnimation from "../animations/EnterAnimation";

type CenterModalProps = {
  onClose?: () => void;
  title?: string;
  children: React.ReactNode;
};

// Главный шаблон центрального модального окна (формат окна предмета)
export default function CenterModal({ onClose, title, children }: CenterModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
      {/* Клик по затемнению закрывает окно */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <EnterAnimation className="flex justify-center w-full">
        <div className="modal-surface modal-surface--center relative w-full max-w-sm">
        {onClose !=undefined ?
        <button
          onClick={onClose}
          aria-label="Закрыть окно"
          className="modal-close-button absolute right-3 top-3"
        >
          ×
        </button> : <></>}
        <div className="max-h-[75vh] overflow-y-auto">
          {title && <p className="modal-title mb-3 pr-8 text-lg font-bold">{title}</p>}
          {children}
        </div>
      </div>
      </EnterAnimation>


    </div>
  );
}
