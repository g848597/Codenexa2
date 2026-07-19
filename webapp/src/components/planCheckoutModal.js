// Мини-окно выбора тарифа и оплаты — общее для AI Docs и AI Sport.
//
// Раньше клик по тарифу в AI Sport просто закрывал модуль и переключал на
// вкладку "Аккаунт" (см. историю sportApp.js), а в AI Docs тариф открывал
// разворачивающийся блок прямо на той же странице — то есть в двух модулях
// было два разных, не похожих друг на друга поведения, и ни одно не было
// "мини-окном" в привычном смысле. Этот модуль — единая точка входа:
// showPlanCheckout({ plans, planCode, checkout }) рисует bottom-sheet поверх
// текущего экрана (как inv-sheet в investors.css) с выбором конкретного
// тарифа, суммой и кнопкой оплаты. Сама оплата идёт через ту же функцию
// checkout(planCode, method, network), что и раньше в каждом модуле —
// см. docsApi.checkout()/authApi.checkout(), здесь ничего не подменяется,
// только UI вокруг неё.
import { esc } from '../utils/html.js';
import { icon } from '../utils/icons.js';
import { haptic, isInsideTelegram, openInvoice, showAlert } from '../telegram.js';
import { t } from '../i18n.js';

let backdropEl = null;
let opts = null;
let ui = { step: 'pick', planCode: null, method: null, busy: false, error: null, result: null };

function planByCode(code) {
  return (opts.plans || []).find((p) => p.code === code) || null;
}

function close() {
  if (!backdropEl) return;
  backdropEl.classList.remove('is-open');
  document.body.classList.remove('pcm-lock');
  const el = backdropEl;
  backdropEl = null;
  setTimeout(() => el.remove(), 250);
}

function render() {
  if (!backdropEl) return;
  const sheet = backdropEl.querySelector('.pcm-sheet');
  sheet.innerHTML = ui.step === 'pick' ? pickStepHTML() : payStepHTML();
  wire(sheet);
}

function pickStepHTML() {
  const plans = opts.plans || [];
  return `
  <div class="pcm-handle"></div>
  <button class="pcm-close" data-pcm-close type="button">${icon('close')}</button>
  <div class="pcm-head">
    <div class="pcm-title">${t('pcm_pick_title')}</div>
    <p class="pcm-sub">${t('pcm_pick_sub')}</p>
  </div>
  <div class="pcm-plan-list">
    ${plans.map((p) => `
      <button class="pcm-plan-row" data-pcm-pick="${esc(p.code)}" type="button">
        <span class="pcm-plan-row-main">
          <span class="pcm-plan-row-title">${esc(p.title)}</span>
          ${p.durationDays ? `<span class="pcm-plan-row-days">${t('pcm_duration', p.durationDays)}</span>` : ''}
        </span>
        <span class="pcm-plan-row-price">$${esc(String(p.usd))}</span>
        ${icon('chevronRight')}
      </button>`).join('')}
  </div>`;
}

function payStepHTML() {
  const plan = planByCode(ui.planCode);
  if (!plan) return pickStepHTML();
  const showBack = (opts.plans || []).length > 1 && !opts.lockPlan;

  if (ui.result) {
    const r = ui.result;
    return `
    <div class="pcm-handle"></div>
    <button class="pcm-close" data-pcm-close type="button">${icon('close')}</button>
    <div class="pcm-result">
      <div class="pcm-result-icon">${icon(r.method === 'stars' ? 'star' : 'externalLink')}</div>
      <div class="pcm-title">${r.method === 'stars' ? t('pcm_result_stars_title') : t('pcm_result_crypto_title')}</div>
      <p class="pcm-sub">${r.method === 'stars' ? t('pcm_result_stars_sub') : t('pcm_result_crypto_sub')}</p>
      ${r.payUrl ? `<button class="pcm-pay-btn" data-pcm-open-url="${esc(r.payUrl)}" type="button">${icon('externalLink')} ${t('pcm_open_invoice_btn')}</button>` : ''}
    </div>`;
  }

  return `
  <div class="pcm-handle"></div>
  <button class="pcm-close" data-pcm-close type="button">${icon('close')}</button>
  <div class="pcm-head">
    ${showBack ? `<button class="pcm-back-link" data-pcm-back type="button">${icon('chevronLeft')} ${t('pcm_back_to_plans')}</button>` : ''}
    <div class="pcm-title">${esc(plan.title)}</div>
    <p class="pcm-sub">${t('pcm_pay_sub')}</p>
  </div>
  <div class="pcm-sum-card">
    <span class="pcm-sum-label">${t('pcm_amount_label')}</span>
    <span class="pcm-sum-value">$${esc(String(plan.usd))}</span>
    ${plan.stars ? `<span class="pcm-sum-alt">${t('pcm_or_stars', plan.stars)}</span>` : ''}
  </div>
  ${ui.error ? `<div class="pcm-error">${icon('alertTriangle')} ${esc(ui.error)}</div>` : ''}
  <div class="pcm-pay-actions">
    ${isInsideTelegram() ? `<button class="pcm-pay-btn pcm-pay-btn-primary" data-pcm-pay="stars" ${ui.busy ? 'disabled' : ''} type="button">${icon('star')} ${t('pcm_pay_stars_btn')}</button>` : ''}
    <button class="pcm-pay-btn ${isInsideTelegram() ? '' : 'pcm-pay-btn-primary'}" data-pcm-pay="cryptobot" ${ui.busy ? 'disabled' : ''} type="button">₿ ${t('pcm_pay_crypto_btn')}</button>
  </div>
  <p class="pcm-fineprint">${t('pcm_fineprint')}</p>`;
}

function wire(sheet) {
  sheet.querySelectorAll('[data-pcm-close]').forEach((b) => b.addEventListener('click', () => { haptic('light'); close(); }));

  const pickBtns = sheet.querySelectorAll('[data-pcm-pick]');
  pickBtns.forEach((b) => b.addEventListener('click', () => {
    haptic('light');
    ui.planCode = b.dataset.pcmPick;
    ui.step = 'pay';
    ui.error = null;
    ui.result = null;
    render();
  }));

  const backBtn = sheet.querySelector('[data-pcm-back]');
  if (backBtn) backBtn.addEventListener('click', () => { haptic('light'); ui.step = 'pick'; render(); });

  sheet.querySelectorAll('[data-pcm-pay]').forEach((b) => b.addEventListener('click', async () => {
    const method = b.dataset.pcmPay;
    haptic('medium');
    let network;
    if (method === 'cryptobot') {
      network = (window.prompt(t('pcm_crypto_prompt'), 'USDT') || '').trim().toUpperCase();
      if (!network) return;
    }
    ui.busy = true;
    ui.error = null;
    render();
    try {
      const result = await opts.checkout(ui.planCode, method, network);
      ui.busy = false;
      if (method === 'stars' && result && result.invoiceLink) {
        if (isInsideTelegram()) {
          openInvoice(result.invoiceLink, (status) => {
            if (status === 'paid') {
              haptic('medium');
              showAlert(t('pcm_paid_alert'));
              if (opts.onSuccess) opts.onSuccess();
              close();
            }
          });
          ui.result = result;
          render();
        } else {
          showAlert(t('pcm_stars_telegram_only'));
        }
      } else {
        ui.result = result || { method };
        render();
      }
    } catch (e) {
      ui.busy = false;
      ui.error = (e && e.message) || t('pcm_checkout_error');
      render();
    }
  }));

  const openUrlBtn = sheet.querySelector('[data-pcm-open-url]');
  if (openUrlBtn) openUrlBtn.addEventListener('click', () => window.open(openUrlBtn.dataset.pcmOpenUrl, '_blank'));
}

// showPlanCheckout({ plans, planCode?, lockPlan?, checkout, onSuccess? })
// plans      — [{ code, title, usd, stars, durationDays }] (реальные тарифы,
//              как из authApi.plans()/docsApi.getPlans())
// planCode   — если передан, окно сразу открывается на шаге оплаты этого
//              тарифа; иначе — сперва список тарифов на выбор
// lockPlan   — true, если нельзя вернуться к списку (окно открыто с одной
//              конкретной карточки тарифа)
// checkout   — async (planCode, method, network) => { method, invoiceLink?, payUrl? }
// onSuccess  — вызывается после успешной оплаты Stars (см. openInvoice выше)
export function showPlanCheckout(config) {
  opts = config;
  ui = {
    step: config.planCode ? 'pay' : 'pick',
    planCode: config.planCode || null,
    method: null,
    busy: false,
    error: null,
    result: null,
  };

  backdropEl = document.createElement('div');
  backdropEl.className = 'pcm-backdrop';
  backdropEl.innerHTML = `<div class="pcm-sheet" role="dialog" aria-modal="true"></div>`;
  document.body.appendChild(backdropEl);
  document.body.classList.add('pcm-lock');

  backdropEl.addEventListener('click', (e) => { if (e.target === backdropEl) close(); });

  render();
  requestAnimationFrame(() => backdropEl.classList.add('is-open'));
}
