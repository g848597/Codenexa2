// Личный кабинет — "CodeNexa HUB": центральный экран всей экосистемы.
//
// Редизайн (см. запрос в чате: "сплошной текст — это бред столько листать"):
// вместо одной длинной страницы с десятком секций подряд теперь простой стек
// экранов (тот же паттерн, что и в docsApp.js/sportApp.js) — главный экран
// показывает шапку профиля и список разделов-"папок", каждый раздел
// открывается отдельным экраном со своей кнопкой "Назад" к меню. Это не
// переписывает сами блоки: hubHeader/ecosystemGrid/subscriptionCard/... —
// те же файлы profile/*.js, что и раньше, просто теперь каждый рендерится на
// своём экране, а не все подряд одним полотном.
//
// Модульность прежняя: каждый блок HUB'а — отдельный файл в components/
// profile/*.js. Чтобы добавить новый раздел меню, достаточно завести пункт в
// MENU_ITEMS ниже и case в renderScreen().
import { authApi, setToken } from '../api/authApi.js';
import { haptic, openInvoice, showAlert } from '../telegram.js';
import { captureReturnTarget, getReturnTarget, reopenProductIfNeeded } from '../navigation.js';
import { errorHTML as _errorHTML, loadingHTML as _loadingHTML, backButtonHTML as _backButtonHTML } from '../utils/loadingState.js';
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
import { organizationSectionHTML, bindOrganizationSection } from './profile/organizationSection.js';
import { ecosystemBannerHTML } from './profile/ecosystemBanner.js';
import { openProductView } from './productDetail.js';

let root = null;
let user = null;
let onLoggedOut = null;
let hubViewOpen = false;
let screenStack = [{ name: 'home' }];

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
    org: { loading: true, error: null, data: null }, // { organization, members } | null — см. api/authApi.js myOrganization()
    orgUi: { busy: {}, notice: null, inviteLink: null },
    totpFlow: null, // { secret, otpauthUrl } во время включения 2FA, пока не подтверждено кодом
    busy: {}, // busy['password'] / busy['2fa'] / busy['checkout:pro_monthly:stars'] и т.д.
    notices: {}, // короткие сообщения об успехе/ошибке рядом с конкретным блоком
  };
}

let state = freshState();

async function fetchOrgState() {
  try {
    const data = await authApi.myOrganization();
    return { loading: false, error: null, data };
  } catch (e) {
    return { loading: false, error: e.message || 'Не удалось загрузить организацию', data: null };
  }
}

// Лёгкий пере-запрос только организации (после создания/выхода/удаления
// сотрудника) — не дёргает остальные API аккаунта заново.
async function reloadOrg() {
  state.org = { loading: true, error: null, data: state.org.data };
  render();
  state.org = await fetchOrgState();
  state.orgUi.inviteLink = null;
  render();
}

async function loadAll() {
  state.loading = true;
  render();
  try {
    const [meRes, sessionsRes, plansRes, billingRes, referralRes, orgRes] = await Promise.all([
      authApi.me(),
      authApi.sessions().catch(() => ({ sessions: [] })),
      authApi.plans().catch(() => ({ plans: [], cryptoAssets: [] })),
      authApi.billingStatus().catch(() => ({ payments: [], hasPaid: false })),
      authApi.referralStats().catch(() => null),
      fetchOrgState(),
    ]);
    user = meRes.user;
    state.sessions = sessionsRes.sessions;
    state.plans = plansRes;
    state.billing = billingRes;
    state.referral = referralRes;
    state.org = orgRes;
    state.error = null;
  } catch (e) {
    state.error = e.message || 'Не удалось загрузить аккаунт';
  }
  state.loading = false;
  render();
}

// --- Стек экранов (тот же паттерн, что docsApp.js/sportApp.js) -----------

function push(name) {
  screenStack.push({ name });
  render();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function backToMenu() {
  screenStack = [{ name: 'home' }];
  render();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function current() {
  return screenStack[screenStack.length - 1];
}

// --- Меню разделов ----------------------------------------------------

function planValueLabel() {
  const hasPaid = !!(state.billing && state.billing.hasPaid);
  return hasPaid ? t('hub_status_active') : t('hub_sub_free_plan');
}

function orgValueLabel() {
  const org = state.org && state.org.data && state.org.data.organization;
  return org ? org.name : '';
}

// name — id экрана, icon/titleKey/subKey — как в меню, value() — короткая
// подпись справа (текущий тариф, название компании и т.д.), опционально.
const MENU_ITEMS = [
  { name: 'ecosystem', icon: 'layers', titleKey: 'hub_section_ecosystem', subKey: 'hub_menu_ecosystem_sub' },
  { name: 'subscription', icon: 'crown', titleKey: 'hub_section_subscription', subKey: 'hub_menu_subscription_sub', value: planValueLabel },
  { name: 'organization', icon: 'briefcase', titleKey: 'hub_section_organization', subKey: 'hub_menu_organization_sub', value: orgValueLabel },
  { name: 'activity', icon: 'pieChart', titleKey: 'hub_section_activity', subKey: 'hub_menu_activity_sub' },
  { name: 'referral', icon: 'users', titleKey: 'hub_section_referral', subKey: 'hub_menu_referral_sub' },
  { name: 'security', icon: 'shieldCheck', titleKey: 'hub_section_security', subKey: 'hub_menu_security_sub' },
  { name: 'settings', icon: 'tool', titleKey: 'hub_section_settings', subKey: 'hub_menu_settings_sub' },
  { name: 'support', icon: 'bot', titleKey: 'hub_section_support', subKey: 'hub_menu_support_sub' },
];

function menuRowHTML(item) {
  const value = item.value ? item.value() : '';
  return `
  <button class="hub-menu-row" data-menu-go="${item.name}" type="button">
    <span class="hub-menu-icon">${icon(item.icon)}</span>
    <span class="hub-menu-main">
      <span class="hub-menu-title">${t(item.titleKey)}</span>
      <span class="hub-menu-sub">${t(item.subKey)}</span>
    </span>
    ${value ? `<span class="hub-menu-value">${value}</span>` : ''}
    <span class="hub-menu-chevron">${icon('chevronRight')}</span>
  </button>`;
}

function renderHome() {
  return `
    ${_backButtonHTML('acc', t('acc_back_label'))}
    ${hubHeaderHTML(user, !!(state.billing && state.billing.hasPaid))}

    <div class="hub-menu-hint">${t('hub_menu_hint')}</div>
    <div class="hub-row-list">
      ${MENU_ITEMS.map(menuRowHTML).join('')}
    </div>

    <div class="hub-section" style="margin-top:26px;">
      ${ecosystemBannerHTML()}
    </div>

    <button class="acc-btn acc-btn-logout" data-acc-logout>${t('acc_logout_btn')}</button>`;
}

function screenHead(iconName, titleKey) {
  return `
  <div class="hub-screen-topbar">
    ${_backButtonHTML('acc', t('hub_back_to_menu'))}
  </div>
  <div class="hub-screen-title" style="margin-bottom:16px;">${icon(iconName)} ${t(titleKey)}</div>`;
}

function renderScreen(screen) {
  switch (screen.name) {
    case 'ecosystem':
      return `${screenHead('layers', 'hub_section_ecosystem')}${ecosystemGridHTML()}<div style="margin-top:22px;">${aiInsightsHTML()}</div>`;
    case 'subscription':
      return `${screenHead('crown', 'hub_section_subscription')}${subscriptionCardHTML(state.billing, state.plans)}
        <div style="margin-top:22px;">${sectionHead('trophy', 'hub_section_achievements')}${achievementsHTML(user, state.billing)}</div>
        <div id="hub-payments" style="margin-top:22px;">${sectionHead('creditCard', 'hub_section_payments')}${paymentsSectionHTML(state)}</div>`;
    case 'organization':
      return `${screenHead('briefcase', 'hub_section_organization')}${organizationSectionHTML(state, user.id, state.billing)}`;
    case 'activity':
      return `${screenHead('pieChart', 'hub_section_activity')}${activitySummaryHTML(user, state.sessions, state.billing)}`;
    case 'referral':
      return `${screenHead('users', 'hub_section_referral')}${referralSectionHTML(state.referral)}`;
    case 'security':
      return `${screenHead('shieldCheck', 'hub_section_security')}${securitySectionHTML(user, state)}`;
    case 'settings':
      return `${screenHead('tool', 'hub_section_settings')}${settingsSectionHTML()}`;
    case 'support':
      return `${screenHead('bot', 'hub_section_support')}${supportSectionHTML()}`;
    default:
      return renderHome();
  }
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

  const screen = current();
  root.innerHTML = `<div class="hub-wrap">${screen.name === 'home' ? renderHome() : renderScreen(screen)}</div>`;

  bind(screen);
}

function bind(screen) {
  const backBtn = root.querySelector('[data-acc-back]');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      haptic('light');
      if (screen.name === 'home') closeAccountApp();
      else backToMenu();
    });
  }

  if (screen.name === 'home') {
    root.querySelectorAll('[data-menu-go]').forEach((btn) => {
      btn.addEventListener('click', () => { haptic('light'); push(btn.dataset.menuGo); });
    });

    const editBtn = root.querySelector('[data-hub-edit-profile]');
    if (editBtn) editBtn.addEventListener('click', () => { haptic('light'); push('security'); });

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
    return;
  }

  switch (screen.name) {
    case 'ecosystem':
      bindEcosystemGrid(root, render);
      bindAiInsights(root, (productId) => openProductView(productId));
      break;
    case 'subscription':
      bindSubscriptionCard(root, 'hub-payments');
      wireCheckout();
      break;
    case 'organization':
      bindOrganizationSection(root, { state, render, reloadOrg, showViewPlans: () => push('subscription') });
      break;
    case 'referral':
      bindReferralSection(root);
      break;
    case 'security':
      bindSecuritySection(root, { state, render, loadAll });
      break;
    case 'settings':
      bindSettingsSection(root, {
        onLangToggle: () => {
          const lang = toggleLang();
          // Синхронизируем глобальную кнопку языка в шапке приложения, даже
          // пока открыт полноэкранный HUB — иначе она бы отставала до
          // следующего клика.
          const globalToggle = document.getElementById('lang-toggle');
          if (globalToggle) globalToggle.textContent = lang.toUpperCase();
          render();
        },
      });
      break;
    case 'support':
      bindSupportSection(root, { onOpenLegal: () => openLegalView() });
      break;
    default:
      break;
  }
}

// Платежи: переиспользуем ровно ту же логику чекаута/idempotency, что была
// в исходном accountApp.js — блок paymentsSection.js рендерит те же
// data-acc-buy кнопки, теперь на экране "Тариф и платежи".
function wireCheckout() {
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
}

export function openAccountApp(logoutCallback, opts = {}) {
  onLoggedOut = logoutCallback;
  captureReturnTarget();
  document.querySelectorAll('.tab').forEach((tabEl) => tabEl.classList.remove('active'));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('view-account').classList.add('active');
  root = document.getElementById('view-account');
  hubViewOpen = true;
  state = freshState();
  screenStack = opts.initialScreen ? [{ name: 'home' }, { name: opts.initialScreen }] : [{ name: 'home' }];
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
