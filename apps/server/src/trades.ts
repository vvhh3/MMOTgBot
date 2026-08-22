// ============================================================================
// ОБМЕН ПРЕДМЕТАМИ МЕЖДУ ИГРОКАМИ
// ============================================================================
//
// Флоу обмена (как в Steam):
//
//   1. POST   /trades            — игрок A кидает приглашение игроку B
//   2. POST   /trades/:id/accept — B принимает → открывается "окно трейда"
//   3. PUT    /trades/:id/offer  — каждый выставляет СВОИ предметы на стол
//   4. POST   /trades/:id/ready  — оба жмут "Готово" → обмен исполняется
//   *  DELETE /trades/:id        — отменить/отклонить на любом шаге
//
// Ключевые принципы безопасности:
//
//   - Игроки НЕ видят инвентарь друг друга. Клиент получает только
//     partnerOffer — то, что партнёр уже выложил на стол.
//   - Один активный трейд на игрока (hasActiveTrade). Нельзя выставить
//     одни и те же предметы в двух сделках одновременно.
//   - Изменение выкладки сбрасывает ОБЕ галочки ready. Нельзя подменить
//     предмет после того, как партнёр подтвердил обмен.
//   - Предметы списываются ТОЛЬКО в момент исполнения (шаг 4), в одной
//     транзакции: либо оба получили своё, либо ничего не изменилось.
//   - Зависшие трейды чистит maintenance.ts (cleanupStaleTrades).
//
// Статусы трейда:
//   pending   — приглашение отправлено, ждёт ответа
//   open      — окно трейда открыто, игроки выставляют предметы
//   accepted  — обмен успешно исполнен
//   declined  — получатель отклонил приглашение
//   cancelled — кто-то отменил / протухло по таймауту

import type {AuthedRequest } from "./auth.js";
import { db } from "./db.js";
import { inventoryItems, players, trades } from "./db/schema.js";
import type { TradeRow } from "./db/schema.js";
import { nowGameTime } from "./time.js";
import { emitToPlayer } from "./realTime.js";
import { TradeItem, TradesOverviewResponse, TradeStateDto } from "@mmobot/shared";
import type { Request,Response,Express } from "express";
import { eq, sql, and,or} from "drizzle-orm";
import { notify } from "./notification.js";

// ===================== ХЕЛПЕРЫ =====================

// Определяет, чью сторону в трейде занимает игрок.
// "from" — тот, кто кинул приглашение; "to" — тот, кто его получил.
// null — игрок вообще не участник этого трейда (чужой трейд, доступ запрещён).
function myRole(trade: TradeRow, playerId: number): "from" | "to" | null {
  if (trade.fromPlayerId === playerId) return "from";
  if (trade.toPlayerId === playerId) return "to";
  return null;
}

// Собирает состояние окна трейда С ТОЧКИ ЗРЕНИЯ КОНКРЕТНОГО игрока.
//
// В БД выкладки хранятся как fromOffer/toOffer (по сторонам сделки),
// но игроку удобнее думать "моё / его". Здесь мы переворачиваем данные:
//   - для роли "from": myOffer = fromOffer, partnerOffer = toOffer
//   - для роли "to":   myOffer = toOffer,   partnerOffer = fromOffer
// Инвентарь партнёра НЕ отдаётся никогда — только его выкладка на столе.
function buildTradeState(trade: TradeRow, playerId: number): TradeStateDto | null {
  const role = myRole(trade, playerId);
  if (!role) return null;

  // имя партнёра — для заголовка окна ("Обмен с Иван")
  const partnerId = role === "from" ? trade.toPlayerId : trade.fromPlayerId;
  const partner = db.select({ name: players.name }).from(players).where(eq(players.id, partnerId)).get();

  return {
    id: trade.id,
    status: trade.status,
    myOffer: role === "from" ? trade.fromOffer : trade.toOffer,
    partnerOffer: role === "from" ? trade.toOffer : trade.fromOffer,
    iAmReady: role === "from" ? trade.fromReady : trade.toReady,
    partnerIsReady: role === "from" ? trade.toReady : trade.fromReady,
    partnerName: partner?.name ?? "?"
  }
}

// Отправляет обоим участникам свежее состояние их окна через сокет
// Вызывается после КАЖДОГО изменения трейда, чтобы клиенту не нужен был поллинг
// Каждый получит свою версию DTO (со своей стороны сделки)
function notifyBoth(trade: TradeRow): void {
  emitToPlayer(trade.fromPlayerId, "tradeUpdate", buildTradeState(trade, trade.fromPlayerId));
  emitToPlayer(trade.toPlayerId, "tradeUpdate", buildTradeState(trade, trade.toPlayerId));
}

// Проверяет формат выкладки из запроса: массив объектов {itemType, quantity},
// где оба поля — целые числа, а количество строго больше нуля.
// Защита от NaN, строк, отрицательных чисел и дублей-мусора из JSON.
function isValidOffer(offer: unknown): offer is TradeItem[] {
  if (!Array.isArray(offer)) return false;
  return offer.every((e) =>
    Number.isInteger(e?.itemType) && Number.isInteger(e?.quantity) && e.quantity > 0
  );
}

// Списывает предметы у игрока. Вызывается ТОЛЬКО внутри транзакции (tx),
// поэтому при ошибке всё исполнение откатывается целиком.
//
// Если какого-то предмета не хватает — бросаем ошибку. Транзакция откатится,
// а роут /ready поймает её и вернёт игрокам понятное сообщение.
function withdrawItems(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  playerId: number,
  entries: TradeItem[]
): void {
  for (const entry of entries) {
    // ищем стек предмета в инвентаре (у игрока максимум один стек на тип предмета)
    const row = tx.select().from(inventoryItems)
      .where(and(eq(inventoryItems.playerId, playerId), eq(inventoryItems.itemType, entry.itemType)))
      .get();

    // предмета нет или количества не хватает — обмен невозможен
    if (!row || row.quantity < entry.quantity) {
      throw new Error("Недостаточно предметов для обмена");
    }

    if (row.quantity - entry.quantity <= 0) {
      // стек исчерпан — удаляем запись целиком
      tx.delete(inventoryItems).where(eq(inventoryItems.id, row.id)).run();
    } else {
      // просто уменьшаем количество
      tx.update(inventoryItems)
        .set({ quantity: sql`${inventoryItems.quantity} - ${entry.quantity}` })
        .where(eq(inventoryItems.id, row.id))
        .run();
    }
  }
}

// Кладёт предметы игроку. Тоже только внутри транзакции.
// Работает как лут с мобов: если такой предмет уже есть — растёт quantity,
// если нет — создаётся новый стек.
function depositItems(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  playerId: number,
  entries: TradeItem[],
  at: string
): void {
  for (const entry of entries) {
    tx.insert(inventoryItems)
      .values({ playerId, itemType: entry.itemType, quantity: entry.quantity, acquiredAt: at })
      .onConflictDoUpdate({
        target: [inventoryItems.playerId, inventoryItems.itemType],
        set: { quantity: sql`${inventoryItems.quantity} + ${entry.quantity}`, acquiredAt: at }
      })
      .run();
  }
}

// Есть ли у игрока незавершённый трейд (приглашение ИЛИ открытое окно).
// Используется как защита: один игрок может участвовать только в одной
// сделке одновременно — иначе можно было бы выставить одни и те же
// предметы в два разных трейда и "размножить" инвентарь.
//
// excludeTradeId — трейд, который НЕ учитываем в проверке.
// Нужен в accept: само принимаемое приглашение формально "активный трейд"
// его получателя, и без исключения оно бы заблокировало собственное принятие.
function hasActiveTrade(playerId: number, excludeTradeId?: number): boolean {
  const rows = db.select().from(trades)
    .where(and(
      or(eq(trades.fromPlayerId, playerId), eq(trades.toPlayerId, playerId)),
      or(eq(trades.status, "pending"), eq(trades.status, "open"))
    ))
    .all();
  return rows.some((t) => t.id !== excludeTradeId);
}

// ===================== РОУТЫ =====================

export const createTradeRoutes = (app: Express) => {

  // --- СПИСОК: мои приглашения + активный трейд ---
  app.get("/trades", (req: Request, res: Response) => {
    const player = (req as AuthedRequest).player;

    const rows = db.select().from(trades)
      .where(and(
        or(eq(trades.fromPlayerId, player.id), eq(trades.toPlayerId, player.id)),
        or(eq(trades.status, "pending"), eq(trades.status, "open"))
      ))
      .all();

    // активный трейд может быть максимум один
    const activeRow = rows.find((t) => t.status === "open");

    const response: TradesOverviewResponse = {
      invites: rows
        .filter((t) => t.status === "pending")
        .map((t) => {
          const partnerId = t.fromPlayerId === player.id ? t.toPlayerId : t.fromPlayerId;
          const partner = db.select({ name: players.name }).from(players).where(eq(players.id, partnerId)).get();
          return {
            id: t.id,
            partnerName: partner?.name ?? "?",
            // в списке приглашений статус всегда "pending" (мы их отфильтровали выше)
            status: "pending" as const,
            direction: t.toPlayerId === player.id ? ("incoming" as const) : ("outgoing" as const)
          };
        }),
      active: activeRow ? buildTradeState(activeRow, player.id) : null
    };
    res.json(response);
  });

  // --- ШАГ 1: кинуть приглашение на обмен ---
  app.post("/trades", (req: Request, res: Response) => {
    const player = (req as AuthedRequest).player;
    const toPlayerId = Number(req.body?.toPlayerId);

    if (!Number.isInteger(toPlayerId)) {
      res.status(400).json({ error: "toPlayerId must be an integer" });
      return;
    }
    if (toPlayerId === player.id) {
      res.status(400).json({ error: "Нельзя обменяться с самим собой" })
      return
    }

    const target = db.select().from(players).where(eq(players.id, toPlayerId)).get();
    if (!target) {
      res.status(404).json({ error: "Игрок не найден" })
      return
    }

    // и у меня, и у него не должно быть активного трейда
    if (hasActiveTrade(player.id) || hasActiveTrade(toPlayerId)) {
      res.status(409).json({ error: "Один из игроков уже участвует в обмене" });
      return;
    }

    const result = db.insert(trades).values({
      fromPlayerId: player.id,
      toPlayerId,
      status: "pending",
      createdAt: nowGameTime()
    }).run();

    notifyBoth(db.select().from(trades).where(eq(trades.id, Number(result.lastInsertRowid))).get()!);
    notify(toPlayerId, `${player.name} предлагает вам обмен`)

    res.status(201).json({ ok: true });
  });

  // --- ШАГ 2: принять приглашение → окно трейда открыто ---
  app.post("/trades/:id/accept", (req: Request, res: Response) => {
    const player = (req as AuthedRequest).player;

    // принять может ТОЛЬКО получатель приглашения и только пока оно pending
    const trade = db.select().from(trades).where(eq(trades.id, Number(req.params.id))).get();
    if (!trade || trade.toPlayerId !== player.id || trade.status !== "pending") {
      res.status(404).json({ error: "Приглашение не найдено" });
      return;
    }

    // нельзя открыть окно, если уже участвуешь в другой сделке
    // (само это приглашение исключаем — иначе оно бы само себя заблокировало)
    if (hasActiveTrade(player.id, trade.id)) {
      res.status(409).json({ error: "Вы уже участвуете в другом обмене" });
      return;
    }

    db.update(trades).set({ status: "open" }).where(eq(trades.id, trade.id)).run();
    notifyBoth({ ...trade, status: "open" });
    res.json({ ok: true });
  });

  // --- Отклонить приглашение или отменить открытый трейд (любой участник) ---
  // Предметы при этом НЕ трогаем: при таком флоу они ещё не списаны —
  // списание происходит только в момент исполнения (шаг 4).
  app.delete("/trades/:id", (req: Request, res: Response) => {
    const player = (req as AuthedRequest).player;

    const trade = db.select().from(trades).where(eq(trades.id, Number(req.params.id))).get();
    if (!trade || !myRole(trade, player.id)) {
      res.status(404).json({ error: "Обмен не найден" });
      return;
    }
    if (trade.status !== "pending" && trade.status !== "open") {
      res.status(409).json({ error: "Обмен уже завершён" });
      return;
    }

    // declined если отказался получатель приглашения, иначе cancelled
    const newStatus = trade.status === "pending" && trade.toPlayerId === player.id ? "declined" : "cancelled";
    db.update(trades).set({ status: newStatus }).where(eq(trades.id, trade.id)).run();
    notifyBoth({ ...trade, status: newStatus });
    res.json({ ok: true });
  });

  // --- ШАГ 3: выставить свои предметы (в окне трейда) ---
  app.put("/trades/:id/offer", (req: Request, res: Response) => {
    const player = (req as AuthedRequest).player;
    // клиент присылает ПОЛНУЮ выкладку целиком — она заменяет старую
    const offer = req.body?.items;

    const trade = db.select().from(trades).where(eq(trades.id, Number(req.params.id))).get();
    if (!trade || myRole(trade, player.id) === null) {
      res.status(404).json({ error: "Обмен не найден" });
      return;
    }
    if (trade.status !== "open") {
      res.status(409).json({ error: "Обмен уже не в стадии настройки" });
      return;
    }
    if (!isValidOffer(offer)) {
      res.status(400).json({ error: "items должен быть массивом {itemType, quantity}" });
      return;
    }

    // Обновляем выкладку нужной стороны и сбрасываем ОБЕ галочки "готов".
    // Это ключевая защита от подмены: партнёр подтвердил ОДНУ выкладку,
    // а мы не можем тихо заменить её на другую после его подтверждения.
    const updated: TradeRow = myRole(trade, player.id) === "from"
      ? { ...trade, fromOffer: offer, fromReady: false, toReady: false }
      : { ...trade, toOffer: offer, fromReady: false, toReady: false };

    db.update(trades)
      .set({ fromOffer: updated.fromOffer, toOffer: updated.toOffer, fromReady: false, toReady: false })
      .where(eq(trades.id, trade.id))
      .run();

    notifyBoth(updated);
    res.json({ ok: true });
  });

  // --- ШАГ 4: нажать "Готово". Если готовы оба — обмен исполняется ---
  app.post("/trades/:id/ready", (req: Request, res: Response) => {
    const player = (req as AuthedRequest).player;

    const trade = db.select().from(trades).where(eq(trades.id, Number(req.params.id))).get();
    const role = trade ? myRole(trade, player.id) : null;
    if (!trade || !role) {
      res.status(404).json({ error: "Обмен не найден" });
      return;
    }
    if (trade.status !== "open") {
      res.status(409).json({ error: "Обмен уже завершён" });
      return;
    }

    // ставим свою галочку (пока только в локальной копии)
    let updated: TradeRow = role === "from"
      ? { ...trade, fromReady: true }
      : { ...trade, toReady: true };

    // Оба готовы? Пробуем исполнить обмен
    // Всё в ОДНОЙ транзакции: списание у обоих + выдача обоим
    // Если у кого-то предметы пропали (потратил/удалились пока трейд висел) —
    // транзакция откатится целиком и НИЧЕГО не изменится
    if (updated.fromReady && updated.toReady) {
      try {
        db.transaction((tx) => {
          // списываем предметы у обоих (бросит ошибку, если у кого-то не хватает)
          withdrawItems(tx, trade.fromPlayerId, trade.fromOffer);
          withdrawItems(tx, trade.toPlayerId, trade.toOffer);

          // меняемся местами
          depositItems(tx, trade.toPlayerId, trade.fromOffer, nowGameTime());
          depositItems(tx, trade.fromPlayerId, trade.toOffer, nowGameTime());

          tx.update(trades).set({ status: "accepted" }).where(eq(trades.id, trade.id)).run();
        });

        updated = { ...updated, status: "accepted" };
        notifyBoth(updated);

        // каждому участнику шлём свежий инвентарь (он изменился)
        for (const pid of [trade.fromPlayerId, trade.toPlayerId]) {
          const inv = db.select().from(inventoryItems).where(eq(inventoryItems.playerId, pid)).all();
          emitToPlayer(pid, "inventory", inv.map((i) => ({
            id: i.id, itemType: i.itemType, quantity: i.quantity,
            acquiredAt: i.acquiredAt, equiped: i.equiped
          })));
        }

        res.json({ ok: true, status: "accepted" })
        
        notify(trade.fromPlayerId,"Ваш обмен завершён!")
        notify(trade.toPlayerId,"Ваш обмен завершён!")

        return

      } catch (error) {
        // У кого-то не хватило предметов. Сбрасываем ОБЕ галочки (партнёру
        // придётся подтвердить заново — он видел одну выкладку, а она могла
        // стать неисполнимой), трейд остаётся открытым для переговоров.
        db.update(trades).set({ fromReady: false, toReady: false }).where(eq(trades.id, trade.id)).run();
        updated = { ...updated, fromReady: false, toReady: false };
        notifyBoth(updated);

        res.status(400).json({
          error: error instanceof Error ? error.message : "Обмен не удался"
        });
        return;
      }
    }

    // пока готов только я — просто сохраняем галочку
    db.update(trades)
      .set(role === "from" ? { fromReady: true } : { toReady: true })
      .where(eq(trades.id, trade.id))
      .run();

    notifyBoth(updated);
    res.json({ ok: true, status: "waiting" });
  });
};