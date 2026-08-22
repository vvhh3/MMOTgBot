# MMOBot API

REST API на Express. Базовый URL: `http://localhost:4000` (задаётся через `PORT`).

**Формат данных:** все запросы и ответы — JSON. На ошибку сервер отвечает объектом `{ "error": string }` с соответствующим HTTP-статусом.

**Авторизация:** почти все эндпоинты требуют заголовок `Authorization: Bearer <token>`, где `<token>` — токен из `POST /auth`.

Все типы DTO (запросов и ответов) живут в `packages/shared/src/index.ts` и используются и клиентом, и сервером.

## Типы DTO

```ts
PlayerDto = {
  id: number;                // telegram user id
  name: string;
  level: number;
  xp: number;
  points: number;
  currentLocationId: string | null;
  health: number;
  maxHp: number;
  strength: number;          // с учётом экипировки
  defense: number;           // с учётом экипировки
  statPoints: number;        // нераспределённые очки характеристик
}

StatType = "maxHealth" | "strength" | "defense"

SpendStatPointRequest = {
  stat: StatType
}

MobDto = {
  id: number;
  name: string;
  description: string;
  level: number;
  maxHealth: number;
  strength: number;
  defense: number;
  loot: number[];            // id предметов, выпадающих при победе
  pointsReward: number;      // очки за убийство
  locationId: string;
  respawnSeconds: number;    // время до респауна после смерти
}

ItemDto = {
  id: number;
  name: string;
  description: string;
  type: "weapon" | "armor" | "consumable" | "material" | "other";
  damage: number;            // бонус к силе в бою
  defense: number;           // бонус к защите в бою
  healAmount: number;        // сколько HP лечит consumable
  price: number;
}

LocationDto = {
  id: string;
  name: string;
  description: string;
  x: number;   // координата на карте
  y: number;
}

InventoryItemDto = {
  id: number;
  itemType: number;          // id предмета из каталога items
  quantity: number;
  acquiredAt: string;        // ISO timestamp
  equiped: boolean;
}

EventDto = {
  id: number;
  playerId: number;
  playerName: string;
  locationId: string;
  type: string;              // например "fight", "walk", "kill", "death"
  createdAt: string;         // ISO timestamp
}

ActionDto = {
  id: string;
  label: string;
  description: string;
}

CombatLogEntry = {
  text: string;
  at: string;   // ISO timestamp
}

CombatStateResponse = {
  mob: MobDto;
  playerHp: number;
  playerMaxHp: number;
  mobHp: number;
  mobMaxHp: number;
  status: "active" | "victory" | "defeat" | "fled";
  log: CombatLogEntry[];
}

LeaderBoardToDto = {
  player: PlayerDto;
  points: number;
}

// === Обмен между игроками ===

TradeItem = {
  itemType: number;   // id предмета из каталога items
  quantity: number;   // сколько штук отдаём (> 0)
}

// Состояние окна трейда ДЛЯ КОНКРЕТНОГО игрока.
// Игроки НЕ видят инвентарь друг друга — только то,
// что партнёр выставил на стол (partnerOffer).
TradeStateDto = {
  id: number;
  status: "pending" | "open" | "accepted" | "declined" | "cancelled";
  myOffer: TradeItem[];        // что выставил я
  partnerOffer: TradeItem[];   // что выставил партнёр
  iAmReady: boolean;           // нажал ли я "Готово"
  partnerIsReady: boolean;     // нажал ли партнёр "Готово"
  partnerName: string;
}

TradeListItemDto = {
  id: number;
  partnerName: string;
  status: "pending" | "open";
  direction: "incoming" | "outgoing";  // мне пришли / я отправил
}

TradesOverviewResponse = {
  invites: TradeListItemDto[];   // приглашения, ждущие ответа
  active: TradeStateDto | null;  // мой открытый трейд (может быть только один)
}

// === Дуэли между игроками (PvP) ===

// Состояние дуэли ДЛЯ КОНКРЕТНОГО игрока ("моё / его", а не player1/player2).
PvpStateDto = {
  id: number;
  status: "pending" | "active" | "finished";
  myName: string;
  partnerName: string;
  myHp: number;              // мой HP в этой дуэли (зафиксирован на момент accept)
  myMaxHp: number;
  partnerHp: number;
  partnerMaxHp: number;
  myTurn: boolean;           // сейчас мой ход?
  finished: boolean;
  isWon: boolean | null;     // true/false — итог для меня; null = не завершена ИЛИ ничья
}

PvpListItemDto = {
  id: number;
  partnerName: string;
  direction: "incoming" | "outgoing";  // МНЕ вызвали / Я вызвал
}

PvpOverviewResponse = {
  invites: PvpListItemDto[];     // вызовы, ждущие ответа
  active: PvpStateDto | null;    // моя активная дуэль (может быть только одна)
}
```

## Эндпоинты

### `GET /health`

Проверка живости сервера. Без авторизации.

```json
200 → { "ok": true }
```

### `POST /auth`

Авторизация через Telegram `initData` (строка из `window.Telegram.WebApp.initData`). При первом входе создаёт игрока, при повторном — обновляет имя и `lastSeenAt`. Возвращает JWT-токен.

Запрос:

```json
{ "initData": "..." }
```

Ответ:

```json
{
  "token": "jwt-токен",
  "player": PlayerDto
}
```

Ошибки: `400` — нет `initData`; `401` — невалидная подпись `initData`.

### `GET /me`

Текущий игрок и его инвентарь. Требует авторизацию.

```json
200 → {
  "player": PlayerDto,
  "inventory": InventoryItemDto[]
}
```

### `POST /me/stats`

Потратить одно очко характеристик на прокачку стата. Очки (`statPoints` в `PlayerDto`) выдаются по 1 шт. за каждый новый уровень. За одно очко: `maxHealth` +5 (текущий HP тоже +5), `strength` +2, `defense` +1. Требует авторизацию.

Запрос:

```json
{ "stat": "maxHealth" | "strength" | "defense" }
```

Ответ:

```json
200 → { "player": PlayerDto }
```

Ошибки: `400` — неизвестный `stat`; `409` — нет свободных очков.

### `GET /locations`

Список всех локаций, отсортированных по названию. Требует авторизацию.

```json
200 → { "locations": LocationDto[] }
```

### `GET /locations/:id/state`

Текущее состояние локации: игроки в ней, доступные действия, живые мобы, последние события. Требует авторизацию.

```json
200 → {
  "location": LocationDto,
  "players": PlayerDto[],
  "actions": ActionDto[],
  "mobs": MobDto[],              // только живые мобы (убитые скрыты до респауна)
  "recentEvents": EventDto[],    // последние 10 событий
  "serverTime": string
}
```

Ошибки: `404` — локация не найдена.

### `POST /locations/:id/enter`

Вход игрока в локацию. Обновляет `currentLocationId` и возвращает игрока + состояние локации. Требует авторизацию.

```json
200 → {
  "player": PlayerDto,
  "state": LocationStateResponse   // тот же объект, что и в GET /locations/:id/state
}
```

Ошибки: `404` — локация не найдена.

### `POST /locations/:id/action`

Действие в локации. Доступные `actionId`: `fight` (сражение: +очки, предметы не выпадают) и `walk` (прогулка: +XP, небольшой шанс получить случайный предмет). Требует авторизацию.

Запрос:

```json
{ "actionId": "fight" | "walk" }
```

Ответ:

```json
{
  "message": "строка о результате действия",
  "player": PlayerDto,
  "inventory": InventoryItemDto[],
  "event": EventDto
}
```

Ошибки: `400` — неизвестное действие; `404` — локация не найдена; `409` — игрок не вошёл в эту локацию; `429` — слишком часто (антифарм-кулдаун 2 секунды между действиями одного игрока).

### `GET /leaderboard`

Топ-10 игроков по очкам (`points`), отсортированных по убыванию. Требует авторизацию.

```json
200 → {
  "entries": LeaderBoardToDto[]
}
```

### `POST /inventory/equip`

Надеть предмет (оружие или броню) из инвентаря. При надевании предмета того же типа старый снимается автоматически. Требует авторизацию.

Запрос:

```json
{ "itemType": 2 }
```

Ответ:

```json
200 → { "inventory": InventoryItemDto[] }
```

Ошибки: `400` — предмета нет в инвентаре или это не оружие/броня.

### `POST /inventory/unequip`

Снять надетый предмет. Требует авторизацию.

Запрос:

```json
{ "itemType": 2 }
```

Ответ:

```json
200 → { "inventory": InventoryItemDto[] }
```

Ошибки: `400` — предмет не надет.

### `POST /inventory/use`

Использовать расходный предмет (consumable): лечит `healAmount` HP, одна единица расходуется. Требует авторизацию.

Запрос:

```json
{ "itemType": 6 }
```

Ответ:

```json
200 → {
  "player": PlayerDto,
  "inventory": InventoryItemDto[]
}
```

Ошибки: `400` — предмета нет, это не consumable или HP уже полное.

### `POST /combat/start`

Начало боя с мобом в текущей локации. Требует авторизацию.

Запрос:

```json
{ "mobId": "1" }   // строкой, хотя в БД id числовой
```

Ответ:

```json
200 → CombatStateResponse
```

Ошибки: `404` — моб не найден; `409` — игрок не в той локации, уже есть активный бой или моб мёртв (в респауне).

### `POST /combat/action`

Ход в активном бою. Требует авторизацию.

Запрос:

```json
{ "action": "attack" | "flee" }
```

Ответ:

```json
{
  "state": CombatStateResponse,
  "player": PlayerDto,             // актуальный после боя
  "inventory": InventoryItemDto[]  // лут, если была победа
}
```

Победа: лут моба попадает в инвентарь, начисляются `pointsReward` очков и XP, моб уходит в респаун, пишется событие `kill`. Поражение: HP = 0, игрок телепортируется на стартовую локацию (`square`), пишется событие `death`.

Ошибки: `404` — моб не найден; `409` — нет активного боя.

### `GET /combat/state`

Текущее состояние активного боя. **НЕ для поллинга** — живые обновления приходят через socket-событие `combatState`. Этот роут нужен один раз: при открытии экрана боя или после переподключения. Требует авторизацию.

```json
200 → CombatStateResponse
```

Ошибки: `404` — нет активного боя.

### Квесты (для игроков)

### `GET /quests/daily`

Дневные квесты: по одному на каждую сложность (easy/medium/hard), случайный выбор из каталога. Выдаются автоматически при первом запросе за день. Требует авторизацию.

```json
200 → {
  "quests": [
    {
      "id": 1,                 // id ВЫДАННОГО квеста (player_quests.id)
      "quest": QuestsDto,      // шаблон квеста
      "progress": 2,           // сколько уже сделано
      "status": "waiting" | "completed" | "claimed",
      "assignedDay": "2026-08-21"
    }
  ]
}
```

### `POST /quests/:id/claim`

Забрать награду за выполненный квест (`id` — из `GET /quests/daily`). Начисляет XP и очки. Требует авторизацию.

```json
200 → { "player": PlayerDto, "claimed": true }
```

Ошибки: `404` — квест не найден; `409` — награда уже забрана или квест не выполнен.

---

## Обмен между игроками

Логика как в Steam-обмене:

```
A ── POST /trades ────────────► приглашение B          (pending)
B ── POST /trades/:id/accept ─► окно трейда открыто    (open)
A ── PUT /trades/:id/offer ───► выставил свои предметы
B ── PUT /trades/:id/offer ───► выставил свои предметы
A ── POST /trades/:id/ready ──► A готов
B ── POST /trades/:id/ready ──► оба готовы → ОБМЕН ИСПОЛНЕН (accepted)
```

Правила:

- Игроки **не видят инвентарь друг друга** — только то, что партнёр выложил на стол.
- У игрока может быть **только один** активный трейд.
- Любое изменение выкладки **сбрасывает обе галочки «Готово»** — нельзя подменить предмет после подтверждения партнёра.
- Предметы списываются **только в момент исполнения**, в одной транзакции. Если у кого-то предметов уже нет — ошибка, галочки сбрасываются, окно остаётся открытым.
- Незавершённые трейды автоматически отменяются через 30 минут (`maintenance.ts`).

### `GET /trades`

Мои приглашения + активный трейд. Требует авторизацию.

```json
200 → TradesOverviewResponse
```

### `POST /trades`

Шаг 1: кинуть приглашение на обмен другому игроку.

Запрос:

```json
{ "toPlayerId": 123456789 }
```

Ответ: `201 → { "ok": true }`

Ошибки: `400` — некорректный `toPlayerId` или обмен с самим собой; `404` — игрок не найден; `409` — кто-то из игроков уже участвует в другом обмене.

### `POST /trades/:id/accept`

Шаг 2: принять приглашение (доступно только получателю). Открывает окно трейда.

Ответ: `200 → { "ok": true }`

Ошибки: `404` — приглашение не найдено (или вы не получатель); `409` — вы уже в другом обмене.

### `DELETE /trades/:id`

Отклонить приглашение или отменить открытый трейд (доступно любому участнику). Если отменяет получатель pending-приглашения — статус станет `declined`, иначе `cancelled`.

Ответ: `200 → { "ok": true }`

Ошибки: `404` — обмен не найден; `409` — обмен уже завершён.

### `PUT /trades/:id/offer`

Шаг 3: выставить свои предметы в окне трейда. Полностью заменяет вашу выкладку. Сбрасывает обе галочки «Готово».

Запрос:

```json
{
  "items": [
    { "itemType": 1, "quantity": 2 },
    { "itemType": 3, "quantity": 1 }
  ]
}
```

Ответ: `200 → { "ok": true }`

Ошибки: `400` — неверный формат `items`; `404` — обмен не найден; `409` — трейд уже не в стадии настройки.

### `POST /trades/:id/ready`

Шаг 4: нажать «Готово». Когда готовы оба — сервер в одной транзакции списывает предметы у обоих и меняет их местами. После исполнения обоим участникам по сокету уходят свежие `tradeUpdate` и `inventory`.

Ответ:

```json
200 → { "ok": true, "status": "accepted" }   // обмен прошёл
200 → { "ok": true, "status": "waiting" }    // готов пока только вы
```

Ошибки: `400` — у кого-то не хватает предметов (галочки сброшены, трейд остался открыт); `404` — обмен не найден; `409` — обмен уже завершён.

---

## Дуэли между игроками (PvP)

Поочерёдный бой 1 на 1:

```
A ── POST /pvp ────────────────► вызов B                        (pending)
B ── POST /pvp/:id/accept ────► бой активен, ход у A            (active)
A ── POST /pvp/:id/action ────► A бьёт, ход переходит к B
B ── POST /pvp/:id/action ────► B бьёт, ход переходит к A
...                              пока HP одного не упадёт до 0
*  DELETE /pvp/:id             — отклонить вызов / сдаться (finished, ничья)
```

Правила:

- Роли: `player1` — кто кинул вызов (ходит первым), `player2` — кто принял.
- Ходить можно **только в свой ход** (`turn`), иначе `409`.
- Урон считается как в PvE, но **с учётом экипировки обоих**: `strength + rand(0..strength) - defense`, минимум 1.
- HP обоих фиксируется **в момент accept** — зельем в дуэли можно лечить только HP сессии, «запас» впрок не собрать.
- Побег (`flee`) — 50/50: удалось → ничья; нет → получаешь удар без своего хода.
- Победа: +10 XP и +10 очков. Проигравший: HP = 0 (дальше поднимет регенерация), телепорта нет — в отличие от PvE.
- У игрока может быть только одна незавершённая дуэль.
- Вызовы ограничены кулдауном: не чаще одного в 30 секунд от одного игрока (антиспам уведомлений).
- Зависшие дуэли (нет ходов дольше 10 минут) автоматически завершаются ничьёй.

### `GET /pvp`

Мои вызовы + активная дуэль. Требует авторизацию.

```json
200 → PvpOverviewResponse
```

### `POST /pvp`

Шаг 1: вызвать игрока на дуэль.

Запрос:

```json
{ "toPlayerId": 123456789 }
```

Ответ: `201 → { "ok": true }`. Вызованному игроку приходит socket `pvpState` и Telegram-уведомление.

Ошибки: `400` — некорректный `toPlayerId`; `404` — игрок не найден; `409` — обмен с самим собой, один из игроков мёртв (HP = 0) или уже в другой дуэли; `429` — слишком часто (кулдаун 30 секунд между вызовами одного игрока, антифарм).

### `POST /pvp/:id/accept`

Шаг 2: принять вызов (только получатель, только пока `pending`). Фиксирует HP обоих и включает режим боя.

Ответ: `200 → { "ok": true }`

Ошибки: `404` — приглашение не найдено (или вы не получатель); `409` — один из игроков мёртв.

### `DELETE /pvp/:id`

Отклонить вызов или сдаться в активной дуэли (любой участник). Итог — `finished` с `winnerId = null` (ничья).

Ответ: `200 → { "ok": true }`

Ошибки: `404` — дуэль не найдена (или вы не участник); `409` — дуэль уже завершена.

### `POST /pvp/:id/action`

Ход в активной дуэли. Требует авторизацию.

Запрос:

```json
{ "action": "attack" | "flee" | "use", "itemType": 6 }
```

- `attack` — удар (урон с учётом экипировки обоих)
- `flee` — побег, 50/50: удалось → ничья; нет → получаешь удар без своего хода
- `use` — выпить зелье (`itemType` обязателен). Лечит HP **сессии дуэли** (выше максимума нельзя) и **сжигает ход** — ход переходит к сопернику. Зелье списывается из инвентаря.

Любое действие можно совершить только в свой ход.

Ответ:

```json
200 → { "ok": true }                    // бой продолжается, ход перешёл к сопернику
200 → { "ok": true, "winnerId": 123 }   // дуэль завершена; null = ничья
```

Свежее состояние после хода приходит обоим через socket `pvpState`.

Ошибки: `400` — неизвестное действие, нет `itemType`, зелья нет в инвентаре или это не зелье; `404` — активная дуэль не найдена; `409` — сейчас не ваш ход.

---

## Socket.IO события

Сокет подключается к тому же порту, что и REST API. Авторизация — при рукопожатии:

```js
io(url, { auth: { token: "<jwt>" } })
```

Сервер отправляет клиенту события:

| Событие        | Данные                 | Когда приходит |
|----------------|------------------------|----------------|
| `locationState`| `LocationStateResponse`| Кто-то вошёл/вышел из локации, действие игрока, бой (с дебаунсом ~300 мс) |
| `combatState`  | `CombatStateResponse`  | Каждый ход боя |
| `player`       | `PlayerDto`            | Изменились данные игрока (HP, очки...) |
| `inventory`    | `InventoryItemDto[]`   | Изменился инвентарь (лут, зелье, обмен) |
| `tradeUpdate`  | `TradeStateDto \| null`| Любое изменение трейда: новое приглашение, смена выкладки, готовность, исполнение |
| `pvpState`     | `PvpStateDto \| null`  | Любое изменение дуэли: новый вызов, accept, каждый ход, завершение/отмена |

---

**Админ-эндпоинты** (`/mobs` и `/items`) доступны только администраторам (id из `config.adminIds`) и покрывают CRUD:

### `GET /mobs` · `GET /mobs/:id`

Все мобы или один по id (сортировка по уровню).

```json
200 → { "mobs": MobDto[] }   // или { "mob": MobDto }
```

### `POST /mobs`

Создание моба. `loot` — массив id предметов.

Запрос:

```json
{
  "name": "Крыса",
  "description": "описание",
  "level": 1,
  "maxHealth": 10,
  "strength": 2,
  "defense": 0,
  "loot": [1],
  "pointsReward": 10,
  "locationId": "square",
  "respawnSeconds": 60
}
```

### `PUT /mobs/:id`

Частичное обновление моба (можно передать только нужные поля).

### `DELETE /mobs/:id`

Удаление моба. `200` с пустым телом.

### `GET /items` · `GET /items/:id`

Все предметы или один по id (сортировка по id).

```json
200 → { "items": ItemDto[] }   // или { "item": ItemDto }
```

### `POST /items`

Создание предмета.

Запрос:

```json
{
  "name": "Аптечка",
  "description": "описание",
  "type": "consumable",
  "damage": 0,
  "defense": 0,
  "healAmount": 30,
  "price": 50
}
```

### `PUT /items/:id`

Частичное обновление предмета.

### `DELETE /items/:id`

Удаление предмета. `200` с пустым телом.

---

**Примечания:**

- Логи боя и респаун-таймеры мобов хранятся в памяти сервера (не в БД) и сбрасываются при перезапуске.
- Уровни: XP копится по пороговой таблице (`level.ts`). Статы при уровне **автоматически не растут** — игрок получает 1 очко `statPoints` и сам решает, куда его потратить через `POST /me/stats`.
- Лут в БД хранится как JSON-строка в колонке `loot`, но через drizzle (`mode: "json"`) отдаётся как `number[]`.
- Здоровье игрока восстанавливается пассивно: **1 HP за 10 секунд** (ленивый расчёт при каждом авторизованном запросе через `regen.ts`, таймер сбрасывается только при фактическом регене).
- JWT-токен живёт **30 дней**, после чего нужен повторный вход через Telegram.
- Зависшие бои (нет ходов дольше 5 минут) автоматически завершаются, чтобы игрок мог начать новый.
- Зависшие дуэли (нет ходов дольше 10 минут) автоматически завершаются ничьёй.
- Логи PvP-дуэлей хранятся в памяти сервера (не в БД) и сбрасываются при перезапуске.
- Журнал событий (`events`) чистится раз в час: удаляются записи старше 7 дней.