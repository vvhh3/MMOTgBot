// Игровое время: часовой пояс UTC+4.
// Смещение в миллисекундах. ВСЕ метки времени в системе хранятся и считаются
// в этом поясе (включая lastRegenTime для регенерации). При расчётах разниц
// времени используй nowGameTimeMs(), а не Date.now() — иначе сдвиг на 4 часа
// сломает вычисления (дельта уйдёт в минус).
const GAME_OFFSET_MS = 4 * 60 * 60 * 1000;

// "Сейчас" в UTC+4 (ISO-строка) — для хранения и отображения времени.
export const nowGameTime = (): string => new Date(Date.now() + GAME_OFFSET_MS).toISOString();

// "Сейчас" в UTC+4 в миллисекундах — для расчёта разниц между метками времени.
export const nowGameTimeMs = (): number => Date.now() + GAME_OFFSET_MS;

// Сегодняшняя дата в UTC+4 ("2026-08-20") — граница дня для ежедневных квестов.
export const todayGameDate = (): string => nowGameTime().slice(0, 10);