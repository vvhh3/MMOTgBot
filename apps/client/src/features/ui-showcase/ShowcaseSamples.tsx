import LevelBadge from "../../shared/ui/LevelBadge";
import { FACTIONS, ITEM_RARITIES, RARITY_COLORS, RARITY_LABELS, type FactionId } from "@mmobot/shared";
import { Avatar, Button, Callout, Card, Checkbox, Heading, Inset, Progress, Select, Tabs, Text, TextField } from "@radix-ui/themes";
import { useRef, useState } from "react";
import ButtonAnimation from "../../shared/ui/animations/ButtonAnimation";
import EnterAnimation from "../../shared/ui/animations/EnterAnimation";
import Spinner from "../../shared/ui/spinner/Spinner";
import { MobNumberField } from "../admin/components/MobCombatEditor";
import { CasinoCellIcon } from "../casino/components/CasinoCellIcon";
import PlayingCard from "../casino/components/PlayingCard";
import FactionBadge from "../character/components/FactionBadge";
import FactionPicker from "../character/components/FactionPicker";
import BattleRoundIndicator from "../combat/components/BattleRoundIndicator";
import BattleStatusBadges from "../combat/components/BattleStatusBadges";
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
import CombatLayoutSamples from "./CombatLayoutSamples";
import CasinoLayoutSamples from "./CasinoLayoutSamples";
import TableLayoutSamples from "./TableLayoutSamples";
import Specimen from "./Specimen";
import { demoItems, demoPlayer, demoQuests, demoStatuses } from "./showcase-data";
import characterImage from "../../../../server/data/characters/skins21.svg?url";

const noop = () => undefined;
export function ButtonSamples({ notify, openModal }: SampleActions) {
  const [busy, setBusy] = useState(false);
  return <>
    <Specimen title="Основные действия" usage="Как в обучении · #E8603C">
      <div className="flex flex-wrap items-center gap-3">
        <Button className="game-button game-button--sm" size="1" onClick={() => notify("Пример: награда получена")}>Забрать награду</Button>
        <Button className="game-button" onClick={() => notify("Пример: подтверждено")}>Подтвердить</Button>
        <button type="button" className="game-button" onClick={() => openModal("lower")}>Добавить</button>
        <button type="button" className="game-button game-button--lg" onClick={() => notify("Пример: персонаж создан")}>Создать персонажа</button>
      </div>
    </Specimen>
    <Specimen title="Кнопки на разных фонах" usage="Стиль обучения · Светлый фон, тёмный фон и карта" wide>
      <div className="ui-button-surfaces">
        {[["light", "Светлый фон"], ["dark", "Тёмный фон"], ["map", "На карте"]].map(([surface, label]) => <div key={surface} className="ui-button-surface" data-background={surface}>
          <button type="button" className="game-button" onClick={() => notify("Пример: приглашение отправлено")}>Пригласить друга</button>
          <span>{label}</span>
        </div>)}
      </div>
    </Specimen>
    <Specimen title="Приглашения и отмена" usage="Общий стиль · Приглашения · Группа">
      <div className="flex flex-wrap items-center gap-3">
        <button className="game-button px-4 text-[11px]" onClick={() => notify("Пример: приглашение принято")}>Принять</button>
        <button className="game-button game-button--danger px-4 text-xs" onClick={() => notify("Пример: действие отменено")}>Отмена</button>
        <button className="game-button px-4" onClick={() => openModal("lower")}>Пригласить друга</button>
        <button className="game-button game-button--icon party-add-button" aria-label="Пригласить участника" onClick={() => openModal("lower")}>+</button>
      </div>
    </Specimen>
    <Specimen title="Закрытие окна" usage="Единый вид · Прозрачная кнопка с чёрным крестиком">
      <div className="flex items-center gap-6">
        <button aria-label="Закрыть окно" className="modal-close-button" onClick={() => openModal("lower")}>×</button>
      </div>
    </Specimen>
    <Specimen title="Принять, отклонить, использовать" usage="Друзья · Инвентарь · Обмен">
      <div className="flex flex-wrap gap-3">
        <button className="game-button" onClick={() => notify("Пример: заявка принята")}>Принять</button>
        <button className="game-button game-button--danger" onClick={() => notify("Пример: заявка отклонена")}>Отклонить</button>
        <button className="game-button" onClick={() => notify("Пример: здоровье восстановлено")}>Использовать</button>
        <Button className="game-button game-button--danger" onClick={() => notify("Пример: обмен отменён")}>Отмена</Button>
      </div>
    </Specimen>
    <Specimen title="Действия в едином стиле" usage="Магазин · Админка · Рейтинг">
      <div className="flex flex-wrap gap-3">{["Купить", "Выбрать", "Сохранить", "Создать"].map(label => <Button className="game-button" key={label} onClick={() => notify(`Пример: ${label}`)}>{label}</Button>)}<Button className="game-button game-button--danger" onClick={() => notify("Пример: удаление")}>Удалить</Button></div>
    </Specimen>
    <Specimen title="Размеры и состояния" usage="Стиль обучения · Компактная · Обычная · Крупная">
      <div className="flex flex-wrap items-center gap-3">
        <Button className="game-button game-button--sm" size="1" onClick={() => notify("Компактная кнопка")}>Маленькая</Button>
        <Button className="game-button" size="2" onClick={() => notify("Обычная кнопка")}>Обычная</Button>
        <Button className="game-button game-button--lg" size="3" onClick={() => notify("Крупная кнопка")}>Крупная</Button>
        <Button className="game-button" disabled>Недоступно</Button>
        <button disabled className="game-button game-button--offline">Не в сети</button>
        <button className="game-button game-button--online" onClick={() => notify("Пример: игрок в сети")}>В сети</button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><Button className="game-button" loading={busy} aria-busy={busy} onClick={() => setBusy(true)}>Пригласить</Button><Button className="game-button" variant="soft" color="gray" onClick={() => setBusy(!busy)}>{busy ? "Завершить загрузку" : "Показать загрузку"}</Button></div>
    </Specimen>
  </>;
}

export function CardSamples({ notify, openModal }: SampleActions) {
  const [claimed, setClaimed] = useState(false);
  const actionCards = [
    ["walk", "Прогулка", <WalkCard token={null} player={demoPlayer} locationState={null} onError={noop} onState={noop} onPlayer={noop} />],
    ["fight", "Сражение", <FightCard showIsModal={false} setShowModal={noop} setTypeShowIsModal={noop} />],
    ["fountain", "Фонтан", <MoneyCard token={null} player={demoPlayer} onPlayer={noop} setInfoMessages={noop} setShowModal={noop} setTypeShowIsModal={noop} />],
    ["shop", "Магазин", <ShopCard />], ["exchange", "Обмен", <ExchangeCard showIsModal={false} setShowModal={noop} setTypeShowIsModal={noop} />],
    ["mines", "Мины", <MinesCard />], ["blackjack", "21", <BlackjackCard />], ["ladder", "Лестница", <LadderCard />], ["group", "Особая прогулка", <SpecialWalkCard />],
  ] as const;
  return <>
    <Specimen title="Базовые карточки" usage="Общий фон, рамка и скругления как в обучении" wide>
      <div className="ui-sample-columns">{([undefined, "surface", "classic"] as const).map((variant, index) => <Card className="game-card" key={index} variant={variant}><Text as="div" weight="bold">{variant ?? "По умолчанию"}</Text><Text as="p" size="2" color="gray">Карточка с текущей обводкой и отступами.</Text></Card>)}</div>
    </Specimen>
    <Specimen title="Карточки действий" usage="Главная · Все 9 действий локаций" wide>
      <GroupEventProvider token={null} player={demoPlayer} onPlayer={noop} onInventory={noop}>
        <div className="ui-sample-action-grid">{actionCards.map(([, name, card]) => <div key={name} onClickCapture={event => { event.preventDefault(); event.stopPropagation(); notify(`Выбрано действие «${name}»`); }}><ButtonAnimation className="h-full">{card}</ButtonAnimation></div>)}</div>
      </GroupEventProvider>
    </Specimen>
    <Specimen title="Задание в процессе" usage="Задания · Лёгкое"><QuestCard quest={demoQuests[0]} claiming={false} onClaim={async () => undefined} /></Specimen>
    <Specimen title="Готовое задание и награда" usage="Задания · Среднее"><QuestCard quest={{ ...demoQuests[1], status: claimed ? "claimed" : "completed" }} claiming={false} onClaim={async () => { setClaimed(true); notify("Пример: награда получена"); }} />{claimed && <button className="mt-2 text-xs underline" onClick={() => setClaimed(false)}>Вернуть кнопку награды</button>}</Specimen>
    <Specimen title="Выполненное задание" usage="Задания · Тяжёлое"><QuestCard quest={demoQuests[2]} claiming={false} onClaim={async () => undefined} /></Specimen>
    <Specimen title="Друг и заявка" usage="Команда">
      <Card className="game-card p-2!" >
        <div className="flex items-center gap-3">
          <div className="relative"><Avatar radius="full" fallback="А" color="green" size="2" /><span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white" /></div>
          <div>
            <Text as="div" size="2" className="flex flex-wrap items-center gap-2">Артём <LevelBadge level={8} /></Text>
            <Text size="1" color="green">В сети</Text>
          </div>
        </div>
        <div className="mt-3 flex gap-2"><button className="game-button flex-1" onClick={() => notify("Пример: друг добавлен")}>Принять</button><button className="game-button game-button--danger flex-1" onClick={() => notify("Пример: заявка отклонена")}>Отклонить</button></div>
      </Card>
    </Specimen>
    <Specimen title="Карточка с изображением" usage="Профиль · Локация"><Card className="game-card"><Inset clip="padding-box" side="top" pb="current"><img src="/mapMat.png" alt="Карта города" className="h-40 w-full object-cover" /></Inset><Text as="div" weight="bold">Карта города</Text><Text as="p" size="2" color="gray">Изображение внутри карточки.</Text></Card></Specimen>
    <Specimen title="Группа и свободные места" usage="Особая прогулка" wide>
      <div className="ui-sample-party"><PartySlotsView places={[{ slot: 1, member: { name: "Артём", image: characterImage, hp: 76, maxHp: 100, pending: false, ready: true } }, { slot: 2 }]} compactMemberInfo canInvite onInvite={() => openModal("lower")} onOpenLobby={() => openModal("lower")}><img className="mx-auto h-44 max-w-full object-contain" src={characterImage} alt="Ваш персонаж" /></PartySlotsView></div>
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
    <Specimen title="Верхняя стеклянная панель" usage="Шапка приложения" wide><div className="top-bar flex items-center justify-between gap-2 rounded-full px-4 py-2"><span className="text-sm font-semibold">1 250 монет</span><div className="flex items-center gap-3"><NotificationButton incoming showIsModal={false} notifRef={notificationRef} setTypeShowIsModal={noop} setShowModal={() => openModal("top")} /><button className="text-sm font-semibold text-[#D94E2B]" onClick={() => openModal("stats")}><LevelBadge level={8} /></button><Avatar radius="full" fallback="Т" color="orange" size="2" /></div></div></Specimen>
    <Specimen title="Нижняя навигация" usage="Главная · Задания · Рейтинг · Друзья" wide><nav className="bottom-nav mx-auto flex w-full max-w-[450px] justify-around rounded-full p-1" aria-label="Пример нижнего меню">{[["Главная", "⌂"], ["Задания", "▤"], ["Рейтинг", "♜"], ["Друзья", "♧"]].map(([title, symbol]) => <button key={title} className={`bottom-nav-item relative isolate flex min-w-0 flex-1 justify-center rounded-full${active === title ? " text-[#D94E2B]" : ""}`} aria-pressed={active === title} onClick={() => { setActive(title); notify(`Раздел «${title}» выбран`); }}>{active === title && <span className="bottom-nav-glass absolute inset-x-0.5 inset-y-1 -z-10 rounded-full" />}<div className="flex h-18 w-full flex-col items-center justify-center gap-1"><span aria-hidden="true" className="text-2xl">{symbol}</span><p>{title}</p></div></button>)}</nav></Specimen>
  </>;
}

export function IndicatorSamples() {
  const counters = [
    { label: "Очки", value: "3", icon: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" /> },
    { label: "Монеты", value: "1 250", icon: <><circle cx="12" cy="12" r="9" /><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v2m0 8v2" /></> },
  ];
  return <>
    <Specimen title="Аватары и статусы сети" usage="Профиль · Друзья"><div className="flex flex-wrap items-center gap-4"><Avatar radius="full" fallback="А" color="orange" size="2" /><Avatar radius="full" fallback="М" color="green" size="3" /><Avatar radius="full" fallback="Т" color="gray" size="4" /><span className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full bg-green-500" />В сети</span><span className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full bg-gray-400" />Не в сети</span></div></Specimen>
    <Specimen title="Метки и счётчики" usage="Мягкие метки · Уровень · Очки · Статусы">
      <div className="ui-indicator-option">
        <div className="ui-indicator-row">
          <LevelBadge level={8} />
          {counters.map(({ label, value, icon }) => <span key={label} className="game-badge">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
            <span>{label}</span><strong className="ui-indicator-value">{value}</strong>
          </span>)}
        </div>
        <div className="ui-indicator-row">
          {[["ready", "Готов"], ["busy", "Занят"], ["offline", "Не в сети"]].map(([tone, label]) => <span key={tone} className="game-badge" data-tone={tone}><span className="game-badge-dot" aria-hidden="true" />{label}</span>)}
        </div>
        <div className="ui-indicator-row"><span className="ui-indicator-caption">Уведомления</span><span className="game-badge ui-indicator-count" aria-label="3 уведомления">3</span><span className="game-badge ui-indicator-count" aria-label="Больше 99 уведомлений">99+</span></div>
      </div>
    </Specimen>
    <Specimen title="Здоровье, опыт и прогресс" usage="Персонаж · Задания · Загрузка"><div className="space-y-4">{[["Здоровье · 76 / 100", 76, "green"], ["Опыт · 340 / 500", 68, "orange"], ["Задание выполнено", 100, "green"], ["Пустая шкала", 0, "orange"]].map(([label, value, color]) => <div key={label}><Text as="div" size="1" mb="1">{label}</Text><Progress value={Number(value)} color={color as "green" | "orange"} /></div>)}</div></Specimen>
    <Specimen title="Редкость предметов" usage="Все 5 уровней редкости"><div className="flex flex-col gap-2">{ITEM_RARITIES.map(rarity => <span key={rarity} className="flex items-center gap-3 text-sm font-semibold" style={{ color: RARITY_COLORS[rarity] }}><span className="h-3 w-3 rounded-full" style={{ backgroundColor: RARITY_COLORS[rarity] }} />{RARITY_LABELS[rarity]}</span>)}</div></Specimen>
    <Specimen title="Метки группировок" usage="Все 6 группировок" wide><div className="flex flex-wrap gap-3">{FACTIONS.map(faction => <FactionBadge key={faction.id} factionId={faction.id} />)}<FactionBadge factionId={null} /></div></Specimen>
    <Specimen title="Шрифты и цвета" usage="Rubik · Unbounded · Палитра приложения" wide><div className="ui-sample-columns"><div><Heading size="5">Заголовок Unbounded</Heading><Text as="p" size="3" mt="2">Основной текст Rubik</Text><Text as="p" size="1" color="gray">Подпись, пояснение и вторичный текст.</Text></div><div className="flex flex-wrap gap-3">{["#e8603c", "#e85d2f", "#594f43", "#756b5c", "#faf7f0", "#3b304f", "#ffb545"].map(color => <div key={color} className="text-center"><span className="block h-10 w-14 rounded-lg border border-black/10" style={{ backgroundColor: color }} /><span className="text-[10px]">{color}</span></div>)}</div></div></Specimen>
  </>;
}

export function InventorySamples({ notify, openModal }: SampleActions) {
  return <>
    <Specimen title="Ячейки инвентаря" usage="Пустая · С предметом · Надето · Редкость" wide><div className="grid grid-cols-5 gap-2">{ITEM_RARITIES.map((rarity, index) => <button key={rarity} aria-label={`${RARITY_LABELS[rarity]}, ${index === 1 ? "надето" : "предмет"}`} title={RARITY_LABELS[rarity]} onClick={() => notify(`Выбрано: ${RARITY_LABELS[rarity]}`)} style={{ borderColor: RARITY_COLORS[rarity] }} className={`flex aspect-square min-w-0 flex-col justify-between overflow-hidden border p-1 ${index === 1 ? "border-2 bg-orange-50" : ""}`}><div className="h-7 w-7 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: demoItems[index % 3].icon }} /><Text size="1" align="right">×{index + 1}{index === 1 ? " ✓" : ""}</Text></button>)}{Array.from({ length: 5 }, (_, index) => <button key={index} disabled aria-label="Пустая ячейка" className="aspect-square min-w-0 border border-[#898888] p-1" />)}</div></Specimen>
    <Specimen title="Описание оружия" usage="ItemDetails · Полный вариант"><Text weight="bold">{demoItems[0].name}</Text><ItemDetails item={demoItems[0]} level={3} /><button className="game-button mt-4 px-4 text-xs" onClick={() => openModal("item")}>Открыть окно предмета</button></Specimen>
    <Specimen title="Броня и расходник" usage="ItemDetails · Компактный вариант"><div className="space-y-4">{demoItems.slice(1).map(item => <div key={item.id}><Text weight="bold">{item.name}</Text><ItemDetails item={item} compact /></div>)}</div></Specimen>
    <Specimen title="Товар в магазине" usage="Карточка · Количество · Покупка"><Card className="game-card"><div className="flex items-start gap-3"><div className="h-10 w-10 shrink-0 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: demoItems[0].icon }} /><div><Text as="div" weight="bold">Ржавый нож</Text><Text as="div" size="2" color="gray">Простой нож</Text><Text as="div" size="1" color="gray">Сила оружия +18 · Цена 120 за шт.</Text><ItemDetails item={demoItems[0]} level={1} compact /></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><label className="flex items-center gap-2 text-sm">Количество<input type="number" min={1} max={99} defaultValue={1} className="w-16 rounded border px-2 py-1" /></label><Button className="game-button" color="orange" onClick={() => notify("Пример: предмет куплен")}>Купить</Button></div></Card></Specimen>
  </>;
}

export function CombatSamples({ notify, openModal }: SampleActions) {
  const effectVariants = [
    ["soft", "1 · Мягкие метки", "Иконка, название и значение на цветном фоне"],
    ["icons", "2 · Компактные иконки", "Меньше места · Название и описание по нажатию"],
    ["list", "3 · Список эффектов", "Название слева, значение справа"],
  ] as const;
  return <>
    <CombatLayoutSamples notify={notify} openModal={openModal} />
    <Specimen preserveStyle title="Боевые эффекты" usage="3 варианта · Все 15 статусов · Описание по нажатию" wide>
      <div className="ui-sample-columns ui-effect-options">
        {effectVariants.map(([variant, title, description]) => <div key={variant} className="ui-effect-option" data-variant={variant}>
          <Text as="div" size="2" weight="bold">{title}</Text>
          <Text as="p" size="1" color="gray" mt="1">{description}</Text>
          <BattleStatusBadges statuses={demoStatuses} fighterName="Тестовый герой" />
        </div>)}
      </div>
    </Specimen>
    <Specimen preserveStyle title="Раунд и последние секунды" usage="Таймер под раундом · Последние 10 секунд">
      <div className="flex flex-wrap items-start gap-8">
        <div className="text-center"><Text as="div" size="1" color="gray">Обычный таймер</Text><BattleRoundIndicator round={2} remainingSeconds={18} /></div>
        <div className="text-center"><Text as="div" size="1" color="gray">Время на исходе</Text><BattleRoundIndicator round={2} remainingSeconds={8} /></div>
      </div>
    </Specimen>
  </>;
}

export function CasinoSamples({ notify }: SampleActions) {
  const [cells, setCells] = useState<number[]>([1]);
  return <>
    <CasinoLayoutSamples notify={notify} />
    <Specimen preserveStyle title="Игральные карты" usage="Жидкое стекло · Все масти · Рубашка" wide>
      <div className="ui-casino-backdrop"><div className="game-card game-card--glass ui-casino-layout">
        <div className="ui-casino-cards ui-casino-cards--gallery">
          {(["hearts", "diamonds", "clubs", "spades"] as const).map(suit => <PlayingCard key={suit} card={{ suit, rank: suit === "spades" ? "A" : "K" }} />)}
          <PlayingCard card={null} />
        </div>
      </div></div>
    </Specimen>
    <Specimen preserveStyle title="Клетки мин" usage="Жидкое стекло · Закрыта · Безопасно · Бомба · Недоступна">
      <div className="ui-casino-backdrop"><div className="game-card game-card--glass ui-casino-layout">
        <div className="ui-casino-cell-samples">
          {Array.from({ length: 8 }, (_, index) => {
            const bomb = index === 2;
            const safe = !bomb && cells.includes(index);
            const state = bomb ? "bomb" : safe ? "safe" : "closed";
            const label = index === 7 ? "недоступна" : bomb ? "бомба" : safe ? "безопасно" : "закрыта";
            return <button key={index} type="button" className="casino-cell aspect-square ui-casino-cell" data-state={state} aria-label={`Клетка ${index + 1}: ${label}`} disabled={index === 7 || safe} onClick={() => {
              if (!bomb) setCells(current => [...current, index]);
              notify(bomb ? "Пример: бомба" : "Пример: безопасная клетка");
            }}><CasinoCellIcon state={state} /></button>;
          })}
        </div>
      </div></div>
    </Specimen>
    <Specimen preserveStyle title="Ступени лестницы" usage="Жидкое стекло · Пройдено · Текущий ряд · Бомба">
      <div className="ui-casino-backdrop"><div className="game-card game-card--glass ui-casino-layout">
        <div className="ui-casino-ladder ui-casino-ladder--gallery">
          {[0, 1, 2].map(row => <div key={row} className="ui-casino-ladder-row" data-current={row === 1 || undefined}>
            <span className="ui-casino-row-number">{row + 1}</span>
            {[0, 1, 2].map(cell => {
              const state = row === 0 && cell === 1 ? "safe" : row === 2 && cell === 2 ? "bomb" : "closed";
              const label = state === "safe" ? "безопасно" : state === "bomb" ? "бомба" : "закрыта";
              return <button key={cell} type="button" className="casino-cell aspect-square ui-casino-cell" data-state={state} aria-label={`Уровень ${row + 1}, ступень ${cell + 1}: ${label}`} disabled={row !== 1} onClick={() => notify("Пример: ступень выбрана")}>
                {state === "closed" ? "?" : <CasinoCellIcon state={state} />}
              </button>;
            })}
          </div>)}
        </div>
      </div></div>
    </Specimen>
    <Specimen preserveStyle title="Кнопки и ставка казино" usage="Жидкое стекло · Ставка · Основные действия" wide>
      <div className="ui-casino-backdrop"><div className="game-card game-card--glass ui-casino-layout">
        <div className="ui-casino-game">
          <label className="ui-casino-bet-label">Ставка в монетах<input type="number" min={1} defaultValue={50} className="game-input w-full ui-casino-input" /></label>
          <button type="button" className="game-button w-full game-button--glass ui-casino-button" onClick={() => notify("Пример: игра начата")}>Начать игру</button>
          <button type="button" className="game-button w-full game-button--glass ui-casino-button" onClick={() => notify("Пример: выигрыш получен")}>Забрать 125 монет</button>
          <button type="button" className="game-button w-full game-button--outline ui-casino-button ui-casino-button--secondary" onClick={() => notify("Пример: ход завершён")}>Хватит</button>
        </div>
      </div></div>
    </Specimen>
  </>;
}

export function FeedbackSamples({ notify }: SampleActions) {
  const [animationKey, setAnimationKey] = useState(0);
  return <>
    <Specimen title="Загрузка" usage="Spinner · Индикатор входа"><div role="status" aria-label="Загрузка"><Spinner /><p className="text-center text-sm font-bold">Подготовка входа</p><div className="mx-auto mt-3 max-w-50"><Progress value={60} color="orange" size="3" /><p className="mt-1 text-center text-orange-500">60 %</p></div></div></Specimen>
    <Specimen title="Успех, ошибка и предупреждение" usage="Магазин · Админка"><div className="space-y-3"><div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700">Куплено: Ржавый нож ×1.</div><div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">Недостаточно монет для покупки.</div><Callout.Root color="orange"><Callout.Text>Проверьте параметры перед сохранением.</Callout.Text></Callout.Root><Callout.Root color="green"><Callout.Text>Изменения сохранены.</Callout.Text></Callout.Root><Callout.Root color="red"><Callout.Text>Не удалось сохранить событие.</Callout.Text></Callout.Root></div></Specimen>
    <Specimen title="Пустые состояния" usage="Друзья · Инвентарь · Уведомления"><div className="space-y-4"><Text as="p" size="2" color="gray">Список друзей пуст. Добавить друзей можно на экране «Команда».</Text><Text as="p" size="2" color="gray">В инвентаре нет расходников.</Text><p className="notification-card rounded-[20px] p-4 text-xs text-[#756B5C]">Уведомлений пока нет</p><Text as="p" size="2" color="gray">Сегодня квестов нет</Text></div></Specimen>
    <Specimen title="Ошибка загрузки" usage="Повторная попытка входа"><div className="text-center"><p className="font-bold">Не удалось загрузить игру</p><p className="mt-2 text-sm text-red-500">Соединение прервано. Попробуйте ещё раз.</p><button className="game-button mt-4" onClick={() => notify("Пример: повторная загрузка")}>Повторить загрузку</button></div></Specimen>
    <Specimen title="Карточка обучения" usage="Текущий фон и выделение цели" wide><div className="game-card tutorial-guide"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-[#D94E2B]">Первое поручение</span><span className="text-xs text-gray-500">Шаг 1 из 3</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-orange-100"><div className="h-full w-1/3 rounded-full bg-orange-500" /></div><h3 className="mt-4 text-lg font-bold text-gray-900">Разберись с пакетом</h3><p className="mt-2 text-sm text-gray-600">Короткий личный бой на Площади. Награда гарантирована.</p><button className="game-button mt-4 w-full" onClick={() => notify("Пример: поручение начато")}>Разобраться с пакетом</button></div><Card className="game-card tutorial-target"><Text size="2">Подсвеченная цель обучения</Text></Card></Specimen>
    <Specimen title="Появление и нажатие" usage="EnterAnimation · ButtonAnimation"><Button className="game-button" variant="soft" color="orange" onClick={() => setAnimationKey(animationKey + 1)}>Повторить появление</Button><EnterAnimation key={animationKey} className="mt-4"><ButtonAnimation><Card className="game-card"><Text size="2">Наведите курсор и нажмите на карточку</Text></Card></ButtonAnimation></EnterAnimation></Specimen>
    <TableLayoutSamples />
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
  return <>{overlays.map(([id, title, usage]) => <Specimen key={id} title={title} usage={usage}><div className="modal-surface ui-sample-window" aria-hidden="true"><div><span /><span /><span /></div><i /><i /><i /></div><button className="game-button mt-4 px-4 text-xs" onClick={() => openModal(id)}>Открыть пример</button></Specimen>)}</>;
}
