import { Text } from "@radix-ui/themes";
import { motion,useReducedMotion } from "motion/react";
import React,{ useEffect,useRef } from "react";

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
  const reducedMotion = useReducedMotion();

  // Закрытие по клику вне модалки
  useEffect(() => {
    const handler = (e: Event) => {
      if (screenRef.current && !screenRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handler);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handler);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div className="pointer-events-none fixed inset-x-0 z-20 flex items-end justify-center px-3" style={{ top: "var(--top-panel-offset, 80px)", bottom: "calc(108px + max(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)), var(--tg-content-safe-area-inset-bottom, 0px)))" }}>
      <motion.div
        ref={screenRef}
        role="dialog"
        aria-label={title}
        className="lower-panel pointer-events-auto relative flex max-h-full w-full max-w-[600px] flex-col overflow-hidden rounded-[28px] p-3"
        initial={reducedMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
      >
        <div aria-hidden="true" className="mx-auto mb-2 h-1 w-9 shrink-0 rounded-full bg-[#756B5C]/20" />
        <div className="flex shrink-0 items-center justify-between gap-3 pl-1">
        <Text size="2" weight="bold" >
          {title}
        </Text>
        <button
          onClick={onClose}
          aria-label="Закрыть окно"
          className="top-glass-button w-11 text-xl leading-none"
        >
          ×
        </button>
        </div>
        {error && (
          <Text role="alert" color="red" size="1" className="block mt-2">
            {error}
          </Text>
        )}
        <div className="mt-3 flex min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain p-1">{children}</div>
      </motion.div>
    </div>
  );
}
