// Отдельная полноэкранная страница оплаты тарифа.
//
// В отличие от components/planCheckoutModal.js (маленькое bottom-sheet
// мини-окно) — это самостоятельная "страница": открывается на весь экран
// поверх текущего раздела при клике "Оплатить" на карточке тарифа (см.
// openPaymentPage(), вызывается из sportApp.js/docsApp.js так же, как раньше
// вызывался showPlanCheckout — тот же контракт checkout(planCode, method, extra)).
//
// Способы оплаты:
//   - cryptobot     — существующий счёт в @CryptoBot (см. app/web/integrations/cryptobot.py),
//                     подтверждается вебхуком автоматически;
//   - crypto_manual — ручной перевод: пользователь выбирает монету и сеть,
//                     видит адрес кошелька (app/web/api/billing.py::manual_methods),
//                     переводит сам, оплата подтверждается администратором вручную;
//   - card          — ручной перевод на карту: реквизиты показываются сразу,
//                     тоже подтверждается администратором вручную;
//   - stars         — Telegram Stars, тот же openInvoice()-флоу, что и в
//                     planCheckoutModal.js, только внутри полноэкранной страницы.
//
// Ничего не удаляет и не заменяет planCheckoutModal.js — это параллельный,
// более "витринный" UI поверх того же billing-API.
import { esc } from '../utils/html.js';
import { icon } from '../utils/icons.js';
import { haptic, isInsideTelegram, openInvoice, showAlert } from '../telegram.js';
import { t } from '../i18n.js';
import { botLink } from '../utils/botLink.js';

let rootEl = null;
let opts = null;
let manualMethodsPromise = null;
let ui = {
  step: 'pick', // 'pick' | 'method' | 'crypto-setup' | 'result'
  planCode: null,
  method: null,
  cryptoAsset: 'USDT',
  cryptoNetwork: null,
  manual: null, // { card, crypto } — кэш /api/billing/manual-methods
  busy: false,
  error: null,
  result: null,
  copiedKey: null,
};

function planByCode(code) {
  return (opts.plans || []).find((p) => p.code === code) || null;
}

function close() {
  if (!rootEl) return;
  rootEl.classList.remove('is-open');
  document.body.classList.remove('pp-lock');
  const el = rootEl;
  rootEl = null;
  setTimeout(() => el.remove(), 220);
}

function loadManualMethods() {
  if (!manualMethodsPromise) manualMethodsPromise = opts.getManualMethods().catch(() => null);
  return manualMethodsPromise;
}

function render() {
  if (!rootEl) return;
  const body = rootEl.querySelector('.pp-body');
  body.innerHTML = stepHTML();
  wire(body);
}

// ---------------------------------------------------------------------------
// Декоративные SVG-иллюстрации для карточек способов оплаты
// ---------------------------------------------------------------------------

function svgCryptobot() {
  return `<svg viewBox="0 0 64 64" class="pp-method-art" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="30" fill="url(#pp-g-steel)"/>
    <rect x="17" y="24" width="30" height="22" rx="6" fill="var(--bg)" opacity="0.92"/>
    <rect x="21" y="28" width="22" height="14" rx="3" fill="none" stroke="var(--steel)" stroke-width="1.6"/>
    <circle cx="27" cy="35" r="2.1" fill="var(--steel)"/>
    <circle cx="37" cy="35" r="2.1" fill="var(--steel)"/>
    <path d="M30 20v-5M34 20v-5" stroke="var(--steel)" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="32" cy="13" r="2" fill="var(--steel)"/>
    <path d="M14 32h4M46 32h4" stroke="var(--steel)" stroke-width="1.8" stroke-linecap="round"/>
    <defs><radialGradient id="pp-g-steel" cx="0.3" cy="0.25" r="0.9">
      <stop offset="0" stop-color="var(--steel)" stop-opacity="0.35"/>
      <stop offset="1" stop-color="var(--steel)" stop-opacity="0.05"/>
    </radialGradient></defs>
  </svg>`;
}

function svgCrypto() {
  return `<svg viewBox="0 0 64 64" class="pp-method-art" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="30" fill="url(#pp-g-ledger)"/>
    <circle cx="27" cy="38" r="13" fill="var(--bg)" opacity="0.92" stroke="var(--ledger)" stroke-width="1.6"/>
    <circle cx="38" cy="27" r="13" fill="var(--bg)" opacity="0.85" stroke="var(--ledger-deep)" stroke-width="1.6"/>
    <path d="M35 24.5c1.6.3 2.6 1.2 2.6 2.4 0 1.5-1.6 2.3-3.6 2.3s-3.6-.9-3.6-2.4" stroke="var(--ledger)" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M38 22.3v11" stroke="var(--ledger)" stroke-width="1.4" stroke-linecap="round"/>
    <defs><radialGradient id="pp-g-ledger" cx="0.3" cy="0.25" r="0.9">
      <stop offset="0" stop-color="var(--ledger)" stop-opacity="0.35"/>
      <stop offset="1" stop-color="var(--ledger)" stop-opacity="0.05"/>
    </radialGradient></defs>
  </svg>`;
}

function svgCard() {
  return `<svg viewBox="0 0 64 64" class="pp-method-art" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="30" fill="url(#pp-g-amber)"/>
    <rect x="15" y="21" width="34" height="23" rx="4" fill="var(--bg)" opacity="0.92" stroke="var(--amber)" stroke-width="1.6"/>
    <rect x="15" y="27" width="34" height="5" fill="var(--amber)" opacity="0.7"/>
    <rect x="19" y="37" width="10" height="2.6" rx="1.3" fill="var(--amber)"/>
    <rect x="31" y="37" width="6" height="2.6" rx="1.3" fill="var(--amber)" opacity="0.6"/>
    <defs><radialGradient id="pp-g-amber" cx="0.3" cy="0.25" r="0.9">
      <stop offset="0" stop-color="var(--amber)" stop-opacity="0.35"/>
      <stop offset="1" stop-color="var(--amber)" stop-opacity="0.05"/>
    </radialGradient></defs>
  </svg>`;
}

function svgStars() {
  return `<svg viewBox="0 0 64 64" class="pp-method-art" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="30" fill="url(#pp-g-violet)"/>
    <path d="M32 18l3.6 8.2 8.9.8-6.8 5.9 2 8.7L32 37.2l-7.7 4.4 2-8.7-6.8-5.9 8.9-.8z" fill="var(--violet)"/>
    <path d="M48 20l1.3 3 3.2.3-2.4 2.1.7 3.1-2.8-1.6-2.8 1.6.7-3.1-2.4-2.1 3.2-.3z" fill="var(--violet)" opacity="0.55"/>
    <defs><radialGradient id="pp-g-violet" cx="0.3" cy="0.25" r="0.9">
      <stop offset="0" stop-color="var(--violet)" stop-opacity="0.35"/>
      <stop offset="1" stop-color="var(--violet)" stop-opacity="0.05"/>
    </radialGradient></defs>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Шаги
// ---------------------------------------------------------------------------

function headerHTML(title, sub, showBack) {
  return `
  <div class="pp-header">
    ${showBack ? `<button class="pp-back" data-pp-back type="button">${icon('chevronLeft')} ${t('pp_back_btn')}</button>` : '<span></span>'}
    <button class="pp-close" data-pp-close type="button">${icon('close')}</button>
  </div>
  <div class="pp-head-text">
    <h1 class="pp-title">${title}</h1>
    ${sub ? `<p class="pp-sub">${sub}</p>` : ''}
  </div>`;
}

function pickStepHTML() {
  const plans = opts.plans || [];
  return `
  ${headerHTML(esc(t('pp_pick_title')), esc(t('pp_pick_sub')), false)}
  <div class="pp-plan-grid">
    ${plans.map((p) => `
      <button class="pp-plan-card" data-pp-pick="${esc(p.code)}" type="button">
        <span class="pp-plan-card-title">${esc(p.title)}</span>
        ${p.durationDays ? `<span class="pp-plan-card-days">${t('pcm_duration', p.durationDays)}</span>` : ''}
        <span class="pp-plan-card-price">$${esc(String(p.usd))}</span>
        ${icon('chevronRight')}
      </button>`).join('')}
  </div>`;
}

function methodStepHTML() {
  const plan = planByCode(ui.planCode);
  if (!plan) return pickStepHTML();
  const showBack = (opts.plans || []).length > 1 && !opts.lockPlan;
  const inTg = isInsideTelegram();

  return `
  ${headerHTML(esc(t('pp_method_title')), esc(t('pp_method_sub_plan', plan.title, plan.usd)), showBack)}
  ${ui.error ? `<div class="pp-error">${icon('alertTriangle')} ${esc(ui.error)}</div>` : ''}
  <div class="pp-method-grid">
    ${inTg ? `
    <button class="pp-method-card" data-pp-method="stars" type="button">
      ${svgStars()}
      <span class="pp-method-badge pp-method-badge-instant">${t('pp_method_badge_instant')}</span>
      <span class="pp-method-name">${t('pp_method_stars_title')}</span>
      <span class="pp-method-desc">${t('pp_method_stars_sub')}</span>
    </button>` : ''}
    <button class="pp-method-card" data-pp-method="cryptobot" type="button">
      ${svgCryptobot()}
      <span class="pp-method-badge pp-method-badge-instant">${t('pp_method_badge_instant')}</span>
      <span class="pp-method-name">${t('pp_method_cryptobot_title')}</span>
      <span class="pp-method-desc">${t('pp_method_cryptobot_sub')}</span>
    </button>
    <button class="pp-method-card" data-pp-method="crypto_manual" type="button">
      ${svgCrypto()}
      <span class="pp-method-badge pp-method-badge-manual">${t('pp_method_badge_manual')}</span>
      <span class="pp-method-name">${t('pp_method_crypto_title')}</span>
      <span class="pp-method-desc">${t('pp_method_crypto_sub')}</span>
    </button>
    <button class="pp-method-card" data-pp-method="card" type="button">
      ${svgCard()}
      <span class="pp-method-badge pp-method-badge-manual">${t('pp_method_badge_manual')}</span>
      <span class="pp-method-name">${t('pp_method_card_title')}</span>
      <span class="pp-method-desc">${t('pp_method_card_sub')}</span>
    </button>
  </div>
  <p class="pp-fineprint">${t('pp_fineprint')}</p>`;
}

function cryptoSetupStepHTML() {
  const manual = ui.manual;
  const rows = (manual && manual.crypto) || [];
  const assets = [...new Set(rows.map((r) => r.asset))];
  const networksForAsset = rows.filter((r) => r.asset === ui.cryptoAsset);
  const configuredNetworks = networksForAsset.filter((r) => r.configured);
  if (!ui.cryptoNetwork || !networksForAsset.some((r) => r.network === ui.cryptoNetwork)) {
    ui.cryptoNetwork = configuredNetworks[0] ? configuredNetworks[0].network : null;
  }

  return `
  ${headerHTML(esc(t('pp_crypto_setup_title')), esc(t('pp_crypto_setup_sub')), true)}
  ${ui.error ? `<div class="pp-error">${icon('alertTriangle')} ${esc(ui.error)}</div>` : ''}
  <div class="pp-field">
    <span class="pp-field-label">${t('pp_crypto_asset_label')}</span>
    <div class="pp-chip-row">
      ${assets.map((a) => `<button class="pp-chip ${a === ui.cryptoAsset ? 'is-active' : ''}" data-pp-asset="${esc(a)}" type="button">${esc(a)}</button>`).join('')}
    </div>
  </div>
  <div class="pp-field">
    <span class="pp-field-label">${t('pp_crypto_network_label')}</span>
    <div class="pp-chip-row">
      ${configuredNetworks.length ? configuredNetworks.map((r) => `<button class="pp-chip ${r.network === ui.cryptoNetwork ? 'is-active' : ''}" data-pp-network="${esc(r.network)}" type="button">${esc(r.network)}</button>`).join('')
        : `<p class="pp-muted">${t('pp_crypto_network_none')}</p>`}
    </div>
  </div>
  <button class="pp-cta" data-pp-continue ${(!ui.cryptoNetwork || ui.busy) ? 'disabled' : ''} type="button">
    ${ui.busy ? t('pp_busy') : t('pp_continue_btn')} ${icon('arrowRight')}
  </button>`;
}

function copyRowHTML(key, label, value) {
  return `
  <div class="pp-copy-row">
    <div class="pp-copy-row-text">
      <span class="pp-copy-row-label">${label}</span>
      <span class="pp-copy-row-value" data-pp-value="${esc(key)}">${esc(value)}</span>
    </div>
    <button class="pp-copy-btn" data-pp-copy="${esc(key)}" data-pp-copy-value="${escAttrSafe(value)}" type="button">
      ${ui.copiedKey === key ? icon('check') : icon('receipt')} ${ui.copiedKey === key ? t('pp_copied') : t('pp_copy_btn')}
    </button>
  </div>`;
}

function escAttrSafe(v) {
  return esc(String(v)).replace(/"/g, '&quot;');
}

function resultStepHTML() {
  const r = ui.result;
  if (!r) return methodStepHTML();

  if (r.method === 'stars') {
    return `
    ${headerHTML(esc(t('pp_result_stars_title')), esc(t('pp_result_stars_sub')), false)}
    <div class="pp-result-icon">${svgStars()}</div>`;
  }

  if (r.method === 'cryptobot') {
    return `
    ${headerHTML(esc(t('pp_result_cryptobot_title')), esc(t('pp_result_cryptobot_sub')), false)}
    <div class="pp-result-icon">${svgCryptobot()}</div>
    ${r.payUrl ? `<button class="pp-cta" data-pp-open-url="${esc(r.payUrl)}" type="button">${icon('externalLink')} ${t('pcm_open_invoice_btn')}</button>` : ''}`;
  }

  if (r.method === 'card') {
    if (!r.card || !r.card.number || r.card.number === '0000 0000 0000 0000') {
      return `
      ${headerHTML(esc(t('pp_result_card_title')), null, false)}
      <div class="pp-error">${icon('alertTriangle')} ${esc(t('pp_result_card_not_configured'))}</div>
      ${supportLinkHTML()}`;
    }
    return `
    ${headerHTML(esc(t('pp_result_card_title')), null, false)}
    <div class="pp-result-icon">${svgCard()}</div>
    <div class="pp-copy-card">
      ${copyRowHTML('cardNumber', t('pp_result_card_number_label'), r.card.number)}
      ${copyRowHTML('cardHolder', t('pp_result_card_holder_label'), r.card.holder)}
      ${copyRowHTML('cardBank', t('pp_result_card_bank_label'), r.card.bank)}
      ${copyRowHTML('amount', t('pp_result_card_amount_label'), `$${r.amountUsd}`)}
      ${copyRowHTML('reference', t('pp_result_reference_label'), r.reference)}
    </div>
    <p class="pp-muted">${t('pp_result_reference_hint')}</p>
    <p class="pp-fineprint">${t('pp_result_card_note')}</p>
    ${supportLinkHTML()}`;
  }

  if (r.method === 'crypto_manual') {
    return `
    ${headerHTML(esc(t('pp_result_crypto_title')), null, false)}
    <div class="pp-result-icon">${svgCrypto()}</div>
    <div class="pp-copy-card">
      ${copyRowHTML('address', t('pp_result_crypto_address_label'), r.address)}
      ${copyRowHTML('amount', t('pp_result_crypto_amount_label'), r.amountAsset ? `${r.amountAsset} ${r.asset} (${r.network})` : `$${r.amountUsd} (${r.asset} · ${r.network})`)}
      ${copyRowHTML('reference', t('pp_result_reference_label'), r.reference)}
    </div>
    <p class="pp-muted">${t('pp_result_reference_hint')}</p>
    <p class="pp-fineprint">${t('pp_result_crypto_note')}</p>
    ${supportLinkHTML()}`;
  }

  return methodStepHTML();
}

function supportLinkHTML() {
  const link = botLink();
  if (!link) return '';
  return `<a class="pp-support-link" href="${esc(link)}" target="_blank" rel="noopener">${icon('externalLink')} ${t('pp_support_btn')}</a>`;
}

function stepHTML() {
  switch (ui.step) {
    case 'pick': return pickStepHTML();
    case 'method': return methodStepHTML();
    case 'crypto-setup': return cryptoSetupStepHTML();
    case 'result': return resultStepHTML();
    default: return pickStepHTML();
  }
}

// ---------------------------------------------------------------------------
// Обработчики
// ---------------------------------------------------------------------------

async function startCheckout(method, extra) {
  ui.busy = true;
  ui.error = null;
  render();
  try {
    const result = await opts.checkout(ui.planCode, method, extra);
    ui.busy = false;

    if (method === 'stars' && result && result.invoiceLink) {
      if (isInsideTelegram()) {
        openInvoice(result.invoiceLink, (status) => {
          if (status === 'paid') {
            haptic('medium');
            showAlert(t('pp_paid_alert'));
            if (opts.onSuccess) opts.onSuccess();
            close();
          }
        });
        ui.result = { method: 'stars', invoiceLink: result.invoiceLink };
        ui.step = 'result';
        render();
      } else {
        ui.error = t('pp_stars_telegram_only');
        render();
      }
      return;
    }

    ui.result = result || { method };
    ui.step = 'result';
    render();
  } catch (e) {
    ui.busy = false;
    ui.error = (e && e.message) || t('pp_checkout_error');
    render();
  }
}

function wire(body) {
  body.querySelectorAll('[data-pp-close]').forEach((b) => b.addEventListener('click', () => { haptic('light'); close(); }));
  const backBtn = body.querySelector('[data-pp-back]');
  if (backBtn) backBtn.addEventListener('click', () => {
    haptic('light');
    if (ui.step === 'crypto-setup') { ui.step = 'method'; ui.error = null; }
    else if (ui.step === 'method' && (opts.plans || []).length > 1 && !opts.lockPlan) { ui.step = 'pick'; }
    render();
  });

  body.querySelectorAll('[data-pp-pick]').forEach((b) => b.addEventListener('click', () => {
    haptic('light');
    ui.planCode = b.dataset.ppPick;
    ui.step = 'method';
    ui.error = null;
    loadManualMethods().then((m) => { if (m) { ui.manual = m; if (ui.step === 'method') render(); } });
    render();
  }));

  body.querySelectorAll('[data-pp-method]').forEach((b) => b.addEventListener('click', async () => {
    const method = b.dataset.ppMethod;
    haptic('medium');
    ui.method = method;
    ui.error = null;

    if (method === 'crypto_manual') {
      ui.step = 'crypto-setup';
      if (!ui.manual) {
        render();
        const m = await loadManualMethods();
        ui.manual = m || { card: null, crypto: [] };
      }
      render();
      return;
    }

    if (method === 'card') {
      await startCheckout('card');
      return;
    }

    if (method === 'stars') {
      await startCheckout('stars');
      return;
    }

    // cryptobot: спрашиваем актив аккуратными чипами, а не window.prompt —
    // переиспользуем шаг 'crypto-setup', но с флагом "это для cryptobot",
    // чтобы Continue вызывал именно checkout('cryptobot', ...).
    ui.step = 'crypto-setup';
    ui.cryptobotFlow = true;
    if (!ui.manual) {
      render();
      const m = await loadManualMethods();
      ui.manual = m || { card: null, crypto: [] };
    }
    render();
  }));

  body.querySelectorAll('[data-pp-asset]').forEach((b) => b.addEventListener('click', () => {
    haptic('light');
    ui.cryptoAsset = b.dataset.ppAsset;
    ui.cryptoNetwork = null;
    render();
  }));

  body.querySelectorAll('[data-pp-network]').forEach((b) => b.addEventListener('click', () => {
    haptic('light');
    ui.cryptoNetwork = b.dataset.ppNetwork;
    render();
  }));

  const continueBtn = body.querySelector('[data-pp-continue]');
  if (continueBtn) continueBtn.addEventListener('click', async () => {
    haptic('medium');
    if (ui.cryptobotFlow) {
      await startCheckout('cryptobot', { network: ui.cryptoAsset });
      ui.cryptobotFlow = false;
    } else {
      await startCheckout('crypto_manual', { asset: ui.cryptoAsset, network: ui.cryptoNetwork });
    }
  });

  const openUrlBtn = body.querySelector('[data-pp-open-url]');
  if (openUrlBtn) openUrlBtn.addEventListener('click', () => window.open(openUrlBtn.dataset.ppOpenUrl, '_blank'));

  body.querySelectorAll('[data-pp-copy]').forEach((b) => b.addEventListener('click', async () => {
    const key = b.dataset.ppCopy;
    const value = b.dataset.ppCopyValue;
    haptic('light');
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Буфер обмена недоступен (нет разрешения/не-HTTPS) — тихо игнорируем,
      // значение и так видно на экране и его можно выделить руками.
    }
    ui.copiedKey = key;
    render();
    setTimeout(() => { if (ui.copiedKey === key) { ui.copiedKey = null; render(); } }, 1800);
  }));
}

// openPaymentPage({ plans, planCode?, lockPlan?, checkout, getManualMethods, onSuccess? })
// Контракт идентичен showPlanCheckout() из planCheckoutModal.js:
//   plans            — [{ code, title, usd, stars, durationDays }]
//   planCode         — если передан, страница сразу открывается на выборе способа оплаты
//   lockPlan         — true, если нельзя вернуться к списку тарифов
//   checkout         — async (planCode, method, { network?, asset? }) => result
//   getManualMethods — async () => { card, crypto } (см. authApi/docsApi.getManualMethods)
//   onSuccess        — вызывается после успешной оплаты Stars
export function openPaymentPage(config) {
  opts = config;
  manualMethodsPromise = null;
  ui = {
    step: config.planCode ? 'method' : 'pick',
    planCode: config.planCode || null,
    method: null,
    cryptoAsset: 'USDT',
    cryptoNetwork: null,
    cryptobotFlow: false,
    manual: null,
    busy: false,
    error: null,
    result: null,
    copiedKey: null,
  };

  if (ui.step === 'method') {
    loadManualMethods().then((m) => { if (m) { ui.manual = m; if (ui.step === 'method' || ui.step === 'crypto-setup') render(); } });
  }

  rootEl = document.createElement('div');
  rootEl.className = 'pp-page';
  rootEl.innerHTML = `<div class="pp-body"></div>`;
  document.body.appendChild(rootEl);
  document.body.classList.add('pp-lock');

  render();
  requestAnimationFrame(() => rootEl.classList.add('is-open'));
}
