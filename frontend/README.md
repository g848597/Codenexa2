# Telegram Toolkit — фронтенд (Этап 2, «Telegram Tools»)

React + TypeScript + Vite + Tailwind. Telegram Mini App с 6 инструментами
для владельцев каналов/ботов: Username Checker, Bio Generator, Deep Link
Builder, Markdown Builder, Unicode Fonts, Text Cleaner.

Подробности по архитектуре, что где лежит и что проверено — см. раздел
"Фронтенд (Этап 2)" в `../README.md` (README бэкенда, единый источник
правды по всему проекту).

## Запуск

```bash
npm install
cp .env.example .env   # VITE_API_BASE_URL -> адрес запущенного бэкенда
npm run dev
```

## Продакшн-сборка

```bash
npm run build   # -> dist/, статика, раздаётся любым static-хостингом
npm run preview # локально проверить продакшн-сборку
```

## Проверка типов

```bash
npx tsc --noEmit -p tsconfig.app.json
```

## Структура

```
src/
  modules.config.ts   — реестр 6 модулей (зеркало app/modules_registry.json на бэкенде)
  lib/
    telegram.ts        — тема + initData из window.Telegram.WebApp
    api.ts              — клиент к бэкенду
    markdown.ts          — тулбар + конвертация MD/MarkdownV2/HTML (2.4)
    unicodeFonts.ts       — unicode-стили текста (2.5)
    textCleaner.ts         — очистка текста (2.6)
  components/
    ConsolePanel.tsx    — сквозной вид результата во всех модулях
    ToolShell.tsx         — общий каркас страницы инструмента
    CopyButton.tsx          — копирование в буфер с подтверждением
  pages/                 — по одной странице на модуль + Home.tsx (сетка карточек)
```
