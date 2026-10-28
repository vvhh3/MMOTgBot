import { currentPartyMember } from '../group-events/participation.js';
import { Deck,SUIT,type Card as DeckCard } from "@block52/deck";
import type { CasinoGameType,CasinoSessionResponse,LastAction,PlayingCardDto } from "@mmobot/shared";
import { and,eq,sql } from "drizzle-orm";
import type { Express,Response } from "express";
import { randomInt } from "node:crypto";
import { db } from "../../database/connection.js";
import { toPlayerDto } from "../../database/mappers.js";
import { casinoSessions,players,type CasinoSessionRow } from "../../database/schema.js";
import { nowGameTime } from "../../shared/time.js";
import type { AuthedRequest } from "../auth/auth.js";
import { progressQuests } from "../quests/routes.js";

const CITY_PARK_ID = "market";
const HOUSE_FACTOR = 0.95;
const LADDER_LEVELS = 8;
const MIN_BET = 1;

type MinesState = { mines: number[]; revealed: number[]; explodedCell?: number };
type BlackjackState = { deck: string; playerCards: PlayingCardDto[]; dealerCards: PlayingCardDto[]; result?: string };
type LadderState = {
  choices: number[];
  failedCell?: number;
  bombCount?: 1 | 2;
  bombCells?: number[][];
  // Старые активные сессии хранят одну безопасную клетку на уровень.
  safeCells?: number[];
};

const actionType: Record<CasinoGameType, LastAction["type"]> = {
  mines: "Mines",
  blackjack: "Blackjack",
  ladder: "Ladder",
};

function activeSession(playerId: number): CasinoSessionRow | undefined {
  return db.select().from(casinoSessions)
    .where(and(eq(casinoSessions.playerId, playerId), eq(casinoSessions.status, "active")))
    .get();
}

function requirePlayer(req: AuthedRequest, res: Response) {
  const player = db.select().from(players).where(eq(players.id, req.player.id)).get();
  if (!player) res.status(404).json({ error: "Игрок не найден" });
  return player;
}

function emitPlayer(playerId: number) {
  const row = db.select().from(players).where(eq(players.id, playerId)).get()!;
  return toPlayerDto(row);
}

function cardTotal(cards: PlayingCardDto[]): number {
  let total = cards.reduce((sum, card) => sum + (card.rank === "A" ? 11 : ["K", "Q", "J"].includes(card.rank) ? 10 : Number(card.rank)), 0);
  let aces = cards.filter((card) => card.rank === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function shuffledDeck(): Deck {
  const deck = new Deck();
  // The library accepts an explicit seed; supply it from Node's crypto API.
  deck.shuffle(Array.from({ length: 52 }, () => randomInt(0x100000000)));
  return deck;
}

function toPlayingCard(card: DeckCard): PlayingCardDto {
  const suits: Record<SUIT, PlayingCardDto["suit"]> = {
    [SUIT.CLUBS]: "clubs", [SUIT.DIAMONDS]: "diamonds",
    [SUIT.HEARTS]: "hearts", [SUIT.SPADES]: "spades",
  };
  const rank = (card.rank === 1 ? "A" : card.rank === 11 ? "J" : card.rank === 12 ? "Q" : card.rank === 13 ? "K" : String(card.rank)) as PlayingCardDto["rank"];
  return { rank, suit: suits[card.suit] };
}

function minesMultiplier(mineCount: number, opened: number): number {
  let probability = 1;
  for (let i = 0; i < opened; i += 1) probability *= (25 - mineCount - i) / (25 - i);
  return opened === 0 ? 1 : Math.floor((HOUSE_FACTOR / probability) * 100) / 100;
}

function publicSession(session: CasinoSessionRow): CasinoSessionResponse {
  const player = emitPlayer(session.playerId);
  const base: CasinoSessionResponse = {
    id: session.id, game: session.game, status: session.status, bet: session.bet,
    multiplier: session.multiplier, potentialPayout: session.potentialPayout, player,
  };
  if (session.game === "mines") {
    const state = session.state as MinesState;
    base.mines = {
      mineCount: state.mines.length,
      revealed: state.revealed,
      explodedCell: state.explodedCell,
      bombCells: session.status !== "active" ? state.mines : undefined,
    };
  } else if (session.game === "blackjack") {
    const state = session.state as BlackjackState;
    const finished = session.status !== "active";
    base.blackjack = {
      playerCards: state.playerCards,
      dealerCards: finished ? state.dealerCards : [state.dealerCards[0], null],
      playerTotal: cardTotal(state.playerCards),
      dealerTotal: finished ? cardTotal(state.dealerCards) : undefined,
      result: state.result,
    };
  } else {
    const state = session.state as LadderState;
    base.ladder = {
      level: state.choices.length,
      maxLevels: LADDER_LEVELS,
      bombCount: state.bombCount ?? 2,
      revealedSafeCells: state.choices.slice(0, session.status === "active" ? state.choices.length : undefined),
      failedCell: state.failedCell,
      bombCells: session.status !== "active"
        ? state.bombCells ?? state.safeCells?.map((safeCell) => [0, 1, 2].filter((cell) => cell !== safeCell))
        : undefined,
    };
  }
  return base;
}

export function getCasinoSessionForPlayer(playerId: number, sessionId?: number): CasinoSessionResponse | null {
  const session = sessionId
    ? db.select().from(casinoSessions).where(and(eq(casinoSessions.id, sessionId), eq(casinoSessions.playerId, playerId), eq(casinoSessions.status, "active"))).get()
    : activeSession(playerId);
  return session ? publicSession(session) : null;
}

function finishSession(session: CasinoSessionRow, status: "won" | "lost", payout: number, state: Record<string, unknown>) {
  const finished: CasinoSessionRow = {
    ...session,
    status,
    potentialPayout: payout,
    state,
    finishedAt: nowGameTime(),
  };
  db.transaction((tx) => {
    const deleted = tx.delete(casinoSessions)
      .where(and(eq(casinoSessions.id, session.id), eq(casinoSessions.status, "active"))).run();
    if (deleted.changes !== 1) throw new Error("Игровая сессия уже завершена");
    tx.update(players).set({
      money: payout > 0 ? sql`${players.money} + ${payout}` : players.money,
      idTheLastAction: null,
    }).where(eq(players.id, session.playerId)).run();
    // Возврат ставки (в том числе ничья) не является заработком.
    const profit = payout - session.bet;
    if (status === "won" && profit > 0) {
      progressQuests(session.playerId, "casino_win", session.game, profit);
    }
  });
  return finished;
}

export function createCasinoRoutes(app: Express) {
  app.get("/casino/session", (req, res) => {
    const player = requirePlayer(req as AuthedRequest, res);
    if (!player) return;
    const session = activeSession(player.id);
    if (!session) return res.status(404).json({ error: "Активная игра не найдена" });
    return res.json(publicSession(session));
  });

  app.post("/casino/start", (req, res) => {
    const player = requirePlayer(req as AuthedRequest, res);
    if (!player) return;
    const game = req.body.game as CasinoGameType;
    const bet = Number(req.body.bet);
    if (!["mines", "blackjack", "ladder"].includes(game)) return res.status(400).json({ error: "Неизвестная игра" });
    if (!Number.isInteger(bet) || bet < MIN_BET) return res.status(400).json({ error: "Ставка должна быть целым положительным числом" });
    if (player.currentLocationId !== CITY_PARK_ID) return res.status(409).json({ error: "Играть можно только в Сити парке" });
    if (currentPartyMember(db, player.id) || player.idTheLastAction || activeSession(player.id)) return res.status(409).json({ error: "Сначала завершите текущее действие" });
    if (player.money < bet) return res.status(409).json({ error: "Недостаточно монет" });

    let state: Record<string, unknown>;
    if (game === "mines") {
      const mineCount = Number(req.body.mineCount);
      if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount > 24) return res.status(400).json({ error: "Количество мин: от 1 до 24" });
      const cells = Array.from({ length: 25 }, (_, index) => index);
      for (let i = cells.length - 1; i > 0; i -= 1) { const j = randomInt(i + 1); [cells[i], cells[j]] = [cells[j], cells[i]]; }
      state = { mines: cells.slice(0, mineCount), revealed: [] } satisfies MinesState;
    } else if (game === "blackjack") {
      const deck = shuffledDeck();
      state = {
        deck: "",
        playerCards: [toPlayingCard(deck.getNext()), toPlayingCard(deck.getNext())],
        dealerCards: [toPlayingCard(deck.getNext()), toPlayingCard(deck.getNext())],
      } satisfies BlackjackState;
      (state as BlackjackState).deck = deck.toString();
    } else {
      const ladderBombCount = Number(req.body.ladderBombCount);
      if (ladderBombCount !== 1 && ladderBombCount !== 2) return res.status(400).json({ error: "Количество бомб: 1 или 2" });
      const bombCells = Array.from({ length: LADDER_LEVELS }, () => {
        const cells = [0, 1, 2];
        for (let i = cells.length - 1; i > 0; i -= 1) { const j = randomInt(i + 1); [cells[i], cells[j]] = [cells[j], cells[i]]; }
        return cells.slice(0, ladderBombCount);
      });
      state = { bombCount: ladderBombCount, bombCells, choices: [] } satisfies LadderState;
    }

    let sessionId = 0;
    db.transaction((tx) => {
      const result = tx.insert(casinoSessions).values({ playerId: player.id, game, bet, state, createdAt: nowGameTime() }).run();
      sessionId = Number(result.lastInsertRowid);
      tx.update(players).set({ money: sql`${players.money} - ${bet}`, idTheLastAction: { id: sessionId, type: actionType[game] } })
        .where(and(eq(players.id, player.id), sql`${players.money} >= ${bet}`)).run();
    });
    const session = db.select().from(casinoSessions).where(eq(casinoSessions.id, sessionId)).get()!;
    if (game === "blackjack") {
      const hand = session.state as BlackjackState;
      const playerNatural = cardTotal(hand.playerCards) === 21;
      const dealerNatural = cardTotal(hand.dealerCards) === 21;
      if (playerNatural || dealerNatural) {
        const payout = playerNatural && dealerNatural ? bet : playerNatural ? Math.floor(bet * 2.5) : 0;
        hand.result = playerNatural && dealerNatural ? "Ничья: два Blackjack" : playerNatural ? "Blackjack!" : "Blackjack у дилера";
        return res.status(201).json(publicSession(finishSession(session, payout > 0 ? "won" : "lost", payout, hand as unknown as Record<string, unknown>)));
      }
    }
    return res.status(201).json(publicSession(session));
  });

  app.post("/casino/mines/reveal", (req, res) => {
    const player = requirePlayer(req as AuthedRequest, res); if (!player) return;
    const session = activeSession(player.id);
    if (!session || session.game !== "mines") return res.status(409).json({ error: "Нет активной игры в Мины" });
    const cell = Number(req.body.cell);
    const state = session.state as MinesState;
    if (!Number.isInteger(cell) || cell < 0 || cell > 24 || state.revealed.includes(cell)) return res.status(400).json({ error: "Недоступная клетка" });
    if (state.mines.includes(cell)) {
      state.explodedCell = cell;
      return res.json(publicSession(finishSession(session, "lost", 0, state as unknown as Record<string, unknown>)));
    }
    state.revealed.push(cell);
    const multiplier = minesMultiplier(state.mines.length, state.revealed.length);
    const payout = Math.max(session.bet, Math.floor(session.bet * multiplier));
    db.update(casinoSessions).set({ state: state as unknown as Record<string, unknown>, multiplier, potentialPayout: payout }).where(eq(casinoSessions.id, session.id)).run();
    return res.json(publicSession(db.select().from(casinoSessions).where(eq(casinoSessions.id, session.id)).get()!));
  });

  app.post("/casino/mines/cashout", (req, res) => {
    const player = requirePlayer(req as AuthedRequest, res); if (!player) return;
    const session = activeSession(player.id);
    if (!session || session.game !== "mines") return res.status(409).json({ error: "Нет активной игры в Мины" });
    const state = session.state as MinesState;
    if (state.revealed.length === 0) return res.status(409).json({ error: "Сначала откройте безопасную клетку" });
    return res.json(publicSession(finishSession(session, "won", session.potentialPayout, session.state)));
  });

  app.post("/casino/blackjack/action", (req, res) => {
    const player = requirePlayer(req as AuthedRequest, res); if (!player) return;
    const session = activeSession(player.id);
    if (!session || session.game !== "blackjack") return res.status(409).json({ error: "Нет активной игры в 21" });
    const state = session.state as BlackjackState;
    const action = req.body.action as "hit" | "stand";
    const deck = new Deck(state.deck);
    if (action === "hit") {
      state.playerCards.push(toPlayingCard(deck.getNext()));
      state.deck = deck.toString();
      if (cardTotal(state.playerCards) < 21) {
        db.update(casinoSessions).set({ state: state as unknown as Record<string, unknown> }).where(eq(casinoSessions.id, session.id)).run();
        return res.json(publicSession(db.select().from(casinoSessions).where(eq(casinoSessions.id, session.id)).get()!));
      }
    } else if (action !== "stand") return res.status(400).json({ error: "Неизвестное действие" });

    const playerTotal = cardTotal(state.playerCards);
    if (playerTotal <= 21) while (cardTotal(state.dealerCards) < 17) state.dealerCards.push(toPlayingCard(deck.getNext()));
    state.deck = deck.toString();
    const dealerTotal = cardTotal(state.dealerCards);
    let payout = 0;
    if (playerTotal > 21) state.result = "Перебор";
    else if (dealerTotal > 21 || playerTotal > dealerTotal || (playerTotal === 21 && state.playerCards.length === 2 && state.dealerCards.length > 2)) {
      const blackjack = state.playerCards.length === 2 && playerTotal === 21;
      payout = Math.floor(session.bet * (blackjack ? 2.5 : 2));
      state.result = blackjack ? "Blackjack!" : "Победа";
    } else if (playerTotal === dealerTotal && !(dealerTotal === 21 && state.dealerCards.length === 2)) { payout = session.bet; state.result = "Ничья"; }
    else state.result = "Дилер победил";
    return res.json(publicSession(finishSession(session, payout > 0 ? "won" : "lost", payout, state as unknown as Record<string, unknown>)));
  });

  app.post("/casino/ladder/choose", (req, res) => {
    const player = requirePlayer(req as AuthedRequest, res); if (!player) return;
    const session = activeSession(player.id);
    if (!session || session.game !== "ladder") return res.status(409).json({ error: "Нет активной игры Лестница" });
    const cell = Number(req.body.cell);
    const state = session.state as LadderState;
    if (!Number.isInteger(cell) || cell < 0 || cell > 2) return res.status(400).json({ error: "Выберите одну из трёх клеток" });
    const level = state.choices.length;
    state.choices.push(cell);
    const hitBomb = state.bombCells
      ? state.bombCells[level].includes(cell)
      : state.safeCells?.[level] !== cell;
    if (hitBomb) {
      state.failedCell = cell;
      return res.json(publicSession(finishSession(session, "lost", 0, state as unknown as Record<string, unknown>)));
    }
    const bombCount = state.bombCount ?? 2;
    const multiplier = Math.floor(HOUSE_FACTOR * ((3 / (3 - bombCount)) ** state.choices.length) * 100) / 100;
    const payout = Math.floor(session.bet * multiplier);
    if (state.choices.length === LADDER_LEVELS) return res.json(publicSession(finishSession(session, "won", payout, state as unknown as Record<string, unknown>)));
    db.update(casinoSessions).set({ state: state as unknown as Record<string, unknown>, multiplier, potentialPayout: payout }).where(eq(casinoSessions.id, session.id)).run();
    return res.json(publicSession(db.select().from(casinoSessions).where(eq(casinoSessions.id, session.id)).get()!));
  });

  app.post("/casino/ladder/cashout", (req, res) => {
    const player = requirePlayer(req as AuthedRequest, res); if (!player) return;
    const session = activeSession(player.id);
    if (!session || session.game !== "ladder") return res.status(409).json({ error: "Нет активной игры Лестница" });
    const state = session.state as LadderState;
    if (state.choices.length === 0) return res.status(409).json({ error: "Сначала пройдите один уровень" });
    return res.json(publicSession(finishSession(session, "won", session.potentialPayout, session.state)));
  });
}
