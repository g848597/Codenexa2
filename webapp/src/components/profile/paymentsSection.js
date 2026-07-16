// "ПЛАТЕЖИ" — переиспользует разметку тарифов/истории платежей из прежнего
// accountApp.js (.acc-plan/.acc-payment, стили уже есть в app.css), просто
// внутри новой оболочки HUB'а. Автопродление и промокоды сюда сознательно
// не добавлены: billing.py/repo.py не хранят ни expires_at, ни promo_code,
// ни auto_renew — рисовать переключатель, который ничего не переключает,
// было бы тёмным паттерном, а не honest UI (правило №1 проекта).
import { icon } from '../../utils/icons.js';
import { esc } from '../../utils/html.js';
import { t } from '../../i18n.js';
import { fmtDate } from '../../utils/format.js';

export function paymentsSectionHTML(state) {
  const plans = (state.plans && state.plans.plans) || [];
  const payments = (state.billing && state.billing.payments) || [];

  const planCards = plans
    .map(
      (p) => `
    <div class="acc-plan">
      <div class="acc-plan-title">${esc(p.title)}</div>
      <div class="acc-plan-price">$${esc(p.usd)} <span>${t('hub_pay_or')} ${esc(String(p.stars))} ${icon('star')}</span></div>
      <div class="acc-plan-actions">
        <button class="acc-btn acc-btn-small" data-acc-buy="${p.code}" data-method="stars" ${state.busy['checkout:' + p.code + ':stars'] ? 'disabled' : ''}>${t('hub_pay_stars_btn')}</button>
        <button class="acc-btn acc-btn-small acc-btn-ghost" data-acc-buy="${p.code}" data-method="cryptobot" ${state.busy['checkout:' + p.code + ':cryptobot'] ? 'disabled' : ''}>${t('hub_pay_crypto_btn')}</button>
      </div>
    </div>`
    )
    .join('');

  const providerCounts = payments.reduce((acc, p) => {
    acc[p.provider] = (acc[p.provider] || 0) + 1;
    return acc;
  }, {});
  const methodsSummary = Object.keys(providerCounts).length
    ? Object.entries(providerCounts).map(([prov, n]) => `${esc(prov)} · ${n}`).join('  \u00b7  ')
    : t('hub_pay_no_methods');

  const paymentRows =
    payments
      .map(
        (p) => `
    <div class="acc-payment">
      <span>${esc(p.plan || '—')}</span>
      <span class="acc-payment-provider">${esc(p.provider)}</span>
      <span class="acc-payment-status status-${esc(p.status)}">${esc(p.status)}</span>
      <span class="acc-payment-date">${fmtDate(p.created_at)}</span>
    </div>`
      )
      .join('') || `<p class="acc-muted">${t('hub_pay_no_history')}</p>`;

  const notice = state.notices.payments
    ? `<div class="hub-notice ${state.notices.payments.ok ? 'ok' : 'err'}">${esc(state.notices.payments.text)}</div>`
    : '';

  return `
  ${notice}
  <div class="acc-plans">${planCards}</div>
  <div class="acc-subblock">
    <div class="acc-subtitle">${t('hub_pay_methods_title')}</div>
    <p class="acc-muted">${methodsSummary}</p>
  </div>
  <div class="acc-subblock">
    <div class="acc-subtitle">${t('hub_pay_history_title')}</div>
    ${paymentRows}
  </div>`;
}
