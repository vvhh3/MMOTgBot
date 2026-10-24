import { useAnimate,useReducedMotion } from "motion/react";
import { useRef } from "react";

/** Fly a quest card into the completed tab without clipping it to the list. */
export function useQuestClaimAnimation() {
  const [scope, animate] = useAnimate();
  const completedTabRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();

  const flyToCompleted = async (card: HTMLElement) => {
    const target = completedTabRef.current;
    if (!target || !card.isConnected || reducedMotion) return;

    const from = card.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const copy = card.cloneNode(true) as HTMLElement;
    copy.setAttribute("aria-hidden", "true");
    copy.inert = true;
    Object.assign(copy.style, {
      position: "fixed",
      top: `${from.top}px`,
      left: `${from.left}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
      margin: "0",
      pointerEvents: "none",
      zIndex: "1000",
    });
    // Keep Radix theme variables available on the flying copy.
    scope.current?.appendChild(copy);
    const previousVisibility = card.style.visibility;
    card.style.visibility = "hidden";

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const distance = Math.hypot(dx, dy);
    const endScale = Math.min(0.12, to.width / from.width, to.height / from.height);
    // Quadratic Bézier: bend sideways from the direct path to the tab.
    const bend = Math.min(140, Math.max(70, distance * 0.55));
    const controlX = dx / 2 - (dy / (distance || 1)) * bend;
    const controlY = dy / 2 + (dx / (distance || 1)) * bend;
    const times = Array.from({ length: 33 }, (_, i) => i / 32);
    const x = times.map((t) => 2 * (1 - t) * t * controlX + t * t * dx);
    const y = times.map((t) => 2 * (1 - t) * t * controlY + t * t * dy);
    const scale = times.map((t) => 1 + (endScale - 1) * t);

    let arrived = false;
    try {
      await animate(copy, {
        x,
        y,
        scale,
        opacity: [1, 1, 0],
      }, {
        duration: 0.75,
        ease: "linear",
        times,
        opacity: { duration: 0.75, times: [0, 0.9, 1], ease: "linear" },
      });
      arrived = true;
      // Remove the flying copy before playing the tab feedback.
      copy.remove();
      void animate(target, { scale: [1, 1.08, 1], y: [0, -4, 0] }, {
        duration: 0.3,
        ease: "easeOut",
      });
    } finally {
      copy.remove();
      // On success React removes the original from the active list.
      // Revealing it here causes a flash before that render commits.
      if (!arrived) card.style.visibility = previousVisibility;
    }
  };

  return { scope, completedTabRef, flyToCompleted };
}
