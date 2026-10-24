import { motion,useAnimationControls,useReducedMotion } from "motion/react";
import { useEffect,useRef,useState,type ReactNode } from "react";

// Все значения в миллисекундах: 1000 мс = 1 секунда.
const DAMAGE_EFFECT_SETTINGS = {
  shakeMs: 460, // Длительность вздрагивания персонажа.
  flashMs: 60, // Длительность красной вспышки.
  particlesMs: 1500, // Максимальная длительность полёта брызг.
  damageNumberMs: 1700, // Сколько времени видно число урона.
};

// Пауза между отображением удара игрока и ответного удара моба.
export const MOB_COUNTERATTACK_DELAY_MS = 650;

// Удаление эффекта, разблокировка кнопок и показ результата ждут самой долгой анимации.
// Небольшой запас позволяет последнему кадру завершиться перед удалением элементов.
export const HIT_ANIMATION_MS = Math.max(...Object.values(DAMAGE_EFFECT_SETTINGS)) + 50;

type DamageEffectProps = {
  health: number;
  children: ReactNode;
};

// Заранее рассчитанные траектории распределяют брызги вокруг корпуса без пересчёта при рендере.
const droplets = Array.from({ length: 14 }, (_, index) => {
  const angle = (index / 14) * Math.PI * 2;
  const distance = 30 + ((index * 17) % 43);
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance * 0.65,
    size: 3 + (index % 4),
    rotation: (angle * 180) / Math.PI,
    color: ["#ef4444", "#dc2626", "#991b1b"][index % 3],
  };
});

export default function DamageEffect({ health, children }: DamageEffectProps) {
  const previousHealth = useRef(health);
  const sequence = useRef(0);
  const [hit, setHit] = useState<{ id: number; damage: number } | null>(null);
  const controls = useAnimationControls();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const damage = previousHealth.current - health;
    previousHealth.current = health;
    if (damage <= 0) return;

    setHit({ id: ++sequence.current, damage });
    if (!reducedMotion) {
      void controls.start({
        x: [0, -5, 4, -2, 0],
        rotate: [0, -2, 1.5, 0],
        transition: { duration: DAMAGE_EFFECT_SETTINGS.shakeMs / 1000, ease: "easeOut" },
      });
    }
  }, [health, controls, reducedMotion]);

  useEffect(() => {
    if (!hit) return;
    const timeout = window.setTimeout(() => setHit(null), HIT_ANIMATION_MS);
    return () => window.clearTimeout(timeout);
  }, [hit]);

  return (
    <div className="relative isolate flex w-full items-center justify-center">
      <motion.div className="flex w-full items-center justify-center" animate={controls}>
        {children}
      </motion.div>
      {hit && (
        <div key={hit.id} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 select-none">
          {!reducedMotion && (
            <>
              <motion.span
                className="absolute left-1/2 top-[45%] -ml-7 -mt-7 h-14 w-14 rounded-full"
                style={{ background: "radial-gradient(circle, #ef444470, #b91c1c00 70%)" }}
                initial={{ opacity: 0.9, scale: 0.4 }}
                animate={{ opacity: 0, scale: 1.8 }}
                transition={{ duration: DAMAGE_EFFECT_SETTINGS.flashMs / 1000 }}
              />
              {droplets.map((droplet, index) => (
                <motion.span
                  key={index}
                  className="absolute left-1/2 top-[45%] rounded-full"
                  style={{
                    width: droplet.size * 1.6,
                    height: droplet.size,
                    backgroundColor: droplet.color,
                    boxShadow: "0 1px 2px #450a0a50",
                  }}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 0.7, rotate: droplet.rotation }}
                  animate={{
                    x: [0, droplet.x * 0.75, droplet.x],
                    y: [0, droplet.y, droplet.y + 28],
                    opacity: [1, 1, 0],
                    scale: [0.7, 1, 0.3],
                  }}
                  transition={{ duration: (DAMAGE_EFFECT_SETTINGS.particlesMs / 1000) * (0.8 + (index % 3) * 0.1), times: [0, 0.4, 1], ease: "easeOut" }}
                />
              ))}
            </>
          )}
          <div className="absolute left-0 right-0 top-[22%] flex justify-center">
            <motion.span
              className="text-2xl font-black text-red-400"
              style={{ textShadow: "0 2px 3px #450a0a, 0 0 8px #450a0a90" }}
              initial={{ opacity: 1, y: 0, scale: reducedMotion ? 1 : 0.8 }}
              animate={{ opacity: [1, 1, 0], y: reducedMotion ? 0 : -32, scale: reducedMotion ? 1 : [0.8, 1.15, 1] }}
              transition={{ duration: DAMAGE_EFFECT_SETTINGS.damageNumberMs / 1000, times: [0, 0.25, 1], ease: "easeOut" }}
            >
              −{hit.damage}
            </motion.span>
          </div>
        </div>
      )}
    </div>
  );
}
