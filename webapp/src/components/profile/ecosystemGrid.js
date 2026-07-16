// "CODE NEXA ECOSYSTEM" — центральный блок HUB'а. Рендерит РЕАЛЬНЫЙ каталог
// из config/products.js (сейчас 4 продукта, но карточка не рассчитана на
// фиксированное число — см. комментарий там же). Мы не добавляем сюда
// вымышленные "CRM/Finance/News/..." карточки, которых нет в каталоге:
// это страница логина/биллинга реального продукта, и придуманные сервисы
// были бы прямой ложью пользователю о том, что у него в аккаунте — ровно то,
// что правило №1 проекта запрещает (см. config/products.js, шапка файла).
import { PRODUCTS } from '../../config/products.js';
import { isConnected, connectProduct } from '../../state.js';
import { haptic } from '../../telegram.js';
import { openProductView } from '../productDetail.js';
import { t, tl } from '../../i18n.js';
import { icon } from '../../utils/icons.js';

const PRODUCT_ICON = {
  sport: 'stadium',
  docs: 'fileText',
  automation: 'zap',
  premium: 'crown',
};

function statusFor(product) {
  if (isConnected(product.id)) return { cls: 'status-active', label: t('hub_status_active') };
  if (product.stage === 'validation') return { cls: 'status-soon', label: t('hub_status_soon') };
  return { cls: 'status-available', label: t('hub_status_available') };
}

function cardHTML(p, i) {
  const status = statusFor(p);
  return `
  <div class="hub-eco-card ${isConnected(p.id) ? 'is-connected' : ''}" data-hub-open-product="${p.id}" style="--i:${i}">
    <div class="hub-eco-icon">${icon(PRODUCT_ICON[p.id] || 'puzzle')}</div>
    <span class="hub-eco-status ${status.cls}">${status.label}</span>
    <div class="hub-eco-name">${p.name}</div>
    <div class="hub-eco-tagline">${tl(p.tagline)}</div>
    <div class="hub-eco-open">${t('hub_open_btn')} ${icon('arrowRight')}</div>
  </div>`;
}

export function ecosystemGridHTML() {
  return `
  <div class="hub-eco-grid">
    ${PRODUCTS.map(cardHTML).join('')}
  </div>
  <p class="hub-empty-note" style="margin-top:12px;">${t('hub_ecosystem_note')}</p>`;
}

export function bindEcosystemGrid(root, onChange) {
  root.querySelectorAll('[data-hub-open-product]').forEach((card) => {
    card.addEventListener('click', () => {
      haptic('light');
      const id = card.dataset.hubOpenProduct;
      // Первое открытие продукта из HUB'а также помечает его "подключённым" —
      // тот же локальный сигнал, что и кнопка "Подключить" на дэшборде
      // (см. state.js/ledgerCard.js), просто с другой точкой входа.
      if (!isConnected(id)) {
        connectProduct(id);
        if (onChange) onChange();
      }
      openProductView(id);
    });
  });
}
