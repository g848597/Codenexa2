/**
 * Тонкая обёртка над window.Telegram.WebApp вместо подключения полного
 * @telegram-apps/sdk — Этап 1 (01-core-foundation.md) его упоминает, но
 * фронтенд с нуля в этом чате не собирался, а для тем/initData/back-button
 * хватает официального telegram-web-app.js (подключён в index.html).
 * Если позже понадобятся более сложные возможности SDK (haptics,
 * CloudStorage и т.д.), эту обёртку можно заменить на @telegram-apps/sdk
 * без изменения контракта getTelegram()/getInitData() ниже.
 */

type ThemeParams = Record<string, string | undefined>;

interface TelegramWebApp {
  initData: string;
  colorScheme: "light" | "dark";
  themeParams: ThemeParams;
  ready: () => void;
  expand: () => void;
  onEvent: (event: string, cb: () => void) => void;
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

// Соответствие полей themeParams нашим CSS-переменным (см. index.css).
// Ключи — то, что реально присылает Telegram, значения — наши токены.
const THEME_MAP: Record<string, string> = {
  bg_color: "--color-bg",
  secondary_bg_color: "--color-surface-2",
  section_bg_color: "--color-surface",
  text_color: "--color-text",
  hint_color: "--color-muted",
  button_color: "--color-accent",
  section_separator_color: "--color-border",
};

export function getTelegram(): TelegramWebApp | null {
  return typeof window !== "undefined" ? window.Telegram?.WebApp ?? null : null;
}

export function isInsideTelegram(): boolean {
  const tg = getTelegram();
  return Boolean(tg && tg.initData);
}

/** initData для заголовка `Authorization: tma <initData>` (см. app/deps.py на бэкенде).
 * Вне Telegram возвращает null — вызывающий код должен уметь работать без авторизации
 * (все инструменты Этапа 2 сами по себе анонимны, кроме сохранения в историю). */
export function getInitData(): string | null {
  const tg = getTelegram();
  return tg?.initData || null;
}

/** Накладывает реальную тему Telegram поверх дефолтных CSS-переменных.
 * Если приложение открыто не в Telegram — ничего не делает, остаются
 * значения из :root/prefers-color-scheme в index.css. */
export function applyTelegramTheme(): void {
  const tg = getTelegram();
  if (!tg) return;

  tg.ready();
  tg.expand();

  const root = document.documentElement.style;
  const apply = (params: ThemeParams) => {
    for (const [tgKey, cssVar] of Object.entries(THEME_MAP)) {
      const value = params[tgKey];
      if (value) root.setProperty(cssVar, value);
    }
  };
  apply(tg.themeParams);
  tg.onEvent("themeChanged", () => apply(tg.themeParams));
}
