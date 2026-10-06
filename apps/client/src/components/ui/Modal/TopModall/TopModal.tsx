import React from "react";

type TopModalProps = {
  notifRef: React.RefObject<HTMLDivElement | null>;
  isEmpty: boolean;
  children: React.ReactNode;
};

export default function TopModal({
  notifRef,
  isEmpty,
  children,
}: TopModalProps) {
  return (
    <div
      ref={notifRef}
      className="absolute top-0 left-2 right-2 z-100 mt-2 rounded-2xl border bg-white p-3 shadow-2xl"
    >
      <p className="font-bold mb-2">Уведомления</p>
      {children}
      {isEmpty && <p className="text-sm text-gray-400">Уведомлений нет</p>}
    </div>
  );
}
