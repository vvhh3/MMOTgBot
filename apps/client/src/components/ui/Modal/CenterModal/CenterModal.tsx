import React from "react";

type CenterModalProps = {
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

// Главный шаблон центрального модального окна (формат окна предмета)
export default function CenterModal({ onClose, title, children }: CenterModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
      {/* Клик по затемнению закрывает окно */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#E85D2F] text-lg leading-none text-[#E85D2F] transition-transform hover:scale-110 active:scale-95"
        >
          ×
        </button>
        <div className="max-h-[75vh] overflow-y-auto">
          {title && <p className="mb-3 pr-8 text-lg font-bold">{title}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
