import { PRODUCTS, STAGE_META } from '../config/products.js';
import { PRODUCT_DETAILS } from '../config/productDetails.js';
import { investorPanelHTML, wireInvestorToggles } from './investorPanel.js';
import { openDocsApp } from './docsApp.js';
import { openSportApp } from './sportApp.js';
import { haptic } from '../telegram.js';
import { t, tl } from '../i18n.js';
import { icon } from '../utils/icons.js';
import { registerProductReopener, setCurrentProductId } from '../navigation.js';

// Каждый продукт с webAppEntry указывает здесь, какую функцию открытия
// вызывать — так productDetail.js не разрастается if/else по мере
// добавления новых веб-модулей (следующий бот добавляет одну строку сюда).
const WEB_APP_LAUNCHERS = {
  docs: openDocsApp,
  sport: openSportApp,
};

function statusLabel(status) {
  return t('status_' + status);
}

function stepsBlock(steps) {
  return `
  <div class="pd-block">
    <h3>${t('pd_you_get')}</h3>
    ${steps.map((s, i) => `
      <div class="pd-step">
        <div class="pd-step-num">${String(i + 1).padStart(2, '0')}</div>
        <div>
          <div class="pd-step-title">${tl(s.title)}</div>
          <div class="pd-step-desc">${tl(s.desc)}</div>
        </div>
      </div>`).join('')}
  </div>`;
}

function changelogBlock(changelog) {
  const body = changelog.length
    ? changelog.map(c => `
        <div class="pd-step">
          <div class="pd-step-num">${c.date}</div>
          <div><div class="pd-step-title">${tl(c.title)}</div><div class="pd-step-desc">${tl(c.desc)}</div></div>
        </div>`).join('')
    : `<div class="pd-empty">${t('pd_changelog_empty')}</div>`;

  return `<div class="pd-block"><h3>${t('pd_changelog_title')}</h3>${body}</div>`;
}

function techProgressBlock(techProgress) {
  if (!techProgress) return '';
  return `
  <div class="pd-block">
    <h3>${t('pd_tech_status_title')}</h3>
    <span class="hint">${t('pd_tech_status_hint')}</span>
    ${techProgress.map(item => `
      <div class="pd-progress-item">
        <span>${tl(item.label)}</span>
        <span class="pd-progress-status ${item.status}">${statusLabel(item.status)}</span>
      </div>`).join('')}
  </div>`;
}

function liveSlotBlock(hasSlot) {
  if (!hasSlot) return '';
  return `
  <div class="pd-block">
    <h3>${t('pd_live_title')}</h3>
    <div class="pd-live-slot">
      <div class="dot"></div>
      <p>${t('pd_live_desc')}</p>
    </div>
  </div>`;
}

export function renderProductDetail(container, productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  const details = PRODUCT_DETAILS[productId];
  if (!product || !details) return;

  const stageMeta = STAGE_META[product.stage];

  container.innerHTML = `
    <button class="pd-back" data-pd-back>${t('pd_back')}</button>
    <div class="pd-head">
      <div class="pd-head-top">
        <div>
          <div class="pd-name">${product.name}</div>
          <div class="pd-tagline">${tl(product.tagline)}</div>
        </div>
        <div class="model-pill ${product.model.cls}">${tl(product.model.label)}</div>
      </div>
      <div class="stage-track">
        <div class="stage-labels">
          <span class="stage-label ${product.stage === 'validation' ? 'current' : ''}">${t('stage_validation')}</span>
          <span class="stage-label ${product.stage === 'traction' ? 'current' : ''}">${t('stage_traction')}</span>
          <span class="stage-label ${product.stage === 'scale' ? 'current' : ''}">${t('stage_scale')}</span>
        </div>
        <div class="stage-bar"><div class="stage-fill" style="width:${stageMeta.fill}"></div></div>
      </div>
    </div>

    ${stepsBlock(details.steps)}
    ${techProgressBlock(details.techProgress)}
    ${liveSlotBlock(details.liveDataSlot)}
    ${changelogBlock(details.changelog)}

    ${product.webAppEntry ? `<div class="pd-block"><button class="pd-launch-btn" data-launch-webapp>${icon('rocket')} Открыть ${product.name} ${icon('arrowRight')}</button></div>` : ''}

    <div class="pd-block">${investorPanelHTML('pd-' + product.id, product.investor)}</div>
  `;

  wireInvestorToggles(container);
  container.querySelector('[data-pd-back]').addEventListener('click', () => {
    haptic('light');
    closeProductView();
  });

  const launchBtn = container.querySelector('[data-launch-webapp]');
  if (launchBtn) {
    launchBtn.addEventListener('click', () => {
      haptic('medium');
      const launch = WEB_APP_LAUNCHERS[product.id];
      if (launch) launch();
    });
  }
}

let lastActiveTabView = 'dashboard';
let lastOpenProductId = null;

export function openProductView(productId) {
  // Запоминаем вкладку, только если она реально активна в этот момент.
  // Если продукт открывают повторно поверх уже открытого продукта (через
  // reopenProduct из navigation.js — например, при закрытии Sport/Docs/Legal),
  // ни одна вкладка не активна, и трогать lastActiveTabView не нужно, иначе
  // мы затрём уже корректно сохранённое значение.
  const activeTab = document.querySelector('.tab.active');
  if (activeTab) lastActiveTabView = activeTab.dataset.view;
  lastOpenProductId = productId;
  setCurrentProductId(productId);

  document.querySelectorAll('.tab').forEach(tabEl => tabEl.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-product').classList.add('active');

  renderProductDetail(document.getElementById('view-product'), productId);
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

// Регистрируем себя как "открыватель" продукта для navigation.js, чтобы
// docsApp.js/sportApp.js/legal.js могли вернуть пользователя на страницу
// продукта, не импортируя productDetail.js напрямую (иначе получился бы
// цикл импортов).
registerProductReopener(openProductView);

// Re-renders the currently open product view in place (used after a language
// toggle so the open section reflects the new language without navigating away).
export function rerenderOpenProductView() {
  if (!lastOpenProductId) return;
  const view = document.getElementById('view-product');
  if (view && view.classList.contains('active')) {
    renderProductDetail(view, lastOpenProductId);
  }
}

export function closeProductView() {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + lastActiveTabView).classList.add('active');
  const tab = document.querySelector(`.tab[data-view="${lastActiveTabView}"]`);
  if (tab) tab.classList.add('active');
}
