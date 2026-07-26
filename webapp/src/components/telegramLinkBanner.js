// Мини-баннер "привяжите Telegram" — показывается после регистрации/входа
// ЛЮБЫМ способом (почта, Google, Яндекс) и снова при каждом повторном входе,
// пока пользователь либо не привяжет Telegram, либо не нажмёт "Не показывать
// больше". Смысл: большинство оплат и уведомлений теперь идут через Telegram
// (см. app/web/api/auth.py: /telegram/link, /telegram/dismiss-prompt), и без
// привязки пользователь может не узнать об оплате/напоминании.
//
// Клик по "Привязать Telegram":
//  - внутри Telegram (подавляющее большинство сессий — даже email/Google/
//    Яндекс-логин у этого продукта происходит из WebView Telegram) initData
//    уже подписана клиентом, ничего вводить не нужно — один запрос и готово;
//  - снаружи Telegram (открыли ссылку в обычном браузере) initData нет, и
//    подделать её нельзя — просто открываем бота, а не тычем в воздух.
import { authApi } from '../api/authApi.js';
import { getInitDataRaw, isInsideTelegram, haptic, openTelegramLink } from '../telegram.js';
import { botLink } from '../utils/botLink.js';

const BANNER_ID = 'tg-link-banner';

function icon() {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21.05 3.16 2.9 10.28c-1.23.5-1.22 1.19-.22 1.5l4.65 1.45 1.8 5.55c.22.6.37.84.76.84.3 0 .43-.13.6-.32l2.05-1.98 4.28 3.16c.79.44 1.35.21 1.55-.73l2.8-13.2c.3-1.16-.44-1.69-1.14-1.4Z"/></svg>';
}

/** Вызывается после регистрации/входа и при каждом успешном /me. Сам решает,
 * показывать баннер или убрать его (если уже привязан или уже скрыт). */
export function maybeShowTelegramLinkBanner(user) {
  if (!user || user.hasTelegram || user.telegramPromptDismissed) {
    removeTelegramLinkBanner();
    return;
  }
  if (document.getElementById(BANNER_ID)) return; // уже показан
  renderBanner();
}

export function removeTelegramLinkBanner() {
  const el = document.getElementById(BANNER_ID);
  if (el) el.remove();
}

function renderBanner() {
  const root = document.createElement('div');
  root.id = BANNER_ID;
  root.className = 'tgb-wrap';
  root.innerHTML = `
    <div class="tgb-card">
      <div class="tgb-row">
        <div class="tgb-icon">${icon()}</div>
        <div class="tgb-text">
          Простите за неудобства — большинство оплат и уведомлений в CodeNexa теперь идут через Telegram.
          Привяжите его, чтобы точно ничего не потерять.
        </div>
      </div>
      <div class="tgb-actions">
        <button type="button" class="tgb-btn tgb-btn-primary" data-tgb-link>${icon()} Привязать Telegram</button>
        <button type="button" class="tgb-btn tgb-btn-ghost" data-tgb-dismiss>Не показывать больше</button>
      </div>
    </div>`;
  document.body.appendChild(root);

  const linkBtn = root.querySelector('[data-tgb-link]');
  linkBtn.addEventListener('click', async () => {
    if (!isInsideTelegram()) {
      // Нет подписанной initData вне Telegram — честно ведём в бота, а не
      // притворяемся, что привязали без проверки личности.
      const link = botLink();
      if (!link) {
        haptic('light');
        return; // сервер не знает username бота (не настроен TELEGRAM_BOT_USERNAME) — вести некуда
      }
      openTelegramLink(link);
      return;
    }
    linkBtn.disabled = true;
    const originalLabel = linkBtn.innerHTML;
    linkBtn.innerHTML = 'Секунду…';
    try {
      await authApi.linkTelegram(getInitDataRaw());
      haptic('medium');
      removeTelegramLinkBanner();
    } catch (e) {
      linkBtn.disabled = false;
      linkBtn.innerHTML = originalLabel;
      let err = root.querySelector('.tgb-error');
      if (!err) {
        err = document.createElement('div');
        err.className = 'tgb-error';
        root.querySelector('.tgb-actions').parentNode.insertBefore(err, root.querySelector('.tgb-actions'));
      }
      err.textContent = (e && e.message) || 'Не получилось привязать Telegram, попробуйте ещё раз';
    }
  });

  root.querySelector('[data-tgb-dismiss]').addEventListener('click', async () => {
    removeTelegramLinkBanner();
    try {
      await authApi.dismissTelegramPrompt();
    } catch {
      // Не критично: баннер уже скрыт локально на эту сессию, даже если
      // запрос не прошёл (например, нет связи) — просто может всплыть снова
      // в следующий раз, пользователя это не блокирует.
    }
  });
}
