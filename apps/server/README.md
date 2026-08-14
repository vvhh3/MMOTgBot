# @mmobot/server

Серверная часть MMOBot: HTTP API (Express), Telegram-бот (grammy) и работа с базой данных (SQLite + Drizzle).

## Структура и назначение папок

| Путь | Назначение |
| --- | --- |
| `src/` | Исходный код сервера (TypeScript). |
| `src/db/` | Определение схемы базы данных (Drizzle ORM). |
| `drizzle/` | Сгенерированные миграции БД (`drizzle-kit generate`). Не редактировать вручную. |
| `data/` | Файлы SQLite-базы (`mmobot.db`). Создаются автоматически. |
| `dist/` | Результат сборки (`tsc`). Генерируется, не редактировать. |
| `apps/server/data/` | Вложенная копия данных, появившаяся при запуске из другого каталога. Не нужна. |

## Назначение файлов

| Файл | Что делает |
| --- | --- |
| `package.json` | Метаданные пакета и npm-скрипты (`dev`, `build`, `db:migrate` и т.д.). |
| `tsconfig.json` | Настройки компилятора TypeScript. |
| `drizzle.config.ts` | Конфигурация drizzle-kit (путь к схеме и к миграциям). |
| `src/index.ts` | Точка входа API-сервера: создаёт Express-приложение и запускает его на `config.port`. |
| `src/app.ts` | Создание и настройка Express-приложения: CORS, JSON, все роуты (`/auth`, `/me`, `/locations/*`), раздача статики клиента. |
| `src/auth.ts` | Аутентификация: проверка Telegram `initData`, выпуск/проверка сессионных токенов, middleware `requireAuth`. |
| `src/config.ts` | Загрузка конфигурации из `.env` (токен бота, порт, пути, CORS). |
| `src/db.ts` | Подключение к SQLite через Drizzle, миграции, сид локаций, мапперы «строка БД → DTO». |
| `src/db/schema.ts` | Drizzle-схема таблиц: `locations`, `players`, `inventory_items`, `events`. |
| `src/presence.ts` | In-memory отслеживание игроков по локациям (кто где находится). |
| `src/bot.ts` | Точка входа Telegram-бота: команда `/start` и кнопка открытия Mini App. |




создать миграцию : 
- npm run db:generate --workspace @mmobot/server
