// "НАСТРОЙКИ" — по правилу №1 сюда попадают только переключатели, которые
// реально что-то меняют. Тема — единственная (Dark Premium), в проекте нет
// светлой темы (см. styles/tokens.css), поэтому это информационная строка,
// а не бутафорский тумблер. Пуш/email-предпочтения бэкенд не хранит
// (нет таких полей в app/web/repo.py) — вместо фейковых переключателей,
// которые ничего не переключают на сервере, честно объясняем, где реально
// управляются уведомления (в чате с Telegram-ботом).
import { getLang, t } from '../../i18n.js';
import { icon } from '../../utils/icons.js';

export function settingsSectionHTML() {
  let timezone = '—';
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* unavailable */ }

  return `
  <div class="hub-row-list">
    <button class="hub-row" data-hub-toggle-lang type="button">
      <span class="hub-row-icon">${icon('globe')}</span>
      <span class="hub-row-main"><span class="hub-row-title">${t('hub_settings_lang')}</span></span>
      <span class="hub-row-value">${getLang().toUpperCase()}</span>
    </button>
    <div class="hub-row" style="cursor:default;">
      <span class="hub-row-icon">${icon('palette')}</span>
      <span class="hub-row-main"><span class="hub-row-title">${t('hub_settings_theme')}</span></span>
      <span class="hub-row-value">Dark Premium</span>
    </div>
    <div class="hub-row" style="cursor:default;">
      <span class="hub-row-icon">${icon('clock')}</span>
      <span class="hub-row-main"><span class="hub-row-title">${t('hub_settings_timezone')}</span></span>
      <span class="hub-row-value">${timezone}</span>
    </div>
    <button class="hub-row" data-hub-open-bot type="button">
      <span class="hub-row-icon">${icon('bell')}</span>
      <span class="hub-row-main">
        <span class="hub-row-title">${t('hub_settings_notifications')}</span>
        <span class="hub-row-sub">${t('hub_settings_notifications_hint')}</span>
      </span>
      <span class="hub-row-chevron">${icon('chevronLeft')}</span>
    </button>
  </div>`;
}

export function bindSettingsSection(root, { onLangToggle }) {
  const langBtn = root.querySelector('[data-hub-toggle-lang]');
  if (langBtn) langBtn.addEventListener('click', onLangToggle);

  const botBtn = root.querySelector('[data-hub-open-bot]');
  if (botBtn) botBtn.addEventListener('click', () => window.open('https://t.me/codenexa_bot', '_blank'));
}
