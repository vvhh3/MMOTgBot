# @mmobot/server

Express API, Socket.IO, Telegram-бот и игровая логика MMOBot. Полная [карта проекта](../../docs/architecture.md) объясняет назначение каждого модуля и связи с клиентом.

## Структура

| Путь | Назначение |
| --- | --- |
| `src/index.ts` | Запуск HTTP, Socket.IO и фонового обслуживания. |
| `src/bot.ts` | Отдельный процесс Telegram-бота с командой `/start`. |
| `src/app.ts` | Создание Express, middleware и подключение маршрутов. |
| `src/config/env.ts` | Корневой `.env` и конфигурация окружения. |
| `src/database/connection.ts` | Единственное подключение SQLite/Drizzle, WAL и foreign keys. |
| `src/database/schema.ts` | Схема таблиц и Row-типы. |
| `src/database/initialize.ts` | Миграции, совместимость схемы, начальные данные. |
| `src/database/mappers.ts` | Преобразование строк БД в DTO. |
| `src/modules/` | Игровые области: auth, admin, players, locations, combat, inventory, items, mobs, shop, trades, friends, quests, casino, leaderboard. |
| `src/infrastructure/realtime/` | Socket.IO: подключения, комнаты, отправка состояний. |
| `src/infrastructure/telegram/` | Очередь уведомлений Telegram. |
| `src/http/serve-client.ts` | Статика клиента и SPA fallback. |
| `src/jobs/maintenance.ts` | Очистка событий и зависших сессий. |
| `src/shared/time.ts` | Существующие правила игрового времени UTC+4. |
| `tests/` | Тесты игровой логики и миграций на временных SQLite-базах. |
| `drizzle/` | SQL-миграции, метаданные и журнал Drizzle. |
| `data/characters/`, `data/location/` | Изображения персонажей и локаций. |
| `dist/` | Генерируемая сборка; вручную не редактируется. |

В каждом игровом модуле `routes.ts` содержит HTTP-обработчики, остальные файлы — специализированную логику. PvE, PvP и общий движок находятся в `modules/combat/`; выдача предметов — в `modules/inventory/store.ts`; сборка списка друзей — в `modules/friends/overview.ts`.

Существующие URL, socket-события, правила наград, транзакции и формат сохранения данных сохранены. Точки входа сборки остаются `dist/index.js` и `dist/bot.js`.

## Команды

Из корня репозитория:

```sh
npm run dev:server
npm run dev:bot
npm run build:prod
npm run start:prod
npm run typecheck
npm test --workspace @mmobot/server
npm run db:generate --workspace @mmobot/server
npm run db:migrate --workspace @mmobot/server
npm run db:studio --workspace @mmobot/server
```

`DATABASE_PATH` определяет путь к SQLite. Относительные пути по-прежнему разрешаются от рабочего каталога процесса. У Drizzle CLI сохранён прежний путь `./data/mmobot.db` относительно серверного workspace; при работе с конкретной базой учитывайте это различие. Структурный рефакторинг не меняет выбор базы и не переносит данные.

Исходный результат тестов и известная проблема `requireAdmin` описаны в [разделе проверок](../../docs/architecture.md#проверки).
