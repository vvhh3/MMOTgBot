import { AnimatePresence,motion,useReducedMotion } from "motion/react";
import React,{ useState } from "react";

type TopModalProps = {
  notifRef: React.RefObject<HTMLDivElement | null>;
  isEmpty: boolean;
  children: React.ReactNode;
};

export default function TopModal({ notifRef, isEmpty, children }: TopModalProps) {
  const reducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const cards = React.Children.toArray(children);
  const stacked = cards.length > 1 && !expanded;
  const spring = reducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 350, damping: 30, mass: 0.8 };

  return (
    <motion.div
      ref={notifRef}
      role="dialog"
      aria-label="Уведомления"
      className="notification-panel fixed inset-x-3 z-20 mx-auto max-w-[600px] overflow-y-auto rounded-[28px] p-3"
      style={{
        top: "var(--top-panel-offset, 80px)",
        transformOrigin: "top center",
        maxHeight: "calc(var(--tg-viewport-stable-height, 100dvh) - var(--top-panel-offset, 80px) - 108px - max(var(--tg-safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px)))",
      }}
      initial={reducedMotion ? false : { opacity: 0, y: -16, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: reducedMotion ? 0 : -12, scale: reducedMotion ? 1 : 0.96, transition: { duration: reducedMotion ? 0 : 0.18 } }}
      transition={spring}
    >
      <div className="mb-3 flex min-h-8 items-center justify-between gap-2 px-1">
        <p className="text-xs font-semibold text-[#756B5C]">Уведомления{cards.length > 0 && ` · ${cards.length}`}</p>
        {cards.length > 1 && (
          <button className="top-glass-button px-3 text-[10px]" aria-expanded={!stacked} onClick={() => setExpanded(!expanded)}>
            {stacked ? "Развернуть" : "Свернуть"}
          </button>
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {stacked ? (
          <motion.button
            key="stack"
            className="relative mb-3 block w-full pt-4 text-left"
            aria-label={`Развернуть уведомления: ${cards.length}`}
            onClick={() => setExpanded(true)}
            initial={{ opacity: 0, y: reducedMotion ? 0 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reducedMotion ? 0 : -8 }}
            transition={{ duration: reducedMotion ? 0 : 0.14 }}
          >
            {[2, 1].map((depth) => (
              <span key={depth} aria-hidden="true" className="notification-card absolute inset-x-0 top-4 h-16 rounded-[20px]" style={{ transform: `translateY(-${depth * 7}px) scale(${1 - depth * 0.045})`, opacity: 1 - depth * 0.2 }} />
            ))}
            <span className="notification-card relative flex min-h-20 items-center justify-between gap-3 rounded-[20px] p-4 text-xs text-[#756B5C]">
              <span>Новые приглашения</span>
              <span className="rounded-full bg-[#E8603C]/10 px-3 py-2 font-semibold text-[#D94E2B]">{cards.length}</span>
            </span>
          </motion.button>
        ) : (
          <motion.div key="list" initial="hidden" animate="visible" exit="hidden" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: reducedMotion ? 0 : 0.065 } } }} className="flex flex-col gap-2">
            {isEmpty ? (
              <p className="notification-card rounded-[20px] p-4 text-xs text-[#756B5C]">Уведомлений пока нет</p>
            ) : cards.map((card, index) => (
              <motion.div key={React.isValidElement(card) ? card.key ?? index : index} layout={!reducedMotion} variants={{ hidden: { opacity: 0, y: reducedMotion ? 0 : -14, scale: reducedMotion ? 1 : 0.96 }, visible: { opacity: 1, y: 0, scale: 1 } }} transition={spring} className="notification-card rounded-[20px] p-3">
                {card}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
