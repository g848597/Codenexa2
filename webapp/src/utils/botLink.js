// Единственный источник правды для username Telegram-бота на фронтенде.
//
// РАНЬШЕ username бота (codenexa_bot) был захардкожен по отдельности в 7
// разных файлах (partners.js, referralSection.js, settingsSection.js,
// organizationSection.js, supportSection.js, paymentPage.js,
// telegramLinkBanner.js). При смене бота (например, на тестовый) все эти
// ссылки продолжали вести на старого бота — часть из них вообще в чужой/
// неотвечающий аккаунт. Теперь бот загружается ОДИН раз при старте
// приложения (см. main.js -> loadBotUsername()) из
// /api/auth/telegram/bot-info (сервер знает актуальный TELEGRAM_BOT_USERNAME
// из своих переменных окружения), и все компоненты читают его отсюда.
import { authApi } from '../api/authApi.js';

let _username = null;
let _loaded = false;

/** Вызывать один раз при старте приложения (main.js), до первого рендера
 * дашборда — дальше все botLink()/getBotUsername() читают уже готовое
 * значение синхронно. */
export async function loadBotUsername() {
  try {
    const info = await authApi.getBotInfo();
    _username = info.username || null;
  } catch {
    _username = null;
  }
  _loaded = true;
  return _username;
}

/** null, пока loadBotUsername() ещё не отработал, или если сервер не
 * настроен (TELEGRAM_BOT_USERNAME пуст) — вызывающий код должен честно
 * скрыть/задизейблить ссылку в этом случае, а не подставлять заглушку. */
export function getBotUsername() {
  return _username;
}

export function isBotUsernameLoaded() {
  return _loaded;
}

/** query — строка вида '?start=ref_123' или '?startapp=org_invite_abc',
 * можно не передавать. Возвращает null, если бот не настроен — тогда
 * вызывающий код не должен рендерить кликабельную ссылку. */
export function botLink(query = '') {
  return _username ? `https://t.me/${_username}${query}` : null;
}
