# MMOBot API

REST API на Express. Базовый URL: `http://localhost:4000` (задаётся через `PORT`).

**Формат данных:** все запросы и ответы — JSON. На ошибку сервер отвечает объектом `{ "error": string }` с соответствующим HTTP-статусом.

**Авторизация:** почти все эндпоинты требуют заголовок `Authorization: Bearer <token>`, где `<token>` — токен из `POST /auth`.

Все типы DTO (запросов и ответов) живут в `packages/shared/src/index.ts` и используются и клиентом, и сервером.

## Типы DTO

```ts
PlayerDto = {
  id: number;            // telegram user id
  name: string;
  level: number;
  points: number;
  currentLocationId: string | null;
  health: number;
  maxHp: number;
  strength: number;
  defense: number;
}

MobDto = {
  id: number;
  name: string;
  description: string;
  level: number;
  health: number;
  maxHealth: number;
  strength: number;
  defense: number;
  loot: string[];          // предметы, выпадающие при победе
  pointsReward: number;    // очки за убийство
  locationId: string;
  respawnSeconds: number;  // время до респауна после смерти
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
  itemType: string;
  quantity: number;
  acquiredAt: string;   // ISO timestamp
}

EventDto = {
  id: number;
  playerId: number;
  playerName: string;
  locationId: string;
  type: string;         // например "scavenge", "kill", "death", "entered"
  createdAt: string;    // ISO timestamp
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

Действие в локации. Сейчас доступно только `actionId: "scavenge"` (поиск припасов): добавляет `city-supply` в инвентарь, +1 очко, пишет событие `scavenge`. Требует авторизацию.

Запрос:

```json
{ "actionId": "scavenge" }
```

Ответ:

```json
{
  "message": "Вы нашли припасы: <локация>.",
  "player": PlayerDto,
  "inventory": InventoryItemDto[],
  "event": EventDto
}
```

<!-- eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwbGF5ZXJJZCI6MTIzLCJpYXQiOjE3ODY3MTkwMTN9.5kIC0AZVHYKtCwEQeyvq5TxgjHoml4y0ch3bTEFeCOM -->

Ошибки: `400` — неизвестное действие; `404` — локация не найдена; `409` — игрок не вошёл в эту локацию.

### `POST /combat/start`

Начало боя с мобом в текущей локации. Требует авторизацию.

Запрос:

```json
{ "mobId": "1" }   // строкой, хотя в БД id числовой
```

Ответ:

```json
CombatStateResponse = {
  "mob": MobDto,
  "playerHp": number,
  "playerMaxHp": number,
  "mobHp": number,
  "mobMaxHp": number,
  "status": "active" | "victory" | "defeat" | "fled",
  "log": CombatLogEntry[]
}
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

Победа: лут моба попадает в инвентарь, начисляются `pointsReward` очков, моб уходит в респаун, пишется событие `kill`. Поражение: очки делятся на 10, HP = 1, игрок телепортируется на стартовую локацию, пишется событие `death`.

Ошибки: `404` — моб не найден; `409` — нет активного боя.

### `GET /combat/state`

Текущее состояние активного боя. Клиент опрашивает его по таймеру, чтобы видеть актуальные HP. Требует авторизацию.

```json
200 → CombatStateResponse
```

Ошибки: `404` — нет активного боя.

---

**Примечание:** логи боя и респаун-таймеры мобов хранятся в памяти сервера (не в БД) и сбрасываются при перезапуске. Лут в БД хранится как JSON-строка в колонке `loot`, но через drizzle (`mode: "json"`) отдаётся как `string[]`.
