// Личный кабинет — теперь "CodeNexa HUB": центральный экран всей экосистемы,
// а не просто настройки одного бота (см. ТЗ на редизайн профиля). Открывается
// в том же паттерне, что и docsApp.js/sportApp.js (см. navigation.js) —
// поверх остальных вкладок, "назад" возвращает туда, откуда пришли. Контракт
// с main.js не менялся: openAccountApp(logoutCallback) / closeAccountApp().
//
// Модульность: каждый блок HUB'а — отдельный файл в components/profile/*.js,
// который просто получает нужные ему данные и коллбэки. Чтобы добавить новый
// блок в будущем, не нужно трогать остальные — только зарегистрировать его
// здесь, в render()/bind().
import { authApi, setToken } from '../api/authApi.js';
import { haptic, openInvoice, showAlert } from '../telegram.js';
import { captureReturnTarget, getReturnTarget, reopenProductIfNeeded } from '../navigation.js';
import { errorHTML as _errorHTML, loadingHTML as _loadingHTML } from '../utils/loadingState.js';
import { t, toggleLang } from '../i18n.js';
import { icon } from '../utils/icons.js';
import { openLegalView } from './legal.js';

import { hubHeaderHTML } from './profile/hubHeader.js';
import { ecosystemGridHTML, bindEcosystemGrid } from './profile/ecosystemGrid.js';
import { subscriptionCardHTML, bindSubscriptionCard } from './profile/subscriptionCard.js';
import { activitySummaryHTML } from './profile/activitySummary.js';
import { aiInsightsHTML, bindAiInsights } from './profile/aiInsights.js';
import { achievementsHTML } from './profile/achievements.js';
import { paymentsSectionHTML } from './profile/paymentsSection.js';
import { referralSectionHTML, bindReferralSection } from './profile/referralSection.js';
import { securitySectionHTML, bindSecuritySection } from './profile/securitySection.js';
import { settingsSectionHTML, bindSettingsSection } from './profile/settingsSection.js';
import { supportSectionHTML, bindSupportSection } from './profile/supportSection.js';
import { ecosystemBannerHTML } from './profile/ecosystemBanner.js';
import { openProductView } from './productDetail.js';

let root = null;
let user = null;
let onLoggedOut = null;
let hubViewOpen = false;

// checkout-ключ ("checkout:<plan>:<method>") -> Idempotency-Key одной попытки
// оплаты. См. обработчик [data-acc-buy] ниже и аудит, п.0.5.
const checkoutIdempotencyKeys = new Map();

function freshState() {
  return {
    loading: true,
    error: null,
    sessions: null,
    plans: null,
    billing: null,
    referral: null, // { referralCode, confirmedCount, pendingCount } — см. api/authApi.js referralStats()
    totpFlow: null, // { secret, otpauthUrl } во время включения 2FA, пока не подтверждено кодом
    busy: {}, // busy['password'] / busy['2fa'] / busy['checkout:pro_monthly:stars'] и т.д.
    notices: {}, // короткие сообщения об успехе/ошибке рядом с конкретным блоком
  };
}

let state = freshState();

async function loadAll() {
  state.loading = true;
  render();
  try {
    const [meRes, sessionsRes, plansRes, billingRes, referralRes] = await Promise.all([
      authApi.me(),
      authApi.sessions().catch(() => ({ sessions: [] })),
      authApi.plans().catch(() => ({ plans: [], cryptoAssets: [] })),
      authApi.billingStatus().catch(() => ({ payments: [], hasPaid: false })),
      authApi.referralStats().catch(() => null),
    ]);
    user = meRes.user;
    state.sessions = sessionsRes.sessions;
    state.plans = plansRes;
    state.billing = billingRes;
    state.referral = referralRes;
    state.error = null;
  } catch (e) {
    state.error = e.message || 'Не удалось загрузить аккаунт';
  }
  state.loading = false;
  render();
}

function sectionHead(iconName, titleKey) {
  return `<div class="hub-section-head"><div class="hub-section-title">${icon(iconName)} ${t(titleKey)}</div></div>`;
}

function render() {
  if (!root) return;

  if (state.loading) {
    root.innerHTML = `<div class="hub-wrap">${_loadingHTML('acc', 'Загрузка аккаунта…')}</div>`;
    return;
  }
  if (state.error || !user) {
    root.innerHTML = `<div class="hub-wrap">${_errorHTML('acc', state.error || 'Аккаунт не найден')}</div>`;
    const retryBtn = root.querySelector('[data-retry]');
    if (retryBtn) retryBtn.addEventListener('click', loadAll);
    return;
  }

  root.innerHTML = `
  <div class="hub-wrap">
    <button class="pd-back" data-acc-back>${t('acc_back_btn')}</button>

    ${hubHeaderHTML(user, !!(state.billing && state.billing.hasPaid))}

    <div class="hub-section" id="hub-ecosystem">
      ${sectionHead('layers', 'hub_section_ecosystem')}
      ${ecosystemGridHTML()}
    </div>

    <div class="hub-section" id="hub-ai">
      ${sectionHead('sparkles', 'hub_section_ai')}
      ${aiInsightsHTML()}
    </div>

    <div class="hub-section" id="hub-subscription">
      ${sectionHead('crown', 'hub_section_subscription')}
      ${subscriptionCardHTML(state.billing, state.plans)}
    </div>

    <div class="hub-section" id="hub-activity">
      ${sectionHead('pieChart', 'hub_section_activity')}
      ${activitySummaryHTML(user, state.sessions, state.billing)}
    </div>

    <div class="hub-section" id="hub-achievements">
      ${sectionHead('trophy', 'hub_section_achievements')}
      ${achievementsHTML(user, state.billing)}
    </div>

    <div class="hub-section" id="hub-payments">
      ${sectionHead('creditCard', 'hub_section_payments')}
      ${paymentsSectionHTML(state)}
    </div>

    <div class="hub-section" id="hub-referral">
      ${sectionHead('users', 'hub_section_referral')}
      ${referralSectionHTML(state.referral)}
    </div>

    <div class="hub-section" id="hub-security">
      ${sectionHead('shieldCheck', 'hub_section_security')}
      ${securitySectionHTML(user, state)}
    </div>

    <div class="hub-section" id="hub-settings">
      ${sectionHead('tool', 'hub_section_settings')}
      ${settingsSectionHTML()}
    </div>

    <div class="hub-section" id="hub-support">
      ${sectionHead('bot', 'hub_section_support')}
      ${supportSectionHTML()}
    </div>

    <div class="hub-section">
      ${ecosystemBannerHTML()}
    </div>

    <button class="acc-btn acc-btn-logout" data-acc-logout>${t('acc_logout_btn')}</button>
  </div>`;

  bind();
}

function bind() {
  root.querySelector('[data-acc-back]').addEventListener('click', closeAccountApp);

  const editBtn = root.querySelector('[data-hub-edit-profile]');
  if (editBtn)
    editBtn.addEventListener('click', () => {
      document.getElementById('hub-security')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

  bindEcosystemGrid(root, render);
  bindAiInsights(root, (productId) => openProductView(productId));
  bindSubscriptionCard(root, 'hub-payments');
  bindReferralSection(root);
  bindSecuritySection(root, { state, render, loadAll });
  bindSettingsSection(root, {
    onLangToggle: () => {
      const lang = toggleLang();
      // Синхронизируем глобальную кнопку языка в шапке приложения, даже пока
      // открыт полноэкранный HUB — иначе она бы отставала до следующего клика.
      const globalToggle = document.getElementById('lang-toggle');
      if (globalToggle) globalToggle.textContent = lang.toUpperCase();
      render();
    },
  });
  bindSupportSection(root, { onOpenLegal: () => openLegalView() });

  // Платежи: переиспользуем ровно ту же логику чекаута/idempotency, что была
  // в исходном accountApp.js — блок paymentsSection.js рендерит те же
  // data-acc-buy кнопки.
  root.querySelectorAll('[data-acc-buy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const plan = btn.dataset.accBuy;
      const method = btn.dataset.method;
      const key = `checkout:${plan}:${method}`;
      state.busy[key] = true;
      render();
      if (!checkoutIdempotencyKeys.has(key)) {
        checkoutIdempotencyKeys.set(key, crypto.randomUUID());
      }
      const idempotencyKey = checkoutIdempotencyKeys.get(key);
      try {
        const result = await authApi.checkout(plan, method, 'USDT', idempotencyKey);
        checkoutIdempotencyKeys.delete(key);
        if (result.method === 'stars') {
          openInvoice(result.invoiceLink, (status) => {
            if (status === 'paid') {
              showAlert('Оплата прошла успешно!');
              loadAll();
            }
          });
        } else if (result.payUrl) {
          window.open(result.payUrl, '_blank');
        }
      } catch (e) {
        showAlert(e.message || 'Не удалось создать счёт');
      }
      state.busy[key] = false;
      render();
    });
  });

  root.querySelector('[data-acc-logout]').addEventListener('click', async () => {
    try {
      await authApi.logout();
    } catch {
      /* даже если сеть недоступна — выходим локально */
    }
    setToken(null);
    haptic('light');
    if (onLoggedOut) onLoggedOut();
  });
}

export function openAccountApp(logoutCallback) {
  onLoggedOut = logoutCallback;
  captureReturnTarget();
  document.querySelectorAll('.tab').forEach((tabEl) => tabEl.classList.remove('active'));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('view-account').classList.add('active');
  root = document.getElementById('view-account');
  hubViewOpen = true;
  state = freshState();
  loadAll();
}

// Пере-рендер HUB'а на месте после смены языка через глобальный переключатель
// в шапке (main.js) — тот же паттерн, что rerenderOpenProductView/
// rerenderOpenLegalView в productDetail.js/legal.js.
export function rerenderOpenAccountApp() {
  if (!hubViewOpen || !root) return;
  if (!root.classList.contains('active')) return;
  render();
}

export function closeAccountApp() {
  hubViewOpen = false;
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const target = getReturnTarget();
  if (reopenProductIfNeeded(target)) return;
  if (target.type === 'tab') {
    document.getElementById(`view-${target.view}`).classList.add('active');
    document.querySelector(`.tab[data-view="${target.view}"]`)?.classList.add('active');
  } else {
    document.getElementById('view-dashboard').classList.add('active');
    document.querySelector('.tab[data-view="dashboard"]')?.classList.add('active');
  }
}
