import { LEGAL_STATUS, PRIVACY_POLICY, TERMS_OF_USE, PARTNER_TERMS } from '../config/legal.js';
import { t, tl } from '../i18n.js';
import { captureReturnTarget, getReturnTarget, reopenProductIfNeeded } from '../navigation.js';

function docs() {
  return [
    { id: 'privacy', label: t('legal_doc_privacy'), data: PRIVACY_POLICY },
    { id: 'terms', label: t('legal_doc_terms'), data: TERMS_OF_USE },
    { id: 'partner-terms', label: t('legal_doc_partner_terms'), data: PARTNER_TERMS },
  ];
}

let activeDoc = 'privacy';

function statusBanner() {
  if (LEGAL_STATUS === 'reviewed') return '';
  return `
  <div class="honesty-note">
    <div class="dot"></div>
    <p>${t('legal_draft_banner')}</p>
  </div>`;
}

function docBody(doc) {
  return `
  <div class="legal-doc">
    <div class="legal-doc-meta">${doc.data.updatedAt ? t('legal_updated', doc.data.updatedAt) : t('legal_pending_review')}</div>
    ${doc.data.sections.map(s => `
      <div class="legal-section">
        <h4>${tl(s.title)}</h4>
        <p>${tl(s.body)}</p>
      </div>`).join('')}
  </div>`;
}

export function renderLegal(container) {
  const DOCS = docs();
  container.innerHTML = `
    <button class="pd-back" data-legal-back>${t('legal_back')}</button>
    <div class="section-head" style="margin-top:6px;">
      <h2>${t('legal_header_title')}</h2>
      <span>${t('legal_header_tag')}</span>
    </div>
    ${statusBanner()}
    <div class="legal-tabs">
      ${DOCS.map(d => `<div class="legal-tab ${activeDoc === d.id ? 'active' : ''}" data-legal-doc="${d.id}">${d.label}</div>`).join('')}
    </div>
    ${docBody(DOCS.find(d => d.id === activeDoc))}
  `;

  container.querySelectorAll('[data-legal-doc]').forEach((el) => {
    el.addEventListener('click', () => {
      activeDoc = el.dataset.legalDoc;
      renderLegal(container);
    });
  });

  const backBtn = container.querySelector('[data-legal-back]');
  if (backBtn) backBtn.addEventListener('click', closeLegalView);
}

let legalViewOpen = false;

export function openLegalView() {
  // Футер с ссылкой на документы виден на любом экране, включая страницу
  // продукта — раньше "назад" из документов всегда уводил на дашборд, даже
  // если их открыли со страницы продукта (см. navigation.js).
  captureReturnTarget();
  legalViewOpen = true;

  document.querySelectorAll('.tab').forEach(tabEl => tabEl.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-legal').classList.add('active');

  renderLegal(document.getElementById('view-legal'));
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

// Re-renders the legal view in place after a language toggle, if it's currently open.
export function rerenderOpenLegalView() {
  if (!legalViewOpen) return;
  const view = document.getElementById('view-legal');
  if (view && view.classList.contains('active')) {
    renderLegal(view);
  }
}

export function closeLegalView() {
  legalViewOpen = false;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = getReturnTarget();
  if (reopenProductIfNeeded(target)) return;
  const targetView = document.getElementById('view-' + target.view);
  if (targetView) targetView.classList.add('active');
  const tab = document.querySelector(`.tab[data-view="${target.view}"]`);
  if (tab) tab.classList.add('active');
}
