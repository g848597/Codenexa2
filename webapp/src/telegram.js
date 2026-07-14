// Тонкая обёртка над Telegram WebApp SDK. Безопасный fallback, если открыто вне Telegram
// (например, в обычном браузере при разработке).

export function initTelegram() {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (!tg) return null;
  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor && tg.setHeaderColor('#0a0b0d');
    tg.setBackgroundColor && tg.setBackgroundColor('#0a0b0d');
  } catch {
    // running outside a real Telegram client — fine, degrade silently
  }
  return tg;
}

export function haptic(style = 'light') {
  try {
    window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
  } catch { /* no-op outside Telegram */ }
}

// Только реальные поля профиля Telegram — никогда не придумываем "историю использования".
export function getTelegramUser() {
  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    const u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (!u) return null;
    return {
      id: u.id || null,
      firstName: u.first_name || null,
      languageCode: u.language_code || null,
    };
  } catch {
    return null;
  }
}

// Сырая строка initData — единственное, что реально подтверждает личность
// пользователя (подпись проверяется на бэкенде, см. app/web/api/telegram_auth.py).
// Используется как есть в заголовке Authorization: `tma <initData>` (docsApp.js).
export function getInitDataRaw() {
  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    return (tg && tg.initData) || '';
  } catch {
    return '';
  }
}

export function isInsideTelegram() {
  return !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData);
}

// Deep-link параметр запуска (t.me/bot/app?startapp=sport). Позволяет холодному
// трафику попадать сразу на нужный экран вместо каталога продуктов — см.
// CODENEXA_STRATEGY.md §2. Проверяем both initDataUnsafe (внутри Telegram) и
// URL query (на случай прямого открытия ссылки в браузере при разработке).
export function getStartParam() {
  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    const fromTg = tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param;
    if (fromTg) return String(fromTg);
  } catch { /* no-op outside Telegram */ }
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('tgWebAppStartParam') || params.get('startapp') || null;
  } catch {
    return null;
  }
}

// Открывает Telegram Stars инвойс (ссылка от bot.create_invoice_link на бэкенде).
// onClosed(status) получает 'paid' | 'cancelled' | 'failed' | 'pending'.
export function openInvoice(invoiceLink, onClosed) {
  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.openInvoice) {
      tg.openInvoice(invoiceLink, (status) => onClosed && onClosed(status));
      return true;
    }
  } catch { /* no-op outside Telegram */ }
  return false;
}

export function openTelegramLink(url) {
  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.openTelegramLink) {
      tg.openTelegramLink(url);
      return true;
    }
  } catch { /* no-op outside Telegram */ }
  window.open(url, '_blank');
  return false;
}

// Для внешних (не t.me) ссылок — например OAuth-редиректов на accounts.google.com
// или oauth.yandex.ru. tg.openLink открывает системный браузер, что нужно для
// корректной работы стороннего OAuth (внутри WebView Telegram он не всегда проходит).
export function openExternalLink(url) {
  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.openLink) {
      tg.openLink(url, { try_instant_view: false });
      return true;
    }
  } catch { /* no-op outside Telegram */ }
  window.open(url, '_blank');
  return false;
}

export function showAlert(message) {
  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.showAlert) {
      tg.showAlert(message);
      return;
    }
  } catch { /* fallthrough */ }
  window.alert(message);
}
