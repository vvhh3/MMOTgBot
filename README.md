# MMOBot — MVP Telegram Mini App

Минимальный рабочий скелет Telegram Mini App: авторизация через `initData`, REST API, SQLite в режиме WAL, список локаций, вход в локацию, HTTP-поллинг состояния локации и одно тестовое действие.

## Структура

```text
/apps/client        React + Vite + TypeScript
/apps/server        Express REST API + Telegram-бот на grammy
/packages/shared    Общие DTO для API
```

Бот лежит в `apps/server/src/bot.ts`, потому что в MVP он использует те же переменные окружения и зависимости, что и сервер. Это упрощает локальный запуск и деплой на Railway по сравнению с отдельным пакетом бота.

## Запуск локально

1. Установите зависимости:

```bash
npm install
```

Рекомендуемый рантайм для локальной разработки — Node.js LTS. `better-sqlite3` — нативная зависимость; если для вашей версии Node нет готового бинарника на Windows, установите Python и C++ Build Tools для `node-gyp`.

2. Создайте `.env` из `.env.example`:

```env
BOT_TOKEN=токен-бота-из-botfather
SESSION_SECRET=длинный-случайный-секрет
PORT=4000
CLIENT_URL=http://localhost:5173
DATABASE_PATH=./data/mmobot.db
VITE_API_BASE_URL=http://localhost:4000
```

Описание переменных:

- `BOT_TOKEN` — токен бота из BotFather (обязательный).
- `SESSION_SECRET` — секрет для подписи сессий; если не указан, берётся `BOT_TOKEN`.
- `PORT` — порт API-сервера (по умолчанию 4000).
- `CLIENT_URL` — адрес фронтенда (Mini App). Сервер использует его для CORS и кнопки webApp в боте.
- `CORS_ORIGINS` — дополнительные origin-ы через запятую, разрешённые для CORS (например, `http://localhost:5173` при локальной разработке). Если не задан, разрешён только `CLIENT_URL`.
- `DATABASE_PATH` — путь к файлу SQLite. Локально БД лежит в проекте; на Railway путь меняется на персистентный volume.
- `VITE_API_BASE_URL` — адрес API, по которому клиент делает запросы.
- `DEV_BYPASS_AUTH` — если `true`, сервер пропускает проверку подписи Telegram (только для локальной разработки).
- `VITE_DEV_MODE` — если `true` и Telegram недоступен, клиент подставляет фейкового игрока (только для локальной разработки).

### Дизайн без Telegram

Чтобы верстать прямо в браузере без открытия Telegram, задайте в `.env`:

```env
DEV_BYPASS_AUTH=true
VITE_DEV_MODE=true
```

Затем запустите `npm run dev:client` и откройте `http://localhost:5173`. Клиент сгенерирует поддельный `initData`, а сервер (запущенный с `npm run dev:server`) пропустит проверку подписи. Так вы сможете редактировать дизайн в `apps/client/src/styles.css` и `main.tsx` с мгновенной перезагрузкой. Уберите эти переменные перед деплоем на Railway.

3. Запустите API:

```bash
npm run dev:server
```

4. Запустите клиент:

```bash
npm run dev:client
```

5. Запустите Telegram-бота:

```bash
npm run dev:bot
```

Настройте домен Mini App в BotFather на публичный HTTPS-адрес клиента. Для локального тестирования в Telegram используйте туннель (например, Cloudflare Tunnel или ngrok) и укажите в `CLIENT_URL` его HTTPS-адрес.

## API

- `POST /auth`
- `GET /me`
- `GET /locations`
- `GET /locations/:id/state`
- `POST /locations/:id/enter`
- `POST /locations/:id/action`

Все DTO запросов и ответов живут в `packages/shared/src/index.ts` и используются и клиентом, и сервером.

## Railway

1. Создайте сервис Railway из репозитория.
2. Добавьте персистентный volume, например, смонтированный в `/data`.
3. Задайте переменные:

```env
BOT_TOKEN=...
SESSION_SECRET=...
PORT=4000
CLIENT_URL=https://your-client.example
DATABASE_PATH=/data/mmobot.db
```

4. Команда сборки:

```bash
npm ci && npm run build --workspace @mmobot/shared && npm run build --workspace @mmobot/server
```

5. Команда запуска API:

```bash
npm run start --workspace @mmobot/server
```

Для бота создайте второй процесс/сервис Railway с теми же переменными и командой:

```bash
npm run start:bot --workspace @mmobot/server
```

## Осознанно минимально

Реальный контент локаций, финальный дизайн, чат, PvP, торговля и гильдии не реализованы. Тестовое действие сейчас добавляет `city-supply`, увеличивает очки и пишет событие в SQLite.
