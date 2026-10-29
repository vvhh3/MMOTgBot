import type { CombatStateResponse,PlayerDto } from "@mmobot/shared";
import { AnimatePresence,motion,useReducedMotion } from "motion/react";
import { useEffect,useRef,useState } from "react";
import { useLocation,useNavigate } from "react-router-dom";
import { closeTutorial,startTutorial } from "../api";

type Props = {
  token: string | null;
  player: PlayerDto | null;
  onPlayer: (player: PlayerDto) => void;
  onCombatState: (state: CombatStateResponse) => void;
};

export default function TutorialGuide({ token, player, onPlayer, onCombatState }: Props) {
  const reduced = useReducedMotion();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const panel = useRef<HTMLElement>(null);
  const step = player?.tutorialStep ?? "done";
  const inInventory = pathname.toLowerCase() === "/inventory";
  const visible = !!player?.isCreated && step !== "done" && (pathname === "/" || inInventory);
  const complete = step === "complete";
  const progress = complete ? 3 : step === "equip" ? 2 : 0;
  useEffect(() => { setError(null); }, [step]);
  useEffect(() => {
    if (complete && visible) panel.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [complete, visible, reduced]);

  const run = async (action: "start" | "skip" | "finish") => {
    if (!token || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      if (action === "start") {
        const result = await startTutorial(token);
        onCombatState(result.state);
        onPlayer(result.player);
        navigate("/TakeAWalk");
      } else {
        const result = await closeTutorial(token, action);
        onPlayer(result.player);
        if (action === "finish") navigate("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось продолжить обучение");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  const title = complete ? "Теперь ты знаешь, что делать!"
    : step === "equip" ? "Примерь первую находку"
    : step === "battle" ? "Закончим первое поручение?"
    : "Первый день в районе";
  const description = complete ? "Побеждай в прогулках, собирай вещи и усиливай персонажа. Следующее приключение выбираешь ты"
    : step === "equip" ? "Открой оружие в инвентаре и нажми «Надеть». Оно увеличит твою силу в следующем бою."
    : step === "battle" ? "Пакет ещё не побеждён. Продолжи бой или попробуй снова — дворник тебя подстрахует."
    : "Дворник: «Новенький? Мусорный пакет решил стать главным по району. Разберёшься — отдам Кирпич с дипломом».";

  return <AnimatePresence>
    {visible && <motion.section ref={panel} key="tutorial" className={`game-card tutorial-guide ${complete ? "tutorial-guide-complete" : ""}`}
      initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: reduced ? undefined : 0, marginTop: 0, marginBottom: 0 }}
      transition={{ duration: reduced ? 0 : 0.25 }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-nowrap text-orange-700">Первое приключение · {progress}/3</span>
        {!complete && <button type="button" disabled={busy || !token} onClick={() => void run("skip")} className="min-h-9 px-2 text-[10px] text-gray-500 underline text-nowrap disabled:opacity-50">Пропустить обучение</button>}
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2" aria-label={`Выполнено шагов: ${progress} из 3`}>
        {["Первый бой", "Награда", "Экипировка"].map((label, index) => <div key={label}>
          <div className="h-1.5 overflow-hidden rounded-full bg-orange-100">
            <motion.div className="h-full rounded-full bg-orange-500" initial={false} animate={{ width: progress > index ? "100%" : "0%" }} transition={{ duration: reduced ? 0 : 0.4 }} />
          </div>
          <p className="mt-1.5 text-[11px] text-gray-500">{label}</p>
        </div>)}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={{ opacity: 0, y: reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.18 }}>
          {complete && <div className="mb-3 flex items-center gap-3" aria-hidden="true">
            <motion.svg className="h-11 w-11 text-green-600" viewBox="0 0 48 48" fill="none" initial={{ scale: reduced ? 1 : 0.7 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 17 }}>
              <circle cx="24" cy="24" r="22" fill="#dcfce7" />
              <motion.path d="m14 24 7 7 14-15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : 0.5 }} />
            </motion.svg>
            <span className="text-sm font-semibold text-green-700">Первое поручение выполнено</span>
          </div>}
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600" aria-live="polite">{description}</p>
          {step === "welcome" && <p className="mt-2 text-xs text-gray-500">Короткий личный бой на Площади. Награда гарантирована.</p>}
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
          {step === "equip" && inInventory ? <p className="mt-3 text-sm font-semibold text-orange-700">Найди подсвеченное оружие ниже ↓</p>
            : <motion.button type="button" disabled={busy || !token} className="game-button mt-4 w-full"
              whileTap={reduced ? undefined : { scale: 0.98 }}
              onClick={() => step === "equip" ? navigate("/Inventory") : void run(complete ? "finish" : "start")}>
              {busy ? "Подождите…" : complete ? "В город за приключениями" : step === "equip" ? "Открыть инвентарь" : step === "battle" ? "Продолжить поручение" : "Разобраться с пакетом"}
            </motion.button>}
        </motion.div>
      </AnimatePresence>
    </motion.section>}
  </AnimatePresence>;
}
