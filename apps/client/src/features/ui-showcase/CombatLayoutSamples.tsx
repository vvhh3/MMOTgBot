import { Card } from "@radix-ui/themes";
import { useState, type ReactNode } from "react";
import BattleConsole from "../combat/components/BattleConsole";
import BattleScreen from "../combat/components/BattleScreen";
import MovePanel from "../combat/components/MovePanel";
import type { SampleActions } from "./ComponentShowcase";
import Specimen from "./Specimen";
import { demoMoves, demoStatuses } from "./showcase-data";
import characterImage from "../../../../server/data/characters/skins21.svg?url";
import "./combat-layouts.css";

const logMessages = [
  "Тестовый герой нанёс 18 урона.",
  "Противник использовал защиту.",
  "Раунд завершён. Выберите следующий приём.",
];

function LayoutFrame({ children }: { children: ReactNode }) {
  return <div className="ui-combat-layout">{children}</div>;
}

function BattlePanelMockup({ notify, openModal }: SampleActions) {
  const [stage, setStage] = useState<"actions" | "moves" | "log">("actions");
  const [selectedMove, setSelectedMove] = useState(demoMoves.moves[0]);
  const [messageIndex, setMessageIndex] = useState(0);
  const messages = [
    selectedMove.kind === "defend" ? "Тестовый герой встал в защиту." : `${selectedMove.name}: нанесено 18 урона.`,
    ...logMessages.slice(1),
  ];
  const finishLog = () => { setMessageIndex(0); setStage("actions"); };
  const controls = stage === "moves" ? <MovePanel state={demoMoves} disabled={false} onMove={id => {
    const move = demoMoves.moves.find(candidate => candidate.id === id);
    if (!move) return;
    setSelectedMove(move);
    setMessageIndex(0);
    setStage("log");
    notify(`Пример: выбран приём «${move.name}»`);
  }} onBack={() => setStage("actions")} /> : stage === "log" ? <BattleConsole
    message={{ text: messages[messageIndex] }} remainingMessages={messages.length - messageIndex}
    onNext={() => messageIndex === messages.length - 1 ? finishLog() : setMessageIndex(messageIndex + 1)}
    onSkip={finishLog}
  /> : undefined;

  return <LayoutFrame>
    <div className="ui-sample-battle">
      <BattleScreen battleId="showcase-glass" background="/mapMat.png"
        player={{ name: "Тестовый герой", hp: 76, maxHp: 100, image: characterImage, statuses: demoStatuses.filter(status => status.kind === "shield") }}
        opponent={{ name: "Дворовый хулиган", hp: 48, maxHp: 80, image: characterImage, mirrored: true }}
        round={2} remainingSeconds={18} controls={controls}
        actions={{
          attack: { label: "Выбрать приём", disabled: false, onClick: () => setStage("moves") },
          inventory: { label: "Инвентарь", disabled: false, onClick: () => openModal("item") },
          leave: { label: "Сбежать", disabled: false, onClick: () => notify("Пример: запрос выхода из боя") },
        }}
      />
    </div>
  </LayoutFrame>;
}

function MovePanelMockup({ notify }: Pick<SampleActions, "notify">) {
  const [submitted, setSubmitted] = useState(false);
  return <LayoutFrame>
    <div className="ui-combat-controls-demo">
      <Card className="game-card battle-controls-card ui-combat-standalone-card">
        <MovePanel state={{ ...demoMoves, actionSubmitted: submitted }} disabled={false} onMove={id => {
          setSubmitted(true);
          notify(`Пример: выбран приём «${demoMoves.moves.find(move => move.id === id)?.name}». «Назад» сбрасывает выбор.`);
        }} onBack={() => { setSubmitted(false); notify("Пример: вернулись к действиям"); }} />
      </Card>
    </div>
  </LayoutFrame>;
}

function BattleLogMockup() {
  const [messageIndex, setMessageIndex] = useState(0);
  return <LayoutFrame>
    <div className="ui-combat-controls-demo">
      <Card className="game-card battle-controls-card ui-combat-standalone-card">
        <BattleConsole message={{ text: logMessages[messageIndex] }} remainingMessages={logMessages.length - messageIndex}
          onNext={() => setMessageIndex((messageIndex + 1) % logMessages.length)}
          onSkip={() => setMessageIndex(logMessages.length - 1)}
        />
      </Card>
    </div>
  </LayoutFrame>;
}

export default function CombatLayoutSamples(actions: SampleActions) {
  return <>
    <Specimen preserveStyle title="Панель битвы" usage="Жидкое стекло · Действия → Приёмы → Журнал" wide>
      <BattlePanelMockup {...actions} />
    </Specimen>
    <Specimen preserveStyle title="Выбор приёма" usage="Жидкое стекло · Сетка 2×2 · «Назад» справа снизу">
      <MovePanelMockup notify={actions.notify} />
    </Specimen>
    <Specimen preserveStyle title="Журнал боя" usage="Жидкое стекло · Нажмите на журнал для продолжения">
      <BattleLogMockup />
    </Specimen>
  </>;
}
