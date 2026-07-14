import { PRODUCTS } from '../config/products.js';
import { getTelegramUser } from '../telegram.js';
import { connectedCount, connectProduct, isConnected } from '../state.js';
import { haptic } from '../telegram.js';
import { t } from '../i18n.js';
import { esc } from '../utils/html.js';

// Имя приходит из Telegram-профиля пользователя (u.first_name) — это ввод,
// который человек полностью контролирует сам, и весь остальной проект (esc()
// в docsApp.js/sportApp.js/trust.js/partners.js) экранирует такие поля перед
// вставкой в innerHTML. Раньше здесь этого не было — несогласованность с
// остальным кодом, а не осознанное решение.

function nextSuggestion() {
  const notConnected = PRODUCTS.find(p => !isConnected(p.id));
  return notConnected ? notConnected.name : null;
}

export function renderHero(root, onChange) {
  const user = getTelegramUser();
  const greeting = user && user.firstName ? `, ${esc(user.firstName)}` : '';
  const count = connectedCount();
  const total = PRODUCTS.length;

  if (count === 0) {
    root.innerHTML = `
      <div class="hero-eyebrow">${t('hero_welcome_first')}${greeting} · ${t('current_period')}</div>
      <h1>${t('hero_h1_first')}</h1>
      <p>${t('hero_p_first')}</p>
      <div class="empty-state">
        <h3>${t('hero_empty_title')}</h3>
        <p>${t('hero_empty_desc', nextSuggestion())}</p>
        <button data-quick-connect="${PRODUCTS[0].id}">${t('hero_empty_button', PRODUCTS[0].name)}</button>
      </div>
      <div class="honesty-note">
        <div class="dot"></div>
        <p>${t('hero_honesty')}</p>
      </div>`;

    root.querySelector('[data-quick-connect]').addEventListener('click', (e) => {
      connectProduct(e.target.dataset.quickConnect);
      haptic('medium');
      if (onChange) onChange();
    });
    return;
  }

  const next = nextSuggestion();
  root.innerHTML = `
    <div class="hero-eyebrow">${t('hero_welcome_back')}${greeting} · ${t('current_period')}</div>
    <h1>${t('hero_h1_back')}</h1>
    <p>${t('hero_p_back')}</p>
    <div class="progress-strip">
      <span class="p-label">${t('hero_progress_of', count, total)}</span>
      <div class="p-track"><div class="p-fill" style="width:${(count / total) * 100}%"></div></div>
      ${next ? `<span class="p-label">→ ${next}</span>` : `<span class="p-label">${t('hero_progress_all')}</span>`}
    </div>`;
}
