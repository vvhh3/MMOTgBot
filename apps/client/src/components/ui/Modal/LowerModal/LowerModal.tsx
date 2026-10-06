import React, { useEffect, useRef } from "react";
import { Text } from "@radix-ui/themes";

type ModalShellProps = {
  title: string;
  error: string | null;
  onClose: () => void;
  children: React.ReactNode;
};

export default function LowerModal({
  title,
  error,
  onClose,
  children,
}: ModalShellProps) {
  const screenRef = useRef<HTMLDivElement | null>(null);

  // Закрытие по клику вне модалки
  useEffect(() => {
    const handler = (e: Event) => {
      if (screenRef.current && !screenRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40">
      <div
        ref={screenRef}
        className="relative w-full max-h-[80%] overflow-y-auto rounded-t-2xl bg-white p-4"
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 border-black text-lg leading-none"
        >
          ×
        </button>
        <Text size="3" weight="bold">
          {title}
        </Text>
        {error && (
          <Text color="red" size="1" className="block mt-2">
            {error}
          </Text>
        )}
        <div className="flex flex-col gap-2 mt-3">{children}</div>
      </div>
    </div>
  );
}