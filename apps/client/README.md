# @mmobot/client

Telegram Mini App на React, Vite, Radix Themes и Tailwind CSS.

- `src/main.tsx` — запуск React и провайдеры.
- `src/app/` — состояние приложения, маршруты, каркас экранов, сборка модальных окон и стили.
- `src/features/<область>/` — игровые экраны, их API, хуки и вспомогательные функции.
- `src/shared/` — HTTP/Socket.IO, Telegram WebApp, общие компоненты и работа с изображениями.
- `public/` — статические файлы клиента.

Подробная карта экранов и правила размещения кода: [архитектура проекта](../../docs/architecture.md).

Из корня: `npm run dev:client`, `npm run typecheck`, `npm run build:prod`. Переменные Vite читаются из корневого `.env` через `vite.config.ts`. Публичные URL и маршруты экранов сохранены.
