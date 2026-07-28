// Лёгкий регрессионный тест adminApp.js без браузера (jsdom + мок fetch).
// Проект не использует сборщик/npm в рантайме (webapp/ раздаётся как есть,
// см. app/web/server.py), поэтому jsdom здесь — только dev-инструмент, не
// зависимость приложения. Запуск:
//   cd webapp && npm init -y && npm install --no-save jsdom && \
//   node --input-type=module -e "" # (или добавьте "type":"module" в package.json)
//   node test/adminApp.harness.mjs
// Проверяет: рендер всех экранов (дэшборд/пользователи/тарифы/платежи/
// инвесторы/аудит/организации), подтверждение при смене роли на superadmin,
// валидацию формы тарифа, и разницу в видимости пунктов меню между
// superadmin и обычным admin — без реального сервера/Postgres.
import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!doctype html><html><body>
  <div class="tab" data-view="dashboard"></div>
  <div class="tab" data-view="account"></div>
  <section id="view-dashboard" class="view active"></section>
  <section id="view-account" class="view"></section>
  <section id="view-admin-app" class="view"></section>
</body></html>`, { url: 'http://localhost/' });

global.window = dom.window;
global.document = dom.window.document;
global.window.alert = () => {};
global.window.CODENEXA_DOCS_API_BASE_URL = '';
global.window.scrollTo = () => {};
dom.window.Element.prototype.scrollIntoView = function () {};

const calls = [];
let manualPaymentConfirmed = false;

function json(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

global.window.fetch = global.fetch = (url, opts = {}) => {
  const method = opts.method || 'GET';
  calls.push(`${method} ${url}`);
  const u = new URL(url, 'http://localhost/');
  const p = u.pathname;

  if (p === '/api/admin/dashboard') {
    return json({
      totalUsers: 12, activeUsers7d: 5, activeUsers30d: 9,
      roleCounts: { user: 9, admin: 2, superadmin: 1 },
      activeSubscriptions: 3, pendingManualPayments: 2,
      revenue30dUsd: '42.00', otherCurrencyPayments30d: 1,
    });
  }
  if (p === '/api/admin/users' && method === 'GET') {
    return json({ users: [
      { id: 1, email: 'root@example.com', telegramId: null, firstName: 'Root', lastName: null, role: 'superadmin' },
      { id: 2, email: 'bob@example.com', telegramId: 555, firstName: 'Bob', lastName: 'Smith', role: 'admin' },
    ] });
  }
  if (/\/api\/admin\/users\/\d+\/role/.test(p) && method === 'PUT') {
    return json({ user: { id: 2, email: 'bob@example.com', role: 'user' } });
  }
  if (p === '/api/admin/users/audit-log') {
    return json({ entries: [
      { id: 1, adminId: 1, adminEmail: 'root@example.com', adminName: 'Root', action: 'role_change', targetType: 'user', targetId: 2, details: { targetEmail: 'bob@example.com' }, ip: '127.0.0.1', createdAt: '2026-07-01T00:00:00Z' },
    ], total: 1, limit: 20, offset: 0 });
  }
  if (p === '/api/admin/plans' && method === 'GET') {
    return json({ plans: [
      { id: 1, code: 'start_monthly', title: 'Start', usd: '9.00', stars: 300, isActive: true, durationDays: 30, createdAt: '2026-01-01T00:00:00Z' },
    ] });
  }
  if (p === '/api/admin/plans/history') {
    return json({ history: [
      { id: 1, code: 'start_monthly', title: 'Start', usd: '9.00', stars: 300, isActive: true, durationDays: 30, createdAt: '2026-01-01T00:00:00Z' },
      { id: 0, code: 'start_monthly', title: 'Start (old)', usd: '7.00', stars: 250, isActive: false, durationDays: 30, createdAt: '2025-01-01T00:00:00Z' },
    ] });
  }
  if (/\/api\/admin\/plans\/[^/]+$/.test(p) && method === 'PUT') {
    return json({ plan: { id: 2, code: 'new_plan', title: 'New', usd: '5.00', stars: 100, isActive: true, durationDays: null, createdAt: '2026-07-01T00:00:00Z' } });
  }
  if (p === '/api/billing/admin/manual-payments' && method === 'GET') {
    return json({ payments: manualPaymentConfirmed ? [] : [
      { id: 10, user_id: 3, provider: 'card', external_id: 'ref-1', plan: 'start_monthly', amount: '9.00', currency: 'USD', status: 'pending', created_at: '2026-07-20T00:00:00Z', paid_at: null, user: { email: 'payer@example.com', telegramId: null, firstName: 'Payer', lastName: null } },
    ] });
  }
  if (/\/api\/billing\/admin\/manual-payments\/\d+\/confirm/.test(p) && method === 'POST') {
    manualPaymentConfirmed = true;
    return json({ ok: true });
  }
  if (p === '/api/organizations/admin/all') {
    return json({ organizations: [
      { id: 1, name: 'Acme LLC', planCode: 'business_monthly', ownerEmail: 'owner@example.com', ownerName: 'Owner Person', memberCount: 4, createdAt: '2026-02-01T00:00:00Z' },
    ] });
  }
  return json({}, 404);
};

const { openAdminApp } = await import('../src/components/adminApp.js');

function click(selector) {
  const el = document.querySelector(selector);
  if (!el) throw new Error('missing element: ' + selector);
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
}

function go(name) {
  click(`[data-ad-go="${name}"]`);
}

async function flush(n = 6) {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
}

let failed = false;
function assert(cond, msg) {
  if (!cond) { failed = true; console.error('FAIL:', msg); }
  else console.log('ok:', msg);
}

try {
  openAdminApp({ isSuperadmin: true, onClose: () => { console.log('onClose called'); } });
  await flush();
  assert(document.querySelector('.ad-hero-title'), 'home renders hero');
  assert(document.querySelector('.ad-stats-grid'), 'dashboard stats grid rendered for superadmin');
  assert(document.querySelectorAll('.ad-menu-row').length === 6, 'all 6 nav rows visible for superadmin, got ' + document.querySelectorAll('.ad-menu-row').length);

  // ---- users screen ----
  go('users');
  await flush();
  assert(document.querySelectorAll('.ad-user-row').length === 2, 'users list rendered');
  // trigger a non-superadmin role change (should apply immediately, no confirm banner)
  const sel2 = document.querySelector('[data-role-select="2"]');
  sel2.value = 'user';
  sel2.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await flush();
  assert(!document.querySelector('.ad-confirm-banner'), 'no confirm banner for non-superadmin role change');
  click('[data-ad-back]');
  await flush();

  // ---- plans screen ----
  go('plans');
  await flush();
  assert(document.querySelectorAll('.ad-plan-row').length === 1, 'plans list rendered');
  click('#ad-plan-add');
  await flush();
  assert(document.querySelector('#ad-plan-form'), 'new plan form opened');
  click('#ad-plan-save');
  await flush();
  assert(document.querySelector('.ad-inline-error'), 'validation error shown for empty new-plan form');
  document.querySelector('#ad-plan-code').value = 'new_plan';
  document.querySelector('#ad-plan-title').value = 'New Plan';
  document.querySelector('#ad-plan-usd').value = '5.00';
  document.querySelector('#ad-plan-stars').value = '100';
  click('#ad-plan-save');
  await flush(10);
  assert(!document.querySelector('#ad-plan-form'), 'plan form closed after successful save');
  click('[data-ad-back]');
  await flush();

  // ---- payments screen ----
  go('payments');
  await flush();
  assert(document.querySelectorAll('.ad-payment-row').length === 1, 'payments list rendered');
  click('[data-payment-confirm="10"]');
  await flush(10);
  assert(document.querySelector('.ad-empty'), 'payments empty state after confirm (mock list unchanged, refetch returns same mock though)');
  click('[data-ad-back]');
  await flush();

  // ---- investors screen (just mount, don't expand accordions) ----
  go('investors');
  await flush();
  assert(document.querySelector('#ad-investors-mount').children.length > 0, 'investorsAdmin mounted without throwing');
  click('[data-ad-back]');
  await flush();

  // ---- audit screen ----
  go('audit');
  await flush();
  assert(document.querySelector('.ad-table'), 'audit table rendered');
  click('[data-ad-back]');
  await flush();

  // ---- orgs screen ----
  go('orgs');
  await flush();
  assert(document.querySelectorAll('.ad-org-row').length === 1, 'orgs list rendered');
  click('[data-ad-back]');
  await flush();

  // ---- users screen: superadmin-role change requires confirmation ----
  go('users');
  await flush();
  const sel1 = document.querySelector('[data-role-select="1"]');
  sel1.value = 'admin'; // demoting a superadmin
  sel1.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await flush();
  assert(document.querySelector('.ad-confirm-banner'), 'confirm banner shown when demoting a superadmin');
  click('[data-role-cancel]');
  await flush();
  assert(!document.querySelector('.ad-confirm-banner'), 'confirm banner dismissed on cancel');
  click('[data-ad-back]');
  await flush();

  // ---- exit ----
  click('[data-ad-exit]');
  await flush();

  console.log('\nfetch calls made:', calls.length);

  // ---- second run: plain admin (not superadmin) ----
  console.log('\n--- plain admin run ---');
  manualPaymentConfirmed = false;
  let closedAgain = false;
  openAdminApp({ isSuperadmin: false, onClose: () => { closedAgain = true; } });
  await flush();
  assert(document.querySelector('.ad-note'), 'plain admin sees superadmin-only note instead of stats');
  assert(document.querySelectorAll('.ad-menu-row').length === 2, 'plain admin only sees Payments + Investors, got ' + document.querySelectorAll('.ad-menu-row').length);
  assert(!document.querySelector('[data-ad-go="users"]'), 'users tile hidden for plain admin');
  go('payments');
  await flush();
  assert(document.querySelector('.ad-payment-row'), 'plain admin can still see payments queue');
  click('[data-ad-back]');
  await flush();
  click('[data-ad-exit]');
  await flush();
  assert(closedAgain, 'onClose callback fired for plain-admin session too');
} catch (err) {
  failed = true;
  console.error('EXCEPTION:', err);
}

process.exit(failed ? 1 : 0);
