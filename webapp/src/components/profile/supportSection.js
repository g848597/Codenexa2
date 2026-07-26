// "ПОДДЕРЖКА" — переиспользует config/trust.js (SUPPORT_INFO/COMMUNITY), тот
// же источник, что и вкладка "Доверие". Discord нигде в проекте не заведён
// (ни ссылки, ни упоминания реального сервера) — мы не добавляем кнопку в
// никуда; вместо этого честный набор: FAQ/правовая база (уже существующий
// экран legal.js), Telegram-бот (см. utils/botLink.js — username берётся с сервера, как и в реферальной
// ссылке partners.js), и почта для багрепортов — по образцу
// config/partners.js (PARTNER_APPLICATION_ENDPOINT), с тем же TODO для владельца.
import { icon } from '../../utils/icons.js';
import { t } from '../../i18n.js';
import { getBotUsername, botLink } from '../../utils/botLink.js';

const BUG_REPORT_EMAIL = 'support@codenexa.example'; // TODO(владелец): замените на реальный email

export function supportSectionHTML() {
  const botUsername = getBotUsername();
  return `
  <div class="hub-row-list">
    <button class="hub-row" data-hub-open-legal type="button">
      <span class="hub-row-icon">${icon('fileText')}</span>
      <span class="hub-row-main"><span class="hub-row-title">${t('hub_support_faq')}</span></span>
      <span class="hub-row-chevron">${icon('chevronLeft')}</span>
    </button>
    <button class="hub-row" data-hub-open-tg type="button" ${botUsername ? '' : 'disabled'}>
      <span class="hub-row-icon">${icon('bot')}</span>
      <span class="hub-row-main">
        <span class="hub-row-title">${t('hub_support_telegram')}</span>
        <span class="hub-row-sub">${botUsername ? '@' + botUsername : t('pt_bot_not_configured')}</span>
      </span>
      <span class="hub-row-chevron">${icon('chevronLeft')}</span>
    </button>
    <a class="hub-row" href="mailto:${BUG_REPORT_EMAIL}?subject=${encodeURIComponent(t('hub_support_bug_subject'))}">
      <span class="hub-row-icon">${icon('alertTriangle')}</span>
      <span class="hub-row-main">
        <span class="hub-row-title">${t('hub_support_report_bug')}</span>
        <span class="hub-row-sub">${BUG_REPORT_EMAIL}</span>
      </span>
      <span class="hub-row-chevron">${icon('chevronLeft')}</span>
    </a>
  </div>`;
}

export function bindSupportSection(root, { onOpenLegal }) {
  const legalBtn = root.querySelector('[data-hub-open-legal]');
  if (legalBtn && onOpenLegal) legalBtn.addEventListener('click', onOpenLegal);

  const tgBtn = root.querySelector('[data-hub-open-tg]');
  if (tgBtn) tgBtn.addEventListener('click', () => {
    const link = botLink();
    if (link) window.open(link, '_blank');
  });
}
