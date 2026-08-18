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

Ошибки: `400` — неизвестное действие; `404` — локация не найдена; `409` — игрок не вошёл в эту локацию.

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

Текущее состояние активного боя. Клиент опрашивает его по таймеру, чтобы видеть актуальные HP. Требует авторизацию.

```json
200 → CombatStateResponse
```

Ошибки: `404` — нет активного боя.

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
- Лут в БД хранится как JSON-строка в колонке `loot`, но через drizzle (`mode: "json"`) отдаётся как `number[]`.
- Здоровье игрока восстанавливается пассивно: **1 HP за 10 секунд** (ленивый расчёт при каждом авторизованном запросе через `regen.ts`, таймер сбрасывается только при фактическом регене).