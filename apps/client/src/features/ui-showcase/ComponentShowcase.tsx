import LevelBadge from "../../shared/ui/LevelBadge";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { Button, Card, Theme } from "@radix-ui/themes";
import CenterModal from "../../shared/ui/modal/CenterModal";
import LowerModal from "../../shared/ui/modal/LowerModal";
import TopModal from "../../shared/ui/modal/TopModal";
import InformationModal from "../../app/modals/InformationModal";
import SkillPointsModal from "../character/components/SkillPointsModal";
import ItemModal from "../inventory/components/ItemModal";
import { demoItems, demoPlayer } from "./showcase-data";
import FriendsLayoutSamples from "./FriendsLayoutSamples";
import LeaderboardLayoutSamples from "./LeaderboardLayoutSamples";
import {
  ButtonSamples, CardSamples, FormSamples, NavigationSamples, IndicatorSamples,
  InventorySamples, CombatSamples, CasinoSamples, FeedbackSamples, OverlaySamples,
} from "./ShowcaseSamples";
import "./showcase.css";
import "./showcase-theme.css";

export type DemoModal = "center" | "lower" | "top" | "information" | "stats" | "item";
export type SampleActions = { notify: (message: string) => void; openModal: (modal: DemoModal) => void };

function DemoOverlays({ modal, onClose, notify }: { modal: DemoModal | null; onClose: () => void; notify: (message: string) => void }) {
  const notificationRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!modal) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => overlayRef.current?.querySelector<HTMLElement>("button, input, [tabindex='0']")?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusable = Array.from(overlayRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex='0']") ?? []).filter(element => element.getClientRects().length > 0);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [modal, onClose]);
  if (!modal) return null;
  const buttons = <div className="mt-4 flex flex-wrap gap-2">
    <button className="game-button px-4 text-xs" onClick={onClose}>Пригласить</button>
    <button className="game-button game-button--danger px-4 text-xs" onClick={onClose}>Отмена</button>
  </div>;
  let content: ReactNode;
  if (modal === "center") content = <CenterModal title="Приглашение друга" onClose={onClose}>
    <p className="text-sm">Соберите компанию и отправляйтесь на особую прогулку.</p>{buttons}
  </CenterModal>;
  else if (modal === "lower") content = <LowerModal title="Выбрать игрока" error={null} onClose={onClose}>
    <p className="text-xs text-[#756B5C]">Игроки на локации</p>
    {["Артём", "Саша", "Игрок с очень длинным именем"].map((name, index) => <Card key={name} className="game-card game-card--white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm">
          <span className="min-w-0 [overflow-wrap:anywhere]">{name}</span>
          <LevelBadge level={index + 4} />
        </div>
        <Button className="game-button shrink-0 px-4 text-[11px]" onClick={onClose}>Выбрать</Button>
      </div>
    </Card>)}{buttons}
  </LowerModal>;
  else if (modal === "top") content = <>
    <div className="fixed inset-0 z-10 bg-black/20" onClick={onClose} />
    <TopModal notifRef={notificationRef} isEmpty={false}>
      <div><p className="text-xs">Артём приглашает вас на особую прогулку.</p>{buttons}</div>
      <div><p className="text-xs">Саша предлагает обменяться предметами.</p>{buttons}</div>
      <div><p className="text-xs">Тестовый герой вызывает вас на бой.</p>{buttons}</div>
    </TopModal>
    <button className="modal-close-button fixed right-4 top-4 z-30" aria-label="Закрыть уведомления" onClick={onClose}>×</button>
  </>;
  else if (modal === "information") content = <InformationModal infoMessages={{ title: "До следующего купания", info: "Осталось: 00:14:32" }} setShowModal={onClose} />;
  else if (modal === "stats") content = <SkillPointsModal showIsModal setShowModal={onClose} player={demoPlayer} token={null} onPlayer={() => undefined} />;
  else content = <ItemModal playerLevel={8} token={null} item={demoItems[0]} inventoryEntry={{ id: 1, itemType: 1, quantity: 1, acquiredAt: "2026-10-28", equiped: false, weaponLevel: 3 }} equiped={false} onItem={onClose} onPlayer={() => undefined} onInventory={() => undefined} />;
  return createPortal(<Theme className="ui-showcase-overlays" ref={overlayRef} onClickCapture={event => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    const label = button?.textContent?.trim();
    if ((modal === "stats" && label === "Подтвердить") || (modal === "item" && label === "Надеть")) {
      event.preventDefault(); event.stopPropagation(); onClose();
      notify(modal === "stats" ? "Пример: характеристики сохранены" : "Пример: предмет надет");
    }
  }}>{content}</Theme>, document.body);
}

export default function ComponentShowcase() {
  const { search } = useLocation();
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [phone, setPhone] = useState(false);
  const [surface, setSurface] = useState("light");
  const [modal, setModal] = useState<DemoModal | null>(null);
  const [notice, setNotice] = useState("");
  const closeModal = useRef(() => setModal(null)).current;
  useEffect(() => {
    const title = document.title;
    document.title = "Компоненты · MMOBot City";
    return () => { document.title = title; };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const actions: SampleActions = { notify: setNotice, openModal: setModal };
  const sections = [
    { id: "buttons", title: "Кнопки", description: "Действия и состояния в едином стиле кнопки обучения.", keywords: "награда пригласить закрыть radix disabled загрузка обучение", content: <ButtonSamples {...actions} /> },
    { id: "cards", title: "Карточки", description: "Карточки локаций, заданий и других разделов по образцу обучения.", keywords: "задания награда друзья магазин действия фонтан прогулка обучение", content: <CardSamples {...actions} /> },
    { id: "friends", title: "Друзья", description: "Три варианта вкладки: поиск по коду, список друзей и заявки.", keywords: "команда друзья поиск код добавить входящие исходящие заявки онлайн", content: <FriendsLayoutSamples {...actions} /> },
    { id: "leaderboard", title: "Рейтинг", description: "Три варианта таблицы лидеров: игроки, группировки и свой результат.", keywords: "таблица лидеры топ очки место подиум группировки участники сортировка", content: <LeaderboardLayoutSamples /> },
    { id: "forms", title: "Поля и выбор", description: "Ввод текста и чисел, списки, чекбоксы и группировки.", keywords: "формы input textarea select checkbox radio faction", content: <FormSamples /> },
    { id: "navigation", title: "Навигация", description: "Вкладки, верхняя панель и нижнее меню.", keywords: "tabs меню профиль шапка", content: <NavigationSamples {...actions} /> },
    { id: "indicators", title: "Индикаторы", description: "Метки, аватары, прогресс, редкость и группировки.", keywords: "badge avatar progress здоровье опыт цвета шрифт", content: <IndicatorSamples /> },
    { id: "inventory", title: "Предметы", description: "Ячейки инвентаря, описание и карточка товара.", keywords: "оружие броня расходники редкость магазин", content: <InventorySamples {...actions} /> },
    { id: "combat", title: "Бой", description: "Текущие боевые кнопки, выбор приёма, эффекты и журнал.", keywords: "битва раунд таймер статус атака защита", content: <CombatSamples {...actions} /> },
    { id: "casino", title: "Казино", description: "Игровые клетки и карты, панели и кнопки в общем стиле.", keywords: "мины лестница 21 blackjack выигрыш", content: <CasinoSamples {...actions} /> },
    { id: "feedback", title: "Сообщения", description: "Загрузка, ошибки, успешные действия и пустые состояния.", keywords: "spinner loader callout обучение уведомления", content: <FeedbackSamples {...actions} /> },
    { id: "overlays", title: "Окна", description: "Единый стиль окон, белые карточки и общие варианты кнопок.", keywords: "modal dialog уведомления приглашение характеристики предмет", content: <OverlaySamples {...actions} /> },
  ];
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const visibleSections = sections.filter(section => (category === "all" || category === section.id)
    && `${section.title} ${section.description} ${section.keywords}`.toLocaleLowerCase("ru").includes(normalizedQuery));

  return <div className="ui-showcase" data-viewport={phone ? "phone" : "full"} data-surface={surface}>
    <header className="ui-showcase-header">
      <div className="ui-showcase-header-inner"><Link className="ui-showcase-brand" to={{ pathname: "/", search }}><span aria-hidden="true">м</span> MMOBot City</Link>
        <Link className="ui-showcase-link" to={{ pathname: "/", search }}>Вернуться в игру <span aria-hidden="true">↗</span></Link></div>
    </header>
    <main className="ui-showcase-main">
      <section className="ui-showcase-intro" aria-labelledby="showcase-title">
        <div className="ui-showcase-eyebrow"><span /> Мастерская интерфейса <span className="ui-showcase-version">Стиль карточки обучения</span></div>
        <h1 id="showcase-title">Все детали.<br /><span>В одном месте.</span></h1>
        <p>Кнопки, карточки, окна и другие элементы нашей игры. Смотрим, сравниваем и постепенно приводим к общему стилю.</p>
        <div className="ui-showcase-intro-bottom"><span>{sections.length} разделов</span><span>Интерактивные примеры</span><span>Локальные данные</span></div>
      </section>
      <div className="ui-showcase-toolbar">
        <label className="ui-showcase-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Найти кнопки, карточки, окна…" aria-label="Поиск компонентов" /></label>
        <div className="ui-showcase-view-options">
          <div className="ui-showcase-segment" aria-label="Ширина примеров"><button aria-pressed={!phone} onClick={() => setPhone(false)}>Широкий</button><button aria-pressed={phone} onClick={() => setPhone(true)}>Телефон</button></div>
          <label className="ui-showcase-surface-label">Фон <select aria-label="Фон примеров" value={surface} onChange={event => setSurface(event.target.value)}><option value="light">Светлый</option><option value="dark">Тёмный</option><option value="map">Карта</option></select></label>
        </div>
      </div>
      <nav className="ui-showcase-categories" aria-label="Разделы компонентов">
        <button aria-pressed={category === "all"} onClick={() => setCategory("all")}>Все компоненты</button>
        {sections.map(section => <button key={section.id} aria-pressed={category === section.id} onClick={() => setCategory(section.id)}>{section.title}</button>)}
      </nav>
      <div className="ui-showcase-content">
        {visibleSections.map(section => <section className="ui-showcase-section" id={section.id} key={section.id} aria-labelledby={`${section.id}-title`}>
          <div className="ui-showcase-section-heading"><span>{String(sections.indexOf(section) + 1).padStart(2, "0")}</span><div><h2 id={`${section.id}-title`}>{section.title}</h2><p>{section.description}</p></div></div>
          <div className="ui-showcase-grid">{section.content}</div>
        </section>)}
        {!visibleSections.length && <div className="ui-showcase-empty"><h2>Ничего не нашлось</h2><p>Попробуйте другое название или покажите все компоненты.</p><button className="game-button px-4" onClick={() => { setQuery(""); setCategory("all"); }}>Сбросить фильтры</button></div>}
      </div>
      <footer className="ui-showcase-footer">MMOBot City <span>Витрина компонентов · /ui</span></footer>
    </main>
    <div className="ui-showcase-notice" role="status" aria-live="polite">{notice && <><span aria-hidden="true">✓</span>{notice}<button className="modal-close-button" aria-label="Скрыть сообщение" onClick={() => setNotice("")}>×</button></>}</div>
    <DemoOverlays modal={modal} onClose={closeModal} notify={setNotice} />
  </div>;
}
