import { STAGE_META } from '../config/products.js';
import { isConnected, connectProduct } from '../state.js';
import { haptic } from '../telegram.js';
import { investorPanelHTML, wireInvestorToggles } from './investorPanel.js';
import { t, tl } from '../i18n.js';
import { icon } from '../utils/icons.js';

function sparklineEmptySVG() {
  return `<svg width="46" height="20" viewBox="0 0 64 24" class="sparkline-empty"><path d="M2,18 Q16,8 32,14 T62,10" fill="none" stroke="#82868f" stroke-width="1.6" stroke-dasharray="3 3"/></svg>`;
}

function template(p, i) {
  const stageMeta = STAGE_META[p.stage];
  const connected = isConnected(p.id);

  const metricBlock = (p.metric.value === null)
    ? `<div class="metric-empty">${t('ledger_collecting_data')} ${sparklineEmptySVG()}</div>`
    : `<div class="metric-value">${p.metric.value}${p.metric.unit}</div>`;

  return `
  <div class="ledger-card" data-id="${p.id}" data-open-product="${p.id}" style="--i:${i}">
    <div class="ledger-top">
      <div>
        <div class="ledger-name">${p.name}</div>
        <div class="ledger-tagline">${tl(p.tagline)}</div>
      </div>
      <div class="model-pill ${p.model.cls}">${tl(p.model.label)}</div>
    </div>

    <div class="stage-track">
      <div class="stage-labels">
        <span class="stage-label ${p.stage === 'validation' ? 'current' : ''}">${t('stage_validation')}</span>
        <span class="stage-label ${p.stage === 'traction' ? 'current' : ''}">${t('stage_traction')}</span>
        <span class="stage-label ${p.stage === 'scale' ? 'current' : ''}">${t('stage_scale')}</span>
      </div>
      <div class="stage-bar"><div class="stage-fill" style="width:${stageMeta.fill}"></div></div>
    </div>

    <div class="metric-row">
      <div class="metric-label">${tl(p.metric.label)}<span class="src">${tl(p.metric.source)}</span></div>
      ${metricBlock}
    </div>

    <div class="action-row">
      <button class="connect-btn ${connected ? 'connected' : ''}" data-connect="${p.id}" ${connected ? 'disabled' : ''}>
        ${connected ? `${icon('check')} ${t('ledger_connected')}` : t('ledger_connect_btn')}
      </button>
      <button class="ledger-open-btn" data-open-product-inline="${p.id}">${t('ledger_open_product_short')}</button>
    </div>

    ${investorPanelHTML(p.id, p.investor)}
  </div>`;
}

export function renderLedgerList(container, products, onChange, onOpenProduct) {
  container.innerHTML = products.map((p, i) => template(p, i)).join('');

  wireInvestorToggles(container);
  container.querySelectorAll('.investor-toggle').forEach((btn) => {
    btn.addEventListener('click', () => haptic('light'));
  });

  container.querySelectorAll('[data-connect]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.connect;
      connectProduct(id);
      haptic('medium');
      renderLedgerList(container, products, onChange, onOpenProduct); // re-render to reflect real state
      if (onChange) onChange();
    });
  });

  // Карточка целиком открывает продукт по клику — но кнопка "Открыть" внутри
  // неё имеет свой отдельный атрибут (data-open-product-inline), чтобы клик по
  // ней не всплывал до обработчика карточки и не вызывал onOpenProduct дважды
  // (двойной haptic + двойной рендер раздела продукта).
  container.querySelectorAll('[data-open-product]').forEach((el) => {
    el.addEventListener('click', () => {
      haptic('light');
      if (onOpenProduct) onOpenProduct(el.dataset.openProduct);
    });
  });

  container.querySelectorAll('[data-open-product-inline]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      haptic('light');
      if (onOpenProduct) onOpenProduct(btn.dataset.openProductInline);
    });
  });
}

