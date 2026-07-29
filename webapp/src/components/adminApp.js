// Admin-панель CodeNexa — полноэкранный раздел поверх /api/admin/*,
// /api/billing/admin/*, /api/organizations/admin/* и /api/investors/admin.
// Тот же паттерн стека экранов, что и в docsApp.js/sportApp.js: без
// виртуального DOM, render() каждый раз перерисовывает верхний экран целиком.
//
// Открывается ТОЛЬКО из "Личного кабинета" (accountApp.js), не с вкладки —
// поэтому, в отличие от sportApp/docsApp, не участвует в общем
// returnTarget-стеке navigation.js: openAdminApp() принимает явный onClose
// колбэк (тот же принцип, что openAccountApp(logoutCallback)), а не лезет в
// navigation.js — это заодно не создаёт цикл импортов adminApp<->accountApp.
//
// Реальная граница доступа — всегда бэкенд (get_current_admin/
// get_current_superadmin, см. app/web/deps.py). isSuperadmin здесь только
// прячет пункты меню, которые бэкенд всё равно вернёт как 403 обычному
// admin — см. admin_panel_build_prompt.md, п.2.
import { adminApi, AdminApiError } from '../api/adminApi.js';
import { mountInvestorsAdmin } from './investorsAdmin.js';
import { t } from '../i18n.js';
import { haptic, showAlert } from '../telegram.js';
import { esc, escAttr } from '../utils/html.js';
import { icon } from '../utils/icons.js';
import { backButtonHTML as _backButtonHTML, errorHTML as _errorHTML, loadingHTML as _loadingHTML } from '../utils/loadingState.js';

let root = null;
let screenStack = [{ name: 'home' }];
let isSuperadmin = false;
let onCloseCallback = null;

function loadingHTML(label) {
  return _loadingHTML('ad', label || t('ad_loading'));
}
function errorHTML(message, retryLabel) {
  return _errorHTML('ad', message, retryLabel || t('ad_retry'));
}
function backButtonHTML(label) {
  return _backButtonHTML('ad', label || t('ad_back_to_menu'));
}

function forbiddenMessage(err) {
  return err instanceof AdminApiError && err.status === 403 ? t('ad_forbidden') : (err.message || t('ad_load_error'));
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function userLabel(u) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return name || u.email || (u.telegramId ? `tg:${u.telegramId}` : `#${u.id}`);
}

// ---------- состояние экранов (каждое — своя мини-стейт-машина loading/error/data) ----------

function freshState() {
  return {
    dashboard: { loading: true, error: null, data: null },
    users: {
      loaded: false, loading: false, error: null, query: '', list: [],
      pendingChange: null, // { userId, role } — ждёт подтверждения (см. renderUsers)
      busyId: null,
      // Пагинация (см. app/web/api/admin_users.py::list_or_search_users) —
      // список теперь ВСЕ пользователи системы, а не только admin/superadmin,
      // так что бесконечная страница без пагинации не годится.
      offset: 0, pageSize: 20, total: 0,
    },
    plans: {
      loaded: false, loading: false, error: null, list: [],
      history: { code: '', items: [], loading: false, error: null },
      editing: null, // { code, title, usd, stars, durationDays, isNew }
      saving: false, saveError: null,
    },
    payments: { loaded: false, loading: false, error: null, list: [], busyId: null },
    audit: {
      loaded: false, loading: false, error: null, entries: [], total: 0,
      offset: 0, pageSize: 20, filters: { action: '', targetType: '' },
    },
    orgs: { loaded: false, loading: false, error: null, list: [] },
    investorsMountEpoch: 0,
  };
}

let state = freshState();

// ---------- стек экранов ----------

function push(name) {
  screenStack.push({ name });
  render();
  ensureScreenData(name);
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

function ensureScreenData(name) {
  if (name === 'users') {
    if (!state.users.loaded) loadUsers();
    // Список активных тарифов нужен для <select> смены тарифа в userRowHTML —
    // грузим его тем же способом, что и для экрана "Тарифы" (не дублируем
    // отдельный endpoint, GET /api/admin/plans и так уже superadmin-only).
    if (!state.plans.loaded) loadPlans();
  }
  if (name === 'plans' && !state.plans.loaded) loadPlans();
  if (name === 'payments' && !state.payments.loaded) loadPayments();
  if (name === 'audit' && !state.audit.loaded) loadAudit();
  if (name === 'orgs' && !state.orgs.loaded) loadOrgs();
}

// ---------- загрузка данных ----------

async function loadDashboard() {
  if (!isSuperadmin) {
    state.dashboard = { loading: false, error: null, data: null };
    render();
    return;
  }
  state.dashboard = { loading: true, error: null, data: state.dashboard.data };
  render();
  try {
    const data = await adminApi.dashboard();
    state.dashboard = { loading: false, error: null, data };
  } catch (err) {
    state.dashboard = { loading: false, error: forbiddenMessage(err), data: null };
  }
  render();
}

async function loadUsers(query, offset) {
  const q = query !== undefined ? query : state.users.query;
  // Новый поиск — со страницы 0; листание страниц (offset передан явно и
  // query не менялся) — сохраняем текущий offset.
  const nextOffset = offset !== undefined ? offset : query !== undefined ? 0 : state.users.offset;
  state.users = { ...state.users, loading: true, error: null, query: q, offset: nextOffset };
  render();
  try {
    const { users, total } = await adminApi.listUsers({ q, limit: state.users.pageSize, offset: nextOffset });
    state.users = { ...state.users, loaded: true, loading: false, error: null, list: users, total: total ?? users.length };
  } catch (err) {
    state.users = { ...state.users, loaded: true, loading: false, error: forbiddenMessage(err), list: [], total: 0 };
  }
  render();
}

async function loadPlans() {
  state.plans = { ...state.plans, loading: true, error: null };
  render();
  try {
    const { plans } = await adminApi.listPlans();
    state.plans = { ...state.plans, loaded: true, loading: false, error: null, list: plans };
    loadPlanHistory(state.plans.history.code);
  } catch (err) {
    state.plans = { ...state.plans, loaded: true, loading: false, error: forbiddenMessage(err), list: [] };
  }
  render();
}

async function loadPlanHistory(code) {
  state.plans.history = { ...state.plans.history, code, loading: true, error: null };
  render();
  try {
    const { history } = await adminApi.planHistory(code || null);
    state.plans.history = { ...state.plans.history, loading: false, error: null, items: history };
  } catch (err) {
    state.plans.history = { ...state.plans.history, loading: false, error: forbiddenMessage(err), items: [] };
  }
  render();
}

async function loadPayments() {
  state.payments = { ...state.payments, loading: true, error: null };
  render();
  try {
    const { payments } = await adminApi.pendingManualPayments();
    state.payments = { ...state.payments, loaded: true, loading: false, error: null, list: payments };
  } catch (err) {
    state.payments = { ...state.payments, loaded: true, loading: false, error: forbiddenMessage(err), list: [] };
  }
  render();
}

async function loadAudit() {
  state.audit = { ...state.audit, loading: true, error: null };
  render();
  try {
    const { entries, total } = await adminApi.auditLog({
      limit: state.audit.pageSize,
      offset: state.audit.offset,
      action: state.audit.filters.action || null,
      targetType: state.audit.filters.targetType || null,
    });
    state.audit = { ...state.audit, loaded: true, loading: false, error: null, entries, total };
  } catch (err) {
    state.audit = { ...state.audit, loaded: true, loading: false, error: forbiddenMessage(err), entries: [], total: 0 };
  }
  render();
}

async function loadOrgs() {
  state.orgs = { ...state.orgs, loading: true, error: null };
  render();
  try {
    const { organizations } = await adminApi.listAllOrganizations();
    state.orgs = { ...state.orgs, loaded: true, loading: false, error: null, list: organizations };
  } catch (err) {
    state.orgs = { ...state.orgs, loaded: true, loading: false, error: forbiddenMessage(err), list: [] };
  }
  render();
}

// ---------- главное меню (домашний экран = дэшборд + навигация) ----------

const NAV_ITEMS = [
  { name: 'users', icon: 'users', titleKey: 'ad_nav_users', subKey: 'ad_nav_users_sub', superadminOnly: true },
  { name: 'plans', icon: 'tag', titleKey: 'ad_nav_plans', subKey: 'ad_nav_plans_sub', superadminOnly: true },
  { name: 'payments', icon: 'creditCard', titleKey: 'ad_nav_payments', subKey: 'ad_nav_payments_sub', superadminOnly: false },
  { name: 'investors', icon: 'diamond', titleKey: 'ad_nav_investors', subKey: 'ad_nav_investors_sub', superadminOnly: false },
  { name: 'audit', icon: 'fileText', titleKey: 'ad_nav_audit', subKey: 'ad_nav_audit_sub', superadminOnly: true },
  { name: 'orgs', icon: 'briefcase', titleKey: 'ad_nav_orgs', subKey: 'ad_nav_orgs_sub', superadminOnly: true },
];

function navBadge(item) {
  if (item.name === 'payments' && state.payments.list.length) return String(state.payments.list.length);
  if (item.name === 'payments' && state.dashboard.data) return String(state.dashboard.data.pendingManualPayments || '');
  return '';
}

function navRowHTML(item) {
  const badge = navBadge(item);
  return `
  <button class="ad-menu-row" data-ad-go="${item.name}" type="button">
    <span class="ad-menu-icon">${icon(item.icon)}</span>
    <span class="ad-menu-main">
      <span class="ad-menu-title">${t(item.titleKey)}</span>
      <span class="ad-menu-sub">${t(item.subKey)}</span>
    </span>
    ${badge ? `<span class="ad-menu-badge">${esc(badge)}</span>` : ''}
    <span class="ad-menu-chevron">${icon('chevronRight')}</span>
  </button>`;
}

function statCardHTML(iconName, valueHTML, labelKey) {
  return `
  <div class="ad-stat-card">
    <span class="ad-stat-icon">${icon(iconName)}</span>
    <span class="ad-stat-value">${valueHTML}</span>
    <span class="ad-stat-label">${t(labelKey)}</span>
  </div>`;
}

function renderDashboardStats() {
  if (!isSuperadmin) {
    return `<div class="ad-note">${icon('lock')} ${t('ad_dashboard_superadmin_only')}</div>`;
  }
  if (state.dashboard.loading && !state.dashboard.data) return loadingHTML(t('ad_dashboard_loading'));
  if (state.dashboard.error) return errorHTML(state.dashboard.error);
  const d = state.dashboard.data;
  if (!d) return '';
  return `
  <div class="ad-stats-grid">
    ${statCardHTML('users', d.totalUsers, 'ad_stat_total_users')}
    ${statCardHTML('flame', d.activeUsers7d, 'ad_stat_active_7d')}
    ${statCardHTML('calendar', d.activeUsers30d, 'ad_stat_active_30d')}
    ${statCardHTML('crown', d.activeSubscriptions, 'ad_stat_active_subs')}
    ${statCardHTML('receipt', `$${esc(d.revenue30dUsd)}`, 'ad_stat_revenue_30d')}
    ${statCardHTML('creditCard', d.pendingManualPayments, 'ad_stat_pending_payments')}
  </div>
  <div class="ad-role-breakdown">
    <span>${t('ad_stat_role_breakdown')}:</span>
    <span class="ad-role-chip">${t('ad_role_user')} · ${d.roleCounts.user}</span>
    <span class="ad-role-chip">${t('ad_role_admin')} · ${d.roleCounts.admin}</span>
    <span class="ad-role-chip">${t('ad_role_superadmin')} · ${d.roleCounts.superadmin}</span>
  </div>
  ${d.otherCurrencyPayments30d ? `<div class="ad-hint">${t('ad_stat_other_currency_hint', d.otherCurrencyPayments30d)}</div>` : ''}`;
}

function renderHome() {
  const items = NAV_ITEMS.filter((i) => !i.superadminOnly || isSuperadmin);
  return `
    ${hubStyleHeader()}
    <div class="ad-section-title">${t('ad_dashboard_title')}</div>
    ${renderDashboardStats()}
    <div class="ad-section-title" style="margin-top:22px;">${t('ad_nav_title')}</div>
    <div class="ad-row-list">${items.map(navRowHTML).join('')}</div>`;
}

function hubStyleHeader() {
  return `<div class="ad-hero"><span class="ad-hero-icon">${icon('gauge')}</span><div><div class="ad-hero-title">${t('ad_brand')}</div><div class="ad-hero-sub">${t('ad_brand_sub')}</div></div></div>`;
}

function screenHead(iconName, titleKey) {
  return `<div class="ad-screen-title">${icon(iconName)} ${t(titleKey)}</div>`;
}

// ---------- экран: пользователи/роли ----------

const ROLE_OPTIONS = ['user', 'admin', 'superadmin'];

function roleChipClass(role) {
  return `ad-role-badge ad-role-badge-${role}`;
}

function planBadgeHTML(u) {
  if (!u.planCode) return `<span class="ad-plan-badge is-none">${t('ad_plan_none')}</span>`;
  const expiryText = u.planExpiresAt ? t('ad_plan_until', formatDate(u.planExpiresAt)) : t('ad_plan_lifetime');
  return `<span class="ad-plan-badge">${esc(u.planTitle || u.planCode)}</span><span class="ad-plan-expiry">${esc(expiryText)}</span>`;
}

function userRowHTML(u) {
  const busy = state.users.busyId === u.id;
  const plans = state.plans.list || [];
  return `
  <div class="ad-card ad-user-row" data-user-id="${u.id}">
    <div class="ad-user-main">
      <div class="ad-user-name">${esc(userLabel(u))}</div>
      <div class="ad-user-meta">${esc(u.email || '—')}${u.telegramId ? ` · tg:${esc(String(u.telegramId))}` : ''}</div>
    </div>
    <span class="${roleChipClass(u.role)}">${t('ad_role_' + u.role)}</span>
    ${planBadgeHTML(u)}
    <div class="ad-user-controls">
      <select class="ad-role-select" data-role-select="${u.id}" ${busy ? 'disabled' : ''}>
        ${ROLE_OPTIONS.map((r) => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${t('ad_role_' + r)}</option>`).join('')}
      </select>
      <select class="ad-plan-select" data-plan-select="${u.id}" ${busy ? 'disabled' : ''}>
        <option value="" ${!u.planCode ? 'selected' : ''}>${t('ad_plan_none')}</option>
        ${plans.map((p) => `<option value="${escAttr(p.code)}" ${p.code === u.planCode ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}
      </select>
    </div>
  </div>`;
}

function pendingChangeBannerHTML() {
  const pc = state.users.pendingChange;
  if (!pc) return '';
  return `
  <div class="ad-confirm-banner">
    <span>${icon('alertTriangle', { className: 'icon--amber' })} ${t('ad_role_confirm_message', userLabel(pc.user), t('ad_role_' + pc.role))}</span>
    <div class="ad-confirm-actions">
      <button class="ad-btn ad-btn-secondary" data-role-cancel type="button">${t('ad_cancel')}</button>
      <button class="ad-btn ad-btn-danger" data-role-confirm type="button">${t('ad_confirm')}</button>
    </div>
  </div>`;
}

function renderUsers() {
  const s = state.users;
  return `
    ${screenHead('users', 'ad_nav_users')}
    <div class="ad-search-row">
      <input type="text" id="ad-users-search" class="ad-input" placeholder="${escAttr(t('ad_users_search_placeholder'))}" value="${escAttr(s.query)}">
      <button class="ad-btn ad-btn-secondary" id="ad-users-search-btn" type="button">${t('ad_search')}</button>
    </div>
    ${!s.query ? `<div class="ad-hint">${t('ad_users_default_hint')}</div>` : ''}
    ${pendingChangeBannerHTML()}
    ${s.loading ? loadingHTML() : s.error ? errorHTML(s.error) : s.list.length ? `<div class="ad-list">${s.list.map(userRowHTML).join('')}</div>` : `<div class="ad-empty">${t('ad_users_empty')}</div>`}
    ${!s.loading && !s.error && s.total > s.pageSize ? `
    <div class="ad-pager">
      <button class="ad-btn ad-btn-secondary" id="ad-users-prev" type="button" ${s.offset === 0 ? 'disabled' : ''}>${t('ad_users_prev_page')}</button>
      <span>${t('ad_users_page_of', s.offset, s.pageSize, s.total)}</span>
      <button class="ad-btn ad-btn-secondary" id="ad-users-next" type="button" ${s.offset + s.pageSize >= s.total ? 'disabled' : ''}>${t('ad_users_next_page')}</button>
    </div>` : ''}
  `;
}

function bindUsers() {
  const input = root.querySelector('#ad-users-search');
  const btn = root.querySelector('#ad-users-search-btn');
  const doSearch = () => loadUsers(input.value.trim());
  if (btn) btn.addEventListener('click', () => { haptic('light'); doSearch(); });
  if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

  root.querySelectorAll('[data-role-select]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const userId = Number(sel.dataset.roleSelect);
      const user = state.users.list.find((u) => u.id === userId);
      const role = sel.value;
      if (!user || role === user.role) return;
      // Гранит/отзыв именно superadmin — отдельное подтверждение (см.
      // admin_panel_build_prompt.md, п.4: "confirmation step before
      // granting/revoking superadmin specifically").
      if (role === 'superadmin' || user.role === 'superadmin') {
        state.users.pendingChange = { userId, role, user };
        render();
        return;
      }
      applyRoleChange(userId, role);
    });
  });

  root.querySelectorAll('[data-plan-select]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const userId = Number(sel.dataset.planSelect);
      const user = state.users.list.find((u) => u.id === userId);
      const planCode = sel.value || null; // пустая опция ("Без тарифа") -> отзыв
      if (!user || planCode === (user.planCode || null)) return;
      applyPlanChange(userId, planCode);
    });
  });

  const cancelBtn = root.querySelector('[data-role-cancel]');
  if (cancelBtn) cancelBtn.addEventListener('click', () => { state.users.pendingChange = null; render(); });
  const confirmBtn = root.querySelector('[data-role-confirm]');
  if (confirmBtn) confirmBtn.addEventListener('click', () => {
    const pc = state.users.pendingChange;
    state.users.pendingChange = null;
    if (pc) applyRoleChange(pc.userId, pc.role);
  });

  const prevBtn = root.querySelector('#ad-users-prev');
  if (prevBtn) prevBtn.addEventListener('click', () => { haptic('light'); loadUsers(state.users.query, Math.max(0, state.users.offset - state.users.pageSize)); });
  const nextBtn = root.querySelector('#ad-users-next');
  if (nextBtn) nextBtn.addEventListener('click', () => { haptic('light'); loadUsers(state.users.query, state.users.offset + state.users.pageSize); });
}

async function applyRoleChange(userId, role) {
  state.users.busyId = userId;
  render();
  try {
    await adminApi.setUserRole(userId, role);
    haptic('light');
    state.users.busyId = null;
    await loadUsers(state.users.query, state.users.offset);
  } catch (err) {
    showAlert(err.message || t('ad_load_error'));
    state.users.busyId = null;
    render();
  }
}

async function applyPlanChange(userId, planCode) {
  state.users.busyId = userId;
  render();
  try {
    await adminApi.setUserPlan(userId, planCode);
    haptic('light');
    state.users.busyId = null;
    await loadUsers(state.users.query, state.users.offset);
  } catch (err) {
    showAlert(err.message || t('ad_load_error'));
    state.users.busyId = null;
    render();
  }
}

// ---------- экран: тарифы ----------

function planCardHTML(p) {
  return `
  <div class="ad-card ad-plan-row">
    <div class="ad-user-main">
      <div class="ad-user-name">${esc(p.title)}</div>
      <div class="ad-user-meta">${esc(p.code)} · $${esc(p.usd)} · ${esc(String(p.stars))} ★${p.durationDays ? ` · ${t('ad_plan_duration_days', p.durationDays)}` : ` · ${t('ad_plan_lifetime')}`}</div>
    </div>
    <button class="ad-btn ad-btn-secondary" data-plan-edit="${escAttr(p.code)}" type="button">${t('ad_edit')}</button>
  </div>`;
}

function planEditFormHTML() {
  const e = state.plans.editing;
  if (!e) return '';
  return `
  <div class="ad-form-card" id="ad-plan-form">
    <div class="ad-form-title">${e.isNew ? t('ad_plan_add_title') : t('ad_plan_edit_title', e.code)}</div>
    ${e.isNew ? `<label>${t('ad_plan_field_code')}</label>
    <input type="text" id="ad-plan-code" class="ad-input" placeholder="${escAttr(t('ad_plan_code_placeholder'))}" maxlength="100">` : ''}
    <label>${t('ad_plan_field_title')}</label>
    <input type="text" id="ad-plan-title" class="ad-input" value="${escAttr(e.title)}" maxlength="200">
    <label>${t('ad_plan_field_usd')}</label>
    <input type="text" id="ad-plan-usd" class="ad-input" inputmode="decimal" value="${escAttr(e.usd)}">
    <label>${t('ad_plan_field_stars')}</label>
    <input type="number" id="ad-plan-stars" class="ad-input" min="1" step="1" value="${escAttr(String(e.stars))}">
    <label>${t('ad_plan_field_duration')}</label>
    <input type="number" id="ad-plan-duration" class="ad-input" min="1" step="1" placeholder="${escAttr(t('ad_plan_duration_placeholder'))}" value="${e.durationDays != null ? escAttr(String(e.durationDays)) : ''}">
    <div class="ad-form-hint">${t('ad_plan_duration_hint')}</div>
    ${state.plans.saveError ? `<div class="ad-inline-error">${icon('alertTriangle', { className: 'icon--amber' })} ${esc(state.plans.saveError)}</div>` : ''}
    <div class="ad-confirm-actions" style="margin-top:10px;">
      <button class="ad-btn ad-btn-secondary" id="ad-plan-cancel" type="button">${t('ad_cancel')}</button>
      <button class="ad-btn ad-btn-primary" id="ad-plan-save" type="button" ${state.plans.saving ? 'disabled' : ''}>${state.plans.saving ? t('ad_saving') : t('ad_save')}</button>
    </div>
  </div>`;
}

function planHistoryHTML() {
  const h = state.plans.history;
  const codes = Array.from(new Set(state.plans.list.map((p) => p.code)));
  return `
  <div class="ad-section-title" style="margin-top:22px;">${t('ad_plan_history_title')}</div>
  <div class="ad-search-row">
    <select id="ad-plan-history-filter" class="ad-input">
      <option value="">${t('ad_plan_history_all')}</option>
      ${codes.map((c) => `<option value="${escAttr(c)}" ${c === h.code ? 'selected' : ''}>${esc(c)}</option>`).join('')}
    </select>
  </div>
  ${h.loading ? loadingHTML() : h.error ? errorHTML(h.error) : h.items.length ? `
  <table class="ad-table">
    <thead><tr><th>${t('ad_plan_col_code')}</th><th>${t('ad_plan_col_price')}</th><th>${t('ad_plan_col_status')}</th><th>${t('ad_plan_col_date')}</th></tr></thead>
    <tbody>
      ${h.items.map((it) => `<tr class="${it.isActive ? 'ad-row-active' : ''}"><td data-label="${escAttr(t('ad_plan_col_code'))}">${esc(it.code)}</td><td data-label="${escAttr(t('ad_plan_col_price'))}">$${esc(it.usd)} / ${esc(String(it.stars))}★</td><td data-label="${escAttr(t('ad_plan_col_status'))}">${it.isActive ? t('ad_plan_status_active') : t('ad_plan_status_archived')}</td><td data-label="${escAttr(t('ad_plan_col_date'))}">${esc(formatDate(it.createdAt))}</td></tr>`).join('')}
    </tbody>
  </table>` : `<div class="ad-empty">${t('ad_plan_history_empty')}</div>`}`;
}

function renderPlans() {
  const s = state.plans;
  return `
    ${screenHead('tag', 'ad_nav_plans')}
    <button class="ad-btn ad-btn-primary" id="ad-plan-add" type="button">+ ${t('ad_plan_add_btn')}</button>
    ${planEditFormHTML()}
    ${s.loading ? loadingHTML() : s.error ? errorHTML(s.error) : s.list.length ? `<div class="ad-list" style="margin-top:14px;">${s.list.map(planCardHTML).join('')}</div>` : `<div class="ad-empty">${t('ad_plan_empty')}</div>`}
    ${planHistoryHTML()}
  `;
}

function openPlanEditor(plan) {
  state.plans.editing = plan
    ? { code: plan.code, title: plan.title, usd: plan.usd, stars: plan.stars, durationDays: plan.durationDays, isNew: false }
    : { code: '', title: '', usd: '', stars: '', durationDays: null, isNew: true };
  state.plans.saveError = null;
  render();
  const form = root.querySelector('#ad-plan-form');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function bindPlans() {
  root.querySelectorAll('[data-plan-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic('light');
      const plan = state.plans.list.find((p) => p.code === btn.dataset.planEdit);
      openPlanEditor(plan);
    });
  });
  const addBtn = root.querySelector('#ad-plan-add');
  if (addBtn) addBtn.addEventListener('click', () => { haptic('light'); openPlanEditor(null); });

  const cancelBtn = root.querySelector('#ad-plan-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', () => { state.plans.editing = null; render(); });

  const saveBtn = root.querySelector('#ad-plan-save');
  if (saveBtn) saveBtn.addEventListener('click', savePlan);

  const historyFilter = root.querySelector('#ad-plan-history-filter');
  if (historyFilter) historyFilter.addEventListener('change', () => loadPlanHistory(historyFilter.value));
}

// Валидация — те же правила, что и Pydantic-модель на бэкенде (см.
// app/web/api/admin_plans.py::PlanBody), чтобы ошибка была видна ДО запроса,
// а не только после (см. admin_panel_build_prompt.md, п.5).
function validatePlanForm(codeInput, title, usdRaw, starsRaw, durationRaw) {
  if (!codeInput.trim()) return t('ad_plan_err_code_required');
  if (!title.trim()) return t('ad_plan_err_title_required');
  const usd = Number(usdRaw);
  if (!usdRaw.trim() || Number.isNaN(usd) || usd <= 0) return t('ad_plan_err_usd_positive');
  const stars = Number(starsRaw);
  if (!Number.isInteger(stars) || stars <= 0) return t('ad_plan_err_stars_positive');
  if (durationRaw.trim() !== '') {
    const d = Number(durationRaw);
    if (!Number.isInteger(d) || d <= 0) return t('ad_plan_err_duration_positive');
  }
  return null;
}

async function savePlan() {
  const e = state.plans.editing;
  const codeInput = e.isNew ? (root.querySelector('#ad-plan-code')?.value || '') : e.code;
  const title = root.querySelector('#ad-plan-title').value;
  const usdRaw = root.querySelector('#ad-plan-usd').value;
  const starsRaw = root.querySelector('#ad-plan-stars').value;
  const durationRaw = root.querySelector('#ad-plan-duration').value;

  const validationError = validatePlanForm(codeInput || e.code, title, usdRaw, starsRaw, durationRaw);
  if (validationError) {
    state.plans.saveError = validationError;
    render();
    return;
  }

  state.plans.saving = true;
  state.plans.saveError = null;
  render();
  try {
    await adminApi.setPlanPrice(codeInput || e.code, {
      title: title.trim(),
      usd: usdRaw.trim(),
      stars: Number(starsRaw),
      durationDays: durationRaw.trim() === '' ? null : Number(durationRaw),
    });
    haptic('light');
    state.plans.editing = null;
    state.plans.saving = false;
    await loadPlans();
  } catch (err) {
    state.plans.saving = false;
    state.plans.saveError = err.message || t('ad_load_error');
    render();
  }
}

// ---------- экран: платежи (очередь ручных подтверждений) ----------

function paymentRowHTML(p) {
  const busy = state.payments.busyId === p.id;
  const u = p.user || {};
  return `
  <div class="ad-card ad-payment-row">
    <div class="ad-user-main">
      <div class="ad-user-name">${esc(userLabel({ firstName: u.firstName, lastName: u.lastName, email: u.email, telegramId: u.telegramId, id: p.user_id }))}</div>
      <div class="ad-user-meta">${esc(p.provider === 'card' ? t('ad_payment_method_card') : t('ad_payment_method_crypto'))} · ${esc(p.plan || '—')} · ${esc(formatDate(p.created_at))}</div>
    </div>
    <div class="ad-payment-amount">${esc(p.amount)} ${esc(p.currency || '')}</div>
    <button class="ad-btn ad-btn-primary" data-payment-confirm="${p.id}" type="button" ${busy ? 'disabled' : ''}>${busy ? t('ad_saving') : t('ad_payment_confirm_btn')}</button>
  </div>`;
}

function renderPayments() {
  const s = state.payments;
  return `
    ${screenHead('creditCard', 'ad_nav_payments')}
    ${s.loading ? loadingHTML() : s.error ? errorHTML(s.error) : s.list.length ? `<div class="ad-list">${s.list.map(paymentRowHTML).join('')}</div>` : `<div class="ad-empty">${t('ad_payments_empty')}</div>`}
  `;
}

function bindPayments() {
  root.querySelectorAll('[data-payment-confirm]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.paymentConfirm);
      haptic('light');
      state.payments.busyId = id;
      render();
      try {
        await adminApi.confirmManualPayment(id);
        state.payments.busyId = null;
        await loadPayments();
      } catch (err) {
        showAlert(err.message || t('ad_load_error'));
        state.payments.busyId = null;
        render();
      }
    });
  });
}

// ---------- экран: инвесторы (переиспользуем investorsAdmin.js целиком) ----------

function renderInvestorsScreen() {
  return `${screenHead('diamond', 'ad_nav_investors')}<div id="ad-investors-mount"></div>`;
}

function mountInvestorsIfNeeded() {
  const mountEl = root.querySelector('#ad-investors-mount');
  if (!mountEl) return;
  mountInvestorsAdmin(mountEl, { onChange: () => {} });
}

// ---------- экран: журнал действий (аудит-лог) ----------

const AUDIT_ACTIONS = [
  'create', 'update', 'delete', 'reorder', 'photo_upload', 'photo_delete',
  'role_change', 'plan_price_change', 'plan_grant', 'manual_payment_confirm',
];
const AUDIT_TARGET_TYPES = ['user', 'plan', 'investor', 'manual_payment'];

function auditActionLabel(action) {
  const key = 'inv_audit_action_' + action;
  const label = t(key);
  if (label !== key) return label;
  const own = t('ad_audit_action_' + action);
  return own === 'ad_audit_action_' + action ? action : own;
}

function auditTargetTypeLabel(type) {
  const key = 'ad_audit_target_' + type;
  const label = t(key);
  return label === key ? type : label;
}

function auditTargetLabel(entry) {
  if (entry.targetType === 'investor' && entry.details && entry.details.name) return esc(entry.details.name);
  if (entry.targetType === 'user' && entry.details && entry.details.targetEmail) return esc(entry.details.targetEmail);
  if (entry.targetType === 'plan' && entry.targetId) return esc(String(entry.targetId));
  return entry.targetId != null ? `#${esc(String(entry.targetId))}` : '—';
}

function renderAudit() {
  const s = state.audit;
  return `
    ${screenHead('fileText', 'ad_nav_audit')}
    <div class="ad-search-row">
      <select id="ad-audit-action" class="ad-input">
        <option value="">${t('ad_audit_all_actions')}</option>
        ${AUDIT_ACTIONS.map((a) => `<option value="${a}" ${a === s.filters.action ? 'selected' : ''}>${esc(auditActionLabel(a))}</option>`).join('')}
      </select>
      <select id="ad-audit-target" class="ad-input">
        <option value="">${t('ad_audit_all_targets')}</option>
        ${AUDIT_TARGET_TYPES.map((tt) => `<option value="${tt}" ${tt === s.filters.targetType ? 'selected' : ''}>${esc(auditTargetTypeLabel(tt))}</option>`).join('')}
      </select>
    </div>
    ${s.loading ? loadingHTML() : s.error ? errorHTML(s.error) : s.entries.length ? `
    <table class="ad-table">
      <thead><tr><th>${t('inv_audit_col_date')}</th><th>${t('inv_audit_col_admin')}</th><th>${t('inv_audit_col_action')}</th><th>${t('inv_audit_col_target')}</th></tr></thead>
      <tbody>
        ${s.entries.map((e) => `<tr><td>${esc(formatDate(e.createdAt))}</td><td>${esc(e.adminEmail || e.adminName || `#${e.adminId}`)}</td><td>${esc(auditActionLabel(e.action))}</td><td>${auditTargetLabel(e)}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="ad-pager">
      <button class="ad-btn ad-btn-secondary" id="ad-audit-prev" type="button" ${s.offset === 0 ? 'disabled' : ''}>${t('inv_audit_prev_page')}</button>
      <span>${t('inv_audit_page_of', s.offset, s.pageSize, s.total)}</span>
      <button class="ad-btn ad-btn-secondary" id="ad-audit-next" type="button" ${s.offset + s.pageSize >= s.total ? 'disabled' : ''}>${t('inv_audit_next_page')}</button>
    </div>` : `<div class="ad-empty">${t('ad_audit_empty')}</div>`}
  `;
}

function bindAudit() {
  const actionSel = root.querySelector('#ad-audit-action');
  const targetSel = root.querySelector('#ad-audit-target');
  if (actionSel) actionSel.addEventListener('change', () => {
    state.audit.filters.action = actionSel.value;
    state.audit.offset = 0;
    loadAudit();
  });
  if (targetSel) targetSel.addEventListener('change', () => {
    state.audit.filters.targetType = targetSel.value;
    state.audit.offset = 0;
    loadAudit();
  });
  const prevBtn = root.querySelector('#ad-audit-prev');
  if (prevBtn) prevBtn.addEventListener('click', () => {
    state.audit.offset = Math.max(0, state.audit.offset - state.audit.pageSize);
    loadAudit();
  });
  const nextBtn = root.querySelector('#ad-audit-next');
  if (nextBtn) nextBtn.addEventListener('click', () => {
    state.audit.offset += state.audit.pageSize;
    loadAudit();
  });
}

// ---------- экран: организации (read-only обзор, опциональный п.9) ----------

function orgRowHTML(o) {
  return `
  <div class="ad-card ad-org-row">
    <div class="ad-user-main">
      <div class="ad-user-name">${esc(o.name)}</div>
      <div class="ad-user-meta">${esc(o.ownerName || o.ownerEmail || '—')} · ${esc(o.planCode)} · ${esc(formatDate(o.createdAt))}</div>
    </div>
    <span class="ad-org-members">${icon('users')} ${o.memberCount}</span>
  </div>`;
}

function renderOrgs() {
  const s = state.orgs;
  return `
    ${screenHead('briefcase', 'ad_nav_orgs')}
    ${s.loading ? loadingHTML() : s.error ? errorHTML(s.error) : s.list.length ? `<div class="ad-list">${s.list.map(orgRowHTML).join('')}</div>` : `<div class="ad-empty">${t('ad_orgs_empty')}</div>`}
  `;
}

// ---------- рендер верхнего уровня ----------

function renderScreen(screen) {
  switch (screen.name) {
    case 'users': return renderUsers();
    case 'plans': return renderPlans();
    case 'payments': return renderPayments();
    case 'investors': return renderInvestorsScreen();
    case 'audit': return renderAudit();
    case 'orgs': return renderOrgs();
    default: return renderHome();
  }
}

function render() {
  if (!root) return;
  const screen = current();
  const canGoBack = screenStack.length > 1;

  root.innerHTML = `
    <div class="admin-app">
      <div class="ad-topbar">
        ${canGoBack ? backButtonHTML() : `<button class="ad-exit" data-ad-exit type="button">${icon('chevronLeft')} ${t('ad_exit_to_account')}</button>`}
      </div>
      <div class="ad-body">${renderScreen(screen)}</div>
    </div>`;

  wireCommon(screen);
}

function retryForScreen(name) {
  switch (name) {
    case 'home': return loadDashboard;
    case 'users': return () => loadUsers();
    case 'plans': return loadPlans;
    case 'payments': return loadPayments;
    case 'audit': return loadAudit;
    case 'orgs': return loadOrgs;
    default: return null;
  }
}

function wireCommon(screen) {
  const backBtn = root.querySelector('[data-ad-back]');
  if (backBtn) backBtn.addEventListener('click', () => { haptic('light'); backToMenu(); });
  const exitBtn = root.querySelector('[data-ad-exit]');
  if (exitBtn) exitBtn.addEventListener('click', () => { haptic('light'); closeAdminApp(); });

  const retryBtn = root.querySelector('[data-retry]');
  if (retryBtn) {
    const fn = retryForScreen(screen.name);
    if (fn) retryBtn.addEventListener('click', fn);
  }

  if (screen.name === 'home') {
    root.querySelectorAll('[data-ad-go]').forEach((btn) => {
      btn.addEventListener('click', () => { haptic('light'); push(btn.dataset.adGo); });
    });
    return;
  }

  switch (screen.name) {
    case 'users': bindUsers(); break;
    case 'plans': bindPlans(); break;
    case 'payments': bindPayments(); break;
    case 'investors': mountInvestorsIfNeeded(); break;
    case 'audit': bindAudit(); break;
    default: break;
  }
}

// ---------- публичный вход/выход ----------

export function openAdminApp({ isSuperadmin: superadmin = false, onClose } = {}) {
  isSuperadmin = superadmin;
  onCloseCallback = onClose || null;

  document.querySelectorAll('.tab').forEach((tabEl) => tabEl.classList.remove('active'));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('view-admin-app').classList.add('active');

  root = document.getElementById('view-admin-app');
  screenStack = [{ name: 'home' }];
  state = freshState();
  render();
  loadDashboard();
  // Дэшборд (для superadmin) уже содержит pendingManualPayments для бейджа
  // на пункте меню "Платежи" — обычному admin (без доступа к дэшборду)
  // подгружаем очередь платежей отдельно, только чтобы посчитать бейдж.
  if (!isSuperadmin) loadPayments();
}

export function closeAdminApp() {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  if (onCloseCallback) onCloseCallback();
}
