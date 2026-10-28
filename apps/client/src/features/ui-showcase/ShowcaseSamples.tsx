import { FACTIONS, ITEM_RARITIES, RARITY_COLORS, RARITY_LABELS, type FactionId } from "@mmobot/shared";
import { Avatar, Badge, Button, Callout, Card, Checkbox, Heading, Inset, Progress, Select, Table, Tabs, Text, TextField } from "@radix-ui/themes";
import { useRef, useState } from "react";
import ButtonAnimation from "../../shared/ui/animations/ButtonAnimation";
import EnterAnimation from "../../shared/ui/animations/EnterAnimation";
import Spinner from "../../shared/ui/spinner/Spinner";
import { MobNumberField } from "../admin/components/MobCombatEditor";
import PlayingCard from "../casino/components/PlayingCard";
import FactionBadge from "../character/components/FactionBadge";
import FactionPicker from "../character/components/FactionPicker";
import BattleConsole from "../combat/components/BattleConsole";
import BattleScreen from "../combat/components/BattleScreen";
import BattleStatusBadges from "../combat/components/BattleStatusBadges";
import MovePanel from "../combat/components/MovePanel";
import { GroupEventProvider } from "../group-events/GroupEventProvider";
import { PartySlotsView } from "../group-events/components/PartySlotsView";
import ItemDetails from "../items/components/ItemDetails";
import BlackjackCard from "../locations/components/actions/BlackjackCard";
import ExchangeCard from "../locations/components/actions/ExchangeCard";
import FightCard from "../locations/components/actions/FightCard";
import LadderCard from "../locations/components/actions/LadderCard";
import MinesCard from "../locations/components/actions/MinesCard";
import MoneyCard from "../locations/components/actions/MoneyCard";
import ShopCard from "../locations/components/actions/ShopCard";
import SpecialWalkCard from "../locations/components/actions/SpecialWalkCard";
import WalkCard from "../locations/components/actions/WalkCard";
import { NotificationButton } from "../notifications/components/NotificationButton";
import { QuestCard } from "../quests/components/Tasks";
import type { SampleActions } from "./ComponentShowcase";
import Specimen from "./Specimen";
import { demoItems, demoMoves, demoPlayer, demoQuests, demoStatuses } from "./showcase-data";
import characterImage from "../../../../server/data/characters/skins21.svg?url";

const noop = () => undefined;
const primaryButton = "flex items-center justify-center rounded-lg bg-[#E85D2F] px-4 py-2 text-white";
const rewardStyle = { borderRadius: "10px", backgroundColor: "#E8603C", fontSize: "8px", fontWeight: 800 };

export function ButtonSamples({ notify, openModal }: SampleActions) {
  const [busy, setBusy] = useState(false);
  return <>
    <Specimen title="Основные действия" usage="Задания · Подтверждение · Команда">
      <div className="flex flex-wrap items-center gap-3">
        <Button style={rewardStyle} size="1" onClick={() => notify("Пример: награда получена")}>Забрать награду</Button>
        <Button style={{ background: "#E8603C", borderRadius: "16px" }} onClick={() => notify("Пример: подтверждено")}>Подтвердить</Button>
        <button className={primaryButton} onClick={() => openModal("lower")}>Добавить</button>
        <button className="rounded-lg bg-[#E8603C] px-6 py-3 font-bold text-white" onClick={() => notify("Пример: персонаж создан")}>Создать персонажа</button>
      </div>
    </Specimen>
    <Specimen title="Стеклянные кнопки" usage="Приглашения · Отмена · Группа">
      <div className="flex flex-wrap items-center gap-3">
        <button className="top-glass-button notification-accept px-4 text-[11px]" onClick={() => notify("Пример: приглашение принято")}>Принять</button>
        <button className="top-glass-button px-4 text-xs" onClick={() => notify("Пример: действие отменено")}>Отмена</button>
        <button className="top-glass-button px-4" onClick={() => openModal("lower")}>Пригласить друга</button>
        <button className="party-add-button" aria-label="Пригласить участника" onClick={() => openModal("lower")}>+</button>
      </div>
    </Specimen>
    <Specimen title="Крестики закрытия" usage="Центральное окно · Нижняя панель">
      <div className="flex items-center gap-6">
        <button aria-label="Крестик центрального окна" className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#E85D2F] text-lg leading-none text-[#E85D2F] transition-transform hover:scale-110 active:scale-95" onClick={() => openModal("center")}>×</button>
        <button aria-label="Крестик нижней панели" className="top-glass-button w-11 text-xl leading-none" onClick={() => openModal("lower")}>×</button>
      </div>
    </Specimen>
    <Specimen title="Принять, отклонить, использовать" usage="Друзья · Инвентарь · Обмен">
      <div className="flex flex-wrap gap-3">
        <button className="flex h-9 items-center justify-center rounded-lg bg-green-600 px-4 text-white" onClick={() => notify("Пример: заявка принята")}>Принять</button>
        <button className="flex h-9 items-center justify-center rounded-lg bg-red-600 px-4 text-white" onClick={() => notify("Пример: заявка отклонена")}>Отклонить</button>
        <button className="rounded-2xl bg-green-500 p-3 text-white" onClick={() => notify("Пример: здоровье восстановлено")}>Использовать</button>
        <Button style={{ background: "#ffff", color: "#E8603C", border: "solid 2px black" }} onClick={() => notify("Пример: обмен отменён")}>Отмена</Button>
      </div>
    </Specimen>
    <Specimen title="Варианты Radix" usage="Магазин · Админка · Рейтинг">
      <div className="flex flex-wrap gap-3">{(["solid", "soft", "outline", "ghost"] as const).map(variant => <Button key={variant} variant={variant} color="orange" onClick={() => notify(`Кнопка: ${variant}`)}>{variant}</Button>)}<Button color="red" variant="soft" onClick={() => notify("Пример: удаление")}>Удалить</Button></div>
    </Specimen>
    <Specimen title="Размеры и состояния" usage="Компактная · Обычная · Крупная">
      <div className="flex flex-wrap items-center gap-3"><Button size="1" color="orange">Маленькая</Button><Button size="2" color="orange">Обычная</Button><Button size="3" color="orange">Крупная</Button><Button disabled color="orange">Недоступно</Button><button disabled className="top-glass-button px-4 opacity-50">Не в сети</button></div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><Button loading={busy} color="orange" onClick={() => setBusy(true)}>Пригласить</Button><Button variant="soft" color="gray" onClick={() => setBusy(!busy)}>{busy ? "Завершить загрузку" : "Показать загрузку"}</Button></div>
    </Specimen>
  </>;
}

export function CardSamples({ notify, openModal }: SampleActions) {
  const [claimed, setClaimed] = useState(false);
  const actionCards = [
    ["Прогулка", <WalkCard token={null} player={demoPlayer} locationState={null} onError={noop} onState={noop} onPlayer={noop} />],
    ["Сражение", <FightCard showIsModal={false} setShowModal={noop} setTypeShowIsModal={noop} />],
    ["Фонтан", <MoneyCard token={null} player={demoPlayer} onPlayer={noop} setInfoMessages={noop} setShowModal={noop} setTypeShowIsModal={noop} />],
    ["Магазин", <ShopCard />], ["Обмен", <ExchangeCard showIsModal={false} setShowModal={noop} setTypeShowIsModal={noop} />],
    ["Мины", <MinesCard />], ["21", <BlackjackCard />], ["Лестница", <LadderCard />], ["Особая прогулка", <SpecialWalkCard />],
  ] as const;
  return <>
    <Specimen title="Базовые карточки" usage="Radix Card · Surface · Classic" wide>
      <div className="ui-sample-columns">{([undefined, "surface", "classic"] as const).map((variant, index) => <Card key={index} variant={variant}><Text as="div" weight="bold">{variant ?? "По умолчанию"}</Text><Text as="p" size="2" color="gray">Карточка с текущей обводкой и отступами.</Text></Card>)}</div>
    </Specimen>
    <Specimen title="Карточки действий" usage="Главная · Все 9 действий локаций" wide>
      <GroupEventProvider token={null} player={demoPlayer} onPlayer={noop} onInventory={noop}>
        <div className="ui-sample-action-grid">{actionCards.map(([name, card]) => <div key={name} onClickCapture={event => { event.preventDefault(); event.stopPropagation(); notify(`Выбрано действие «${name}»`); }}><ButtonAnimation className="h-full">{card}</ButtonAnimation></div>)}</div>
      </GroupEventProvider>
    </Specimen>
    <Specimen title="Задание в процессе" usage="Задания · Лёгкое"><QuestCard quest={demoQuests[0]} claiming={false} onClaim={async () => undefined} /></Specimen>
    <Specimen title="Готовое задание и награда" usage="Задания · Среднее"><QuestCard quest={{ ...demoQuests[1], status: claimed ? "claimed" : "completed" }} claiming={false} onClaim={async () => { setClaimed(true); notify("Пример: награда получена"); }} />{claimed && <button className="mt-2 text-xs underline" onClick={() => setClaimed(false)}>Вернуть кнопку награды</button>}</Specimen>
    <Specimen title="Выполненное задание" usage="Задания · Тяжёлое"><QuestCard quest={demoQuests[2]} claiming={false} onClaim={async () => undefined} /></Specimen>
    <Specimen title="Друг и заявка" usage="Команда"><Card style={{ padding: "8px" }}><div className="flex items-center gap-3"><div className="relative"><Avatar radius="full" fallback="А" color="green" size="2" /><span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white" /></div><div><Text as="div" size="2">Артём <Badge color="orange">Lv 8</Badge></Text><Text size="1" color="green">В сети</Text></div></div><div className="mt-3 flex gap-2"><button className="h-9 flex-1 rounded-lg bg-green-600 text-white" onClick={() => notify("Пример: друг добавлен")}>Принять</button><button className="h-9 flex-1 rounded-lg bg-red-600 text-white" onClick={() => notify("Пример: заявка отклонена")}>Отклонить</button></div></Card></Specimen>
    <Specimen title="Карточка с изображением" usage="Профиль · Локация"><Card><Inset clip="padding-box" side="top" pb="current" style={{ borderBottom: "solid 2px" }}><img src="/mapMat.png" alt="Карта города" className="h-40 w-full object-cover" /></Inset><Text as="div" weight="bold">Карта города</Text><Text as="p" size="2" color="gray">Изображение внутри карточки.</Text></Card></Specimen>
    <Specimen title="Группа и свободные места" usage="Особая прогулка" wide>
      <div className="ui-sample-party"><PartySlotsView places={[{ slot: 1, member: { name: "Друг в группе", image: characterImage, hp: 76, maxHp: 100, pending: false, ready: true } }, { slot: 2 }]} canInvite onInvite={() => openModal("lower")} onOpenLobby={() => openModal("lower")}><img className="mx-auto h-44 max-w-full object-contain" src={characterImage} alt="Ваш персонаж" /></PartySlotsView></div>
    </Specimen>
  </>;
}

export function FormSamples() {
  const [number, setNumber] = useState(12);
  const [faction, setFaction] = useState<FactionId | null>("gamers");
  const [checked, setChecked] = useState(true);
  return <>
    <Specimen title="Текстовые поля Radix" usage="Админка · Поиск"><div className="space-y-3"><label className="block"><Text as="div" size="1" mb="1">Название</Text><TextField.Root placeholder="Введите название" /></label><TextField.Root defaultValue="Ржавый нож" aria-label="Заполненное поле" /><TextField.Root disabled placeholder="Недоступное поле" aria-label="Недоступное поле" /><TextField.Root type="search" placeholder="Имя или ID игрока" aria-label="Поиск игрока" /></div></Specimen>
    <Specimen title="Обычные поля" usage="Создание персонажа · Команда · Админка"><div className="space-y-3"><label className="block text-sm">Имя<input className="mt-1 block w-full rounded-lg border-2 px-3 py-2 outline-none focus:border-[#E8603C]" placeholder="Введите имя" /></label><label className="block text-sm">Код друга<input className="mt-1 block w-full rounded-lg border-2 border-black p-1 pr-8 outline-none focus:border-[#E85D2F]" placeholder="Введите код друга…" /></label><label className="block text-sm">Описание<textarea className="mt-1 block w-full rounded-lg border p-2" rows={3} placeholder="Описание предмета" /></label></div></Specimen>
    <Specimen title="Числа и количество" usage="MobNumberField · Магазин · Казино"><div className="space-y-4"><MobNumberField label="Здоровье" min={1} max={100} value={number} onChange={setNumber} /><label className="flex items-center gap-2 text-sm">Количество<input aria-label="Количество предметов" className="w-16 rounded border px-2 py-1" type="number" min={1} max={99} defaultValue={1} /></label><label className="block text-sm">Мин на поле<input className="mt-2 block w-full accent-[#ffb545]" type="range" min={1} max={24} defaultValue={5} /></label></div></Specimen>
    <Specimen title="Выпадающие списки" usage="Radix Select · Обычный select"><div className="space-y-4"><label className="block"><Text as="div" size="1" mb="1">Редкость</Text><Select.Root defaultValue="rare"><Select.Trigger className="w-full" aria-label="Редкость предмета" /><Select.Content>{ITEM_RARITIES.map(rarity => <Select.Item key={rarity} value={rarity}>{RARITY_LABELS[rarity]}</Select.Item>)}</Select.Content></Select.Root></label><label className="block text-sm">Противник<select defaultValue="hooligan" className="mt-1 block w-full rounded-lg border border-[#bbb] bg-white p-2"><option value="hooligan">Дворовый хулиган</option><option value="boss">Босс района</option></select></label></div></Specimen>
    <Specimen title="Чекбоксы" usage="Админка · Настройки события"><div className="flex flex-col gap-4 text-sm"><label className="flex items-center gap-2"><Checkbox checked={checked} onCheckedChange={value => setChecked(value === true)} color="orange" />Доступно в магазине</label><label className="flex items-center gap-2"><Checkbox defaultChecked="indeterminate" color="orange" />Часть параметров</label><label className="flex items-center gap-2"><Checkbox disabled />Недоступный параметр</label><label className="flex items-center gap-2"><input type="checkbox" defaultChecked />Разрешить набор в событие</label></div></Specimen>
    <Specimen title="Выбор группировки" usage="Создание персонажа"><FactionPicker value={faction} onChange={setFaction} /></Specimen>
    <Specimen title="Группировка недоступна" usage="Состояние disabled"><FactionPicker value="nefors" onChange={noop} disabled /></Specimen>
  </>;
}

export function NavigationSamples({ notify, openModal }: SampleActions) {
  const [active, setActive] = useState("Главная");
  const notificationRef = useRef<HTMLDivElement>(null);
  return <>
    <Specimen title="Вкладки" usage="Задания · Инвентарь · Магазин" wide><Tabs.Root defaultValue="active"><Tabs.List color="orange"><Tabs.Trigger value="active">Активные</Tabs.Trigger><Tabs.Trigger value="claimed">Выполненные</Tabs.Trigger><Tabs.Trigger value="disabled" disabled>Недоступно</Tabs.Trigger></Tabs.List><Tabs.Content value="active" className="pt-4"><Text size="2">Здесь отображаются активные задания.</Text></Tabs.Content><Tabs.Content value="claimed" className="pt-4"><Text size="2" color="gray">Выполненных заданий пока нет.</Text></Tabs.Content></Tabs.Root></Specimen>
    <Specimen title="Верхняя стеклянная панель" usage="Шапка приложения" wide><div className="top-bar flex items-center justify-between gap-2 rounded-full px-4 py-2"><span className="text-sm font-semibold">1 250 монет</span><div className="flex items-center gap-3"><NotificationButton incoming showIsModal={false} notifRef={notificationRef} setTypeShowIsModal={noop} setShowModal={() => openModal("top")} /><button className="text-sm font-semibold text-[#D94E2B]" onClick={() => openModal("stats")}>Lv 8</button><Avatar radius="full" fallback="Т" color="orange" size="2" /></div></div></Specimen>
    <Specimen title="Нижняя навигация" usage="Главная · Задания · Рейтинг · Друзья" wide><nav className="bottom-nav mx-auto flex w-full max-w-[450px] justify-around rounded-full p-1" aria-label="Пример нижнего меню">{[["Главная", "⌂"], ["Задания", "▤"], ["Рейтинг", "♜"], ["Друзья", "♧"]].map(([title, symbol]) => <button key={title} className={`bottom-nav-item relative isolate flex min-w-0 flex-1 justify-center rounded-full${active === title ? " text-[#D94E2B]" : ""}`} aria-pressed={active === title} onClick={() => { setActive(title); notify(`Раздел «${title}» выбран`); }}>{active === title && <span className="bottom-nav-glass absolute inset-x-0.5 inset-y-1 -z-10 rounded-full" />}<div className="flex h-18 w-full flex-col items-center justify-center gap-1"><span aria-hidden="true" className="text-2xl">{symbol}</span><p>{title}</p></div></button>)}</nav></Specimen>
  </>;
}

export function IndicatorSamples() {
  return <>
    <Specimen title="Аватары и статусы сети" usage="Профиль · Друзья"><div className="flex flex-wrap items-center gap-4"><Avatar radius="full" fallback="А" color="orange" size="2" /><Avatar radius="full" fallback="М" color="green" size="3" /><Avatar radius="full" fallback="Т" color="gray" size="4" /><span className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full bg-green-500" />В сети</span><span className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full bg-gray-400" />Не в сети</span></div></Specimen>
    <Specimen title="Метки и счётчики" usage="Уровень · Очки · Казино"><div className="flex flex-wrap items-center gap-3"><Badge color="orange">Lv 8</Badge><Badge color="orange">Очков: 3</Badge><Badge color="green">Готов</Badge><Badge color="red">Занят</Badge><Badge color="gray">Не в сети</Badge><Badge color="orange" variant="solid" size="2">Монеты: 1 250</Badge><span className="rounded-full bg-[#E8603C]/10 px-3 py-2 text-xs font-semibold text-[#D94E2B]">3</span></div></Specimen>
    <Specimen title="Здоровье, опыт и прогресс" usage="Персонаж · Задания · Загрузка"><div className="space-y-4">{[["Здоровье · 76 / 100", 76, "green"], ["Опыт · 340 / 500", 68, "orange"], ["Задание выполнено", 100, "green"], ["Пустая шкала", 0, "orange"]].map(([label, value, color]) => <div key={label}><Text as="div" size="1" mb="1">{label}</Text><Progress value={Number(value)} color={color as "green" | "orange"} /></div>)}</div></Specimen>
    <Specimen title="Редкость предметов" usage="Все 5 уровней редкости"><div className="flex flex-col gap-2">{ITEM_RARITIES.map(rarity => <span key={rarity} className="flex items-center gap-3 text-sm font-semibold" style={{ color: RARITY_COLORS[rarity] }}><span className="h-3 w-3 rounded-full" style={{ backgroundColor: RARITY_COLORS[rarity] }} />{RARITY_LABELS[rarity]}</span>)}</div></Specimen>
    <Specimen title="Метки группировок" usage="Все 6 группировок" wide><div className="flex flex-wrap gap-3">{FACTIONS.map(faction => <FactionBadge key={faction.id} factionId={faction.id} />)}<FactionBadge factionId={null} /></div></Specimen>
    <Specimen title="Шрифты и цвета" usage="Rubik · Unbounded · Палитра приложения" wide><div className="ui-sample-columns"><div><Heading size="5">Заголовок Unbounded</Heading><Text as="p" size="3" mt="2">Основной текст Rubik</Text><Text as="p" size="1" color="gray">Подпись, пояснение и вторичный текст.</Text></div><div className="flex flex-wrap gap-3">{["#e8603c", "#e85d2f", "#594f43", "#756b5c", "#faf7f0", "#3b304f", "#ffb545"].map(color => <div key={color} className="text-center"><span className="block h-10 w-14 rounded-lg border border-black/10" style={{ backgroundColor: color }} /><span className="text-[10px]">{color}</span></div>)}</div></div></Specimen>
  </>;
}

export function InventorySamples({ notify, openModal }: SampleActions) {
  return <>
    <Specimen title="Ячейки инвентаря" usage="Пустая · С предметом · Надето · Редкость" wide><div className="grid grid-cols-5 gap-2">{ITEM_RARITIES.map((rarity, index) => <button key={rarity} aria-label={`${RARITY_LABELS[rarity]}, ${index === 1 ? "надето" : "предмет"}`} title={RARITY_LABELS[rarity]} onClick={() => notify(`Выбрано: ${RARITY_LABELS[rarity]}`)} style={{ borderColor: RARITY_COLORS[rarity] }} className={`flex aspect-square min-w-0 flex-col justify-between overflow-hidden border p-1 ${index === 1 ? "border-2 bg-orange-50" : ""}`}><div className="h-7 w-7 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: demoItems[index % 3].icon }} /><Text size="1" align="right">×{index + 1}{index === 1 ? " ✓" : ""}</Text></button>)}{Array.from({ length: 5 }, (_, index) => <button key={index} disabled aria-label="Пустая ячейка" className="aspect-square min-w-0 border border-[#898888] p-1" />)}</div></Specimen>
    <Specimen title="Описание оружия" usage="ItemDetails · Полный вариант"><Text weight="bold">{demoItems[0].name}</Text><ItemDetails item={demoItems[0]} level={3} /><button className="top-glass-button mt-4 px-4 text-xs" onClick={() => openModal("item")}>Открыть окно предмета</button></Specimen>
    <Specimen title="Броня и расходник" usage="ItemDetails · Компактный вариант"><div className="space-y-4">{demoItems.slice(1).map(item => <div key={item.id}><Text weight="bold">{item.name}</Text><ItemDetails item={item} compact /></div>)}</div></Specimen>
    <Specimen title="Товар в магазине" usage="Карточка · Количество · Покупка"><Card><div className="flex items-start gap-3"><div className="h-10 w-10 shrink-0 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: demoItems[0].icon }} /><div><Text as="div" weight="bold">Ржавый нож</Text><Text as="div" size="2" color="gray">Простой нож</Text><Text as="div" size="1" color="gray">Сила оружия +18 · Цена 120 за шт.</Text><ItemDetails item={demoItems[0]} level={1} compact /></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><label className="flex items-center gap-2 text-sm">Количество<input type="number" min={1} max={99} defaultValue={1} className="w-16 rounded border px-2 py-1" /></label><Button color="orange" onClick={() => notify("Пример: предмет куплен")}>Купить</Button></div></Card></Specimen>
  </>;
}

export function CombatSamples({ notify, openModal }: SampleActions) {
  const [message, setMessage] = useState(0);
  const messages = ["Тестовый герой нанёс 18 урона.", "Противник использовал защиту.", "Раунд завершён. Выберите следующий приём."];
  const [submitted, setSubmitted] = useState(false);
  return <>
    <Specimen title="Панель битвы" usage="BattleScreen · Исходные кнопки" wide><div className="ui-sample-battle"><BattleScreen battleId="showcase" background="/mapMat.png" player={{ name: "Тестовый герой", hp: 76, maxHp: 100, image: characterImage, statuses: demoStatuses.filter(status => status.kind === "shield") }} opponent={{ name: "Дворовый хулиган", hp: 48, maxHp: 80, image: characterImage }} round={2} remainingSeconds={18} actions={{ attack: { label: "Выбрать приём", disabled: false, onClick: () => notify("Выбор приёма показан ниже") }, inventory: { label: "Инвентарь", disabled: false, onClick: () => openModal("item") }, leave: { label: "Сбежать", disabled: false, onClick: () => notify("Пример: запрос выхода из боя") } }} /></div></Specimen>
    <Specimen title="Выбор приёма" usage="MovePanel · Доступно · Перезарядка"><div className="h-40"><MovePanel state={{ ...demoMoves, actionSubmitted: submitted }} disabled={false} onMove={id => { setSubmitted(true); notify(`Пример: приём «${demoMoves.moves.find(move => move.id === id)?.name}» выбран`); }} onBack={() => { setSubmitted(false); notify("Вернулись к выбору действия"); }} /></div>{submitted && <button className="mt-3 text-xs underline" onClick={() => setSubmitted(false)}>Сбросить выбранный приём</button>}</Specimen>
    <Specimen title="Журнал боя" usage="BattleConsole · Далее · Пропустить"><Card className="h-40"><BattleConsole message={{ text: messages[message] }} remainingMessages={messages.length - message} onNext={() => setMessage((message + 1) % messages.length)} onSkip={() => setMessage(messages.length - 1)} /></Card></Specimen>
    <Specimen title="Боевые эффекты" usage="Все 15 статусов · Нажмите для описания" wide><BattleStatusBadges statuses={demoStatuses} fighterName="Тестовый герой" /></Specimen>
    <Specimen title="Раунд и последние секунды" usage="Номер раунда · Таймер"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-4xl border-3 border-[#D94E2B] bg-white"><strong className="text-[#D94E2B]">2</strong></div><span className="battle-last-seconds">18 сек.</span></div></Specimen>
  </>;
}

export function CasinoSamples({ notify }: SampleActions) {
  const [cells, setCells] = useState<number[]>([1]);
  return <>
    <Specimen title="Игральные карты" usage="PlayingCard · Все масти · Рубашка" wide><div className="ui-sample-casino flex flex-wrap gap-3">{(["hearts", "diamonds", "clubs", "spades"] as const).map(suit => <PlayingCard key={suit} card={{ suit, rank: suit === "spades" ? "A" : "K" }} />)}<PlayingCard card={null} /></div></Specimen>
    <Specimen title="Клетки мин" usage="Закрыта · Безопасно · Бомба · Недоступна"><div className="ui-sample-casino grid grid-cols-4 gap-2">{Array.from({ length: 8 }, (_, index) => { const bomb = index === 2; const safe = cells.includes(index); return <button key={index} aria-label={`Клетка ${index + 1}: ${bomb ? "бомба" : safe ? "безопасно" : "закрыта"}`} disabled={index === 7 || safe} onClick={() => { setCells([...cells, index]); notify(bomb ? "Пример: бомба" : "Пример: безопасная клетка"); }} className={`aspect-square rounded-lg border-2 text-xl font-bold ${bomb ? "border-red-500 bg-red-950/70 text-red-300" : safe ? "border-green-500 bg-green-950/70 text-green-300" : "border-[#76678e] bg-[#3b304f] text-[#ffb545] hover:border-[#ffb545] hover:bg-[#46385d] disabled:cursor-default"}`}>{bomb ? "✹" : safe ? "✓" : "✦"}</button>; })}</div></Specimen>
    <Specimen title="Ступени лестницы" usage="Пройдено · Текущий ряд · Бомба"><div className="ui-sample-casino space-y-2">{[0, 1, 2].map(row => <div key={row} className="grid grid-cols-3 gap-2">{[0, 1, 2].map(cell => <button key={cell} disabled={row !== 1} onClick={() => notify("Пример: ступень выбрана")} className={`h-10 rounded-lg border-2 font-bold ${row === 0 && cell === 1 ? "border-green-500 bg-green-950/70 text-green-300" : row === 2 && cell === 2 ? "border-red-500 bg-red-950/70 text-red-300" : "border-[#76678e] bg-[#3b304f] text-[#ffb545] hover:border-[#ffb545] disabled:cursor-default"}`}>{row === 0 && cell === 1 ? "✓" : row === 2 && cell === 2 ? "✹" : "?"}</button>)}</div>)}</div></Specimen>
    <Specimen title="Кнопки и ставка казино" usage="Жёлтая заливка · Контур · Тёмная панель" wide><div className="ui-sample-casino space-y-3"><label className="block text-sm">Ставка<input type="number" min={1} defaultValue={50} className="mt-2 h-10 w-full rounded-lg border border-[#76678e] bg-[#171126] px-3 text-lg font-medium text-[#f7f3ff] outline-none focus:border-[#ffb545]" /></label><div className="flex flex-wrap gap-3"><Button className="h-12! bg-[#ffb545]! text-base! font-bold! text-[#20162f]!" color="orange" size="3" onClick={() => notify("Пример: игра начата")}>Начать игру</Button><Button className="h-12! bg-[#ffb545]! text-base! font-bold! text-[#20162f]!" color="orange" size="3" onClick={() => notify("Пример: выигрыш получен")}>Забрать 125 монет</Button><Button className="h-12! border-[#ffb545]! text-base! font-bold! text-[#ffb545]!" color="orange" variant="outline" size="3" onClick={() => notify("Пример: ход завершён")}>Хватит</Button></div></div></Specimen>
  </>;
}

export function FeedbackSamples({ notify }: SampleActions) {
  const [animationKey, setAnimationKey] = useState(0);
  return <>
    <Specimen title="Загрузка" usage="Spinner · Индикатор входа"><div role="status" aria-label="Загрузка"><Spinner /><p className="text-center text-sm font-bold">Подготовка входа</p><div className="mx-auto mt-3 max-w-50"><Progress value={60} color="orange" size="3" /><p className="mt-1 text-center text-orange-500">60 %</p></div></div></Specimen>
    <Specimen title="Успех, ошибка и предупреждение" usage="Магазин · Админка"><div className="space-y-3"><div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700">Куплено: Ржавый нож ×1.</div><div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">Недостаточно монет для покупки.</div><Callout.Root color="orange"><Callout.Text>Проверьте параметры перед сохранением.</Callout.Text></Callout.Root><Callout.Root color="green"><Callout.Text>Изменения сохранены.</Callout.Text></Callout.Root><Callout.Root color="red"><Callout.Text>Не удалось сохранить событие.</Callout.Text></Callout.Root></div></Specimen>
    <Specimen title="Пустые состояния" usage="Друзья · Инвентарь · Уведомления"><div className="space-y-4"><Text as="p" size="2" color="gray">Список друзей пуст. Добавить друзей можно на экране «Команда».</Text><Text as="p" size="2" color="gray">В инвентаре нет расходников.</Text><p className="notification-card rounded-[20px] p-4 text-xs text-[#756B5C]">Уведомлений пока нет</p><Text as="p" size="2" color="gray">Сегодня квестов нет</Text></div></Specimen>
    <Specimen title="Ошибка загрузки" usage="Повторная попытка входа"><div className="text-center"><p className="font-bold">Не удалось загрузить игру</p><p className="mt-2 text-sm text-red-500">Соединение прервано. Попробуйте ещё раз.</p><button className="mt-4 rounded-lg bg-[#E8603C] px-5 py-2 text-white" onClick={() => notify("Пример: повторная загрузка")}>Повторить загрузку</button></div></Specimen>
    <Specimen title="Карточка обучения" usage="Текущий фон и выделение цели" wide><div className="tutorial-guide"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-[#D94E2B]">Первое поручение</span><span className="text-xs text-gray-500">Шаг 1 из 3</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-orange-100"><div className="h-full w-1/3 rounded-full bg-orange-500" /></div><h3 className="mt-4 text-lg font-bold text-gray-900">Разберись с пакетом</h3><p className="mt-2 text-sm text-gray-600">Короткий личный бой на Площади. Награда гарантирована.</p><button className="mt-4 min-h-11 w-full rounded-xl bg-[#E8603C] px-4 py-3 text-sm font-bold text-white" onClick={() => notify("Пример: поручение начато")}>Разобраться с пакетом</button></div><Card className="tutorial-target"><Text size="2">Подсвеченная цель обучения</Text></Card></Specimen>
    <Specimen title="Появление и нажатие" usage="EnterAnimation · ButtonAnimation"><Button variant="soft" color="orange" onClick={() => setAnimationKey(animationKey + 1)}>Повторить появление</Button><EnterAnimation key={animationKey} className="mt-4"><ButtonAnimation><Card><Text size="2">Наведите курсор и нажмите на карточку</Text></Card></ButtonAnimation></EnterAnimation></Specimen>
    <Specimen title="Таблица" usage="Рейтинг · Админка" wide><div className="overflow-x-auto"><Table.Root variant="surface"><Table.Header><Table.Row><Table.ColumnHeaderCell>Место</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Игрок</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Уровень</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Очки</Table.ColumnHeaderCell></Table.Row></Table.Header><Table.Body>{[["1", "Артём", "12", "480"], ["2", "Тестовый герой", "8", "125"], ["3", "Саша", "6", "80"]].map(row => <Table.Row key={row[0]}>{row.map((value, index) => <Table.Cell key={index}>{value}</Table.Cell>)}</Table.Row>)}</Table.Body></Table.Root></div></Specimen>
  </>;
}

export function OverlaySamples({ openModal }: SampleActions) {
  const overlays = [
    ["center", "Центральное окно", "CenterModal · Подтверждение и диалоги"],
    ["lower", "Нижняя панель", "LowerModal · Приглашение и выбор игрока"],
    ["top", "Стопка уведомлений", "TopModal · Раскрытие нескольких приглашений"],
    ["information", "Информационное окно", "InformationModal · Сообщения о действиях"],
    ["stats", "Характеристики", "SkillPointsModal · Кнопки + и −"],
    ["item", "Окно предмета", "ItemModal · Описание и экипировка"],
  ] as const;
  return <>{overlays.map(([id, title, usage]) => <Specimen key={id} title={title} usage={usage}><div className="ui-sample-window" aria-hidden="true"><div><span /><span /><span /></div><i /><i /><i /></div><button className="top-glass-button mt-4 px-4 text-xs" onClick={() => openModal(id)}>Открыть пример</button></Specimen>)}</>;
}
