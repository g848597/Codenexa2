// Общий шаблон "инвесторского слоя" — переиспользуется в growth-ledger карточке
// (Модуль 1) и в полноценном разделе продукта (Модуль 3), чтобы не плодить два языка.
import { t, tl } from '../i18n.js';

// Какие панели сейчас раскрыты — по id таргета (напр. "inv-docs"), в рамках
// всей сессии страницы, а не только текущего DOM-узла. Раньше это состояние
// жило исключительно в DOM (.open класс + inline maxHeight), поэтому любой
// полный ре-рендер списка карточек (например, ledgerCard.js при подключении
// продукта — connectProduct() перерисовывает весь container.innerHTML) молча
// схлопывал все открытые инвесторские панели, включая те, что человек только
// что раскрыл на других карточках. Теперь состояние переживает ре-рендер.
const openPanels = new Set();

export function investorPanelHTML(id, investor) {
  const target = `inv-${id}`;
  const isOpen = openPanels.has(target);
  return `
  <button class="investor-toggle ${isOpen ? 'open' : ''}" data-target="${target}">
    <span>${t('investor_toggle')}</span><span class="chev">▾</span>
  </button>
  <div class="investor-panel" id="${target}">
    <div class="investor-panel-inner">
      <div class="row"><span class="k">${t('investor_role')}</span><span class="v">${tl(investor.role)}</span></div>
      <div class="row"><span class="k">${t('investor_economics')}</span><span class="v">${tl(investor.economics)}</span></div>
      <div class="row"><span class="k">${t('investor_risk')}</span><span class="v">${tl(investor.risk)}</span></div>
    </div>
  </div>`;
}

export function wireInvestorToggles(container) {
  container.querySelectorAll('.investor-toggle').forEach((btn) => {
    // Панель уже отмечена открытой в разметке (см. investorPanelHTML выше) —
    // проставляем реальную высоту сразу, без анимации, чтобы не открывать её
    // "заново" визуально при каждом ре-рендере.
    if (btn.classList.contains('open')) {
      const panel = document.getElementById(btn.dataset.target);
      if (panel) panel.style.maxHeight = panel.scrollHeight + 'px';
    }

    if (btn.dataset.wired) return;
    btn.dataset.wired = '1';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const panel = document.getElementById(btn.dataset.target);
      const isOpen = btn.classList.contains('open');
      if (isOpen) {
        panel.style.maxHeight = '0px';
        btn.classList.remove('open');
        openPanels.delete(btn.dataset.target);
      } else {
        panel.style.maxHeight = panel.scrollHeight + 'px';
        btn.classList.add('open');
        openPanels.add(btn.dataset.target);
      }
    });
  });
}
