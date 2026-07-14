// Личный кабинет. Полноэкранный раздел в том же паттерне, что и docsApp.js /
// sportApp.js (см. navigation.js) — открывается поверх остальных вкладок,
// "назад" возвращает туда, откуда пришли.
import { authApi, setToken } from '../api/authApi.js';
import { haptic, openInvoice, showAlert } from '../telegram.js';
import { captureReturnTarget, getReturnTarget, reopenProductIfNeeded } from '../navigation.js';
import { esc } from '../utils/html.js';
import { icon } from '../utils/icons.js';
import { errorHTML as _errorHTML, loadingHTML as _loadingHTML } from '../utils/loadingState.js';

let root = null;
let user = null;
let onLoggedOut = null;

// checkout-ключ ("checkout:<plan>:<method>") -> Idempotency-Key одной попытки
// оплаты. См. обработчик [data-acc-buy] ниже и аудит, п.0.5.
const checkoutIdempotencyKeys = new Map();

// Локальное состояние экрана — форма пароля, поток включения 2FA, тарифы, платежи
let state = {
  loading: true,
  error: null,
  sessions: null,
  plans: null,
  billing: null,
  totpFlow: null, // { secret, otpauthUrl } во время включения 2FA, пока не подтверждено кодом
  busy: {}, // busy['password'] / busy['2fa'] / busy['checkout:pro_monthly:stars'] и т.д.
  notices: {}, // короткие сообщения об успехе/ошибке рядом с конкретным блоком
};


function initials(u) {
  const n = (u.firstName || u.email || 'U').trim();
  return n.slice(0, 1).toUpperCase();
}

function methodBadge(active, label) {
  return `<span class="acc-badge ${active ? 'on' : 'off'}">${active ? icon('check') : '—'} ${esc(label)}</span>`;
}

async function loadAll() {
  state.loading = true;
  render();
  try {
    const [meRes, sessionsRes, plansRes, billingRes] = await Promise.all([
      authApi.me(),
      authApi.sessions().catch(() => ({ sessions: [] })),
      authApi.plans().catch(() => ({ plans: [], cryptoAssets: [] })),
      authApi.billingStatus().catch(() => ({ payments: [] })),
    ]);
    user = meRes.user;
    state.sessions = sessionsRes.sessions;
    state.plans = plansRes;
    state.billing = billingRes;
    state.error = null;
  } catch (e) {
    state.error = e.message || 'Не удалось загрузить аккаунт';
  }
  state.loading = false;
  render();
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function headerHTML() {
  return `
  <div class="acc-header">
    <div class="acc-avatar">${initials(user)}</div>
    <div class="acc-id">
      <div class="acc-name">${esc(user.firstName || 'Без имени')} ${esc(user.lastName || '')}</div>
      <div class="acc-email">${esc(user.email || 'Email не привязан')}</div>
    </div>
  </div>
  <div class="acc-badges">
    ${methodBadge(user.hasTelegram, 'Telegram')}
    ${methodBadge(user.hasGoogle, 'Google')}
    ${methodBadge(user.hasYandex, 'Яндекс')}
    ${methodBadge(user.hasPassword, 'Пароль')}
  </div>`;
}

function securityHTML() {
  const notice = state.notices.security
    ? `<div class="acc-notice ${state.notices.security.ok ? 'ok' : 'err'}">${esc(state.notices.security.text)}</div>`
    : '';

  const passwordForm = `
    <form class="acc-form" data-acc-password-form>
      ${
        user.hasPassword
          ? `
      <label class="acc-field"><span>Текущий пароль</span><input type="password" name="currentPassword" autocomplete="current-password" /></label>`
          : ''
      }
      <label class="acc-field"><span>Новый пароль</span><input type="password" name="newPassword" minlength="8" required autocomplete="new-password" /></label>
      <button class="acc-btn acc-btn-small" ${state.busy.password ? 'disabled' : ''}>${user.hasPassword ? 'Сменить пароль' : 'Задать пароль'}</button>
    </form>`;

  let totpBlock;
  if (user.twoFaEnabled) {
    totpBlock = `
    <p class="acc-muted">Двухфакторная аутентификация включена.</p>
    <form class="acc-form" data-acc-2fa-disable-form>
      <label class="acc-field"><span>Код для отключения</span><input type="text" name="code" inputmode="numeric" placeholder="123456" required /></label>
      <button class="acc-btn acc-btn-small acc-btn-danger" ${state.busy.twofa ? 'disabled' : ''}>Отключить 2FA</button>
    </form>`;
  } else if (state.totpFlow) {
    totpBlock = `
    <p class="acc-muted">Отсканируйте QR в приложении-аутентификаторе (Google Authenticator, Authy) или введите ключ вручную:</p>
    <div class="acc-totp-secret">${esc(state.totpFlow.secret)}</div>
    <form class="acc-form" data-acc-2fa-confirm-form>
      <label class="acc-field"><span>Код из приложения</span><input type="text" name="code" inputmode="numeric" placeholder="123456" required /></label>
      <button class="acc-btn acc-btn-small" ${state.busy.twofa ? 'disabled' : ''}>Подтвердить и включить</button>
    </form>`;
  } else {
    totpBlock = `
    <p class="acc-muted">Дополнительный код при входе — защищает аккаунт, даже если пароль узнают.</p>
    <button class="acc-btn acc-btn-small" data-acc-2fa-start ${state.busy.twofa ? 'disabled' : ''}>Включить 2FA</button>`;
  }

  const sessionsList =
    (state.sessions || [])
      .map(
        (s) => `
    <div class="acc-session ${s.revoked ? 'revoked' : ''}">
      <div>
        <div class="acc-session-ua">${esc(s.user_agent || 'Неизвестное устройство').slice(0, 48)}</div>
        <div class="acc-session-meta">${esc(s.ip || '')} · ${fmtDate(s.created_at)}${s.revoked ? ' · отозвана' : ''}</div>
      </div>
      ${!s.revoked ? `<button class="acc-link-btn" data-acc-revoke-session="${s.id}">Выйти</button>` : ''}
    </div>`
      )
      .join('') ||
    '<p class="acc-muted">Нет активных сессий email/OAuth (вход через Telegram не создаёт отдельную сессию).</p>';

  return `
  <div class="acc-section">
    <div class="acc-section-title">Безопасность</div>
    ${notice}
    <div class="acc-subblock">
      <div class="acc-subtitle">${user.hasPassword ? 'Пароль' : 'Задать пароль для входа по email'}</div>
      ${passwordForm}
    </div>
    <div class="acc-subblock">
      <div class="acc-subtitle">Двухфакторная аутентификация (2FA)</div>
      ${totpBlock}
    </div>
    <div class="acc-subblock">
      <div class="acc-subtitle">Активные сессии</div>
      ${sessionsList}
      ${(state.sessions || []).some((s) => !s.revoked) ? `<button class="acc-link-btn acc-link-danger" data-acc-revoke-all>Выйти на всех устройствах</button>` : ''}
    </div>
  </div>`;
}

function billingHTML() {
  const plans = (state.plans && state.plans.plans) || [];
  const payments = (state.billing && state.billing.payments) || [];

  const planCards = plans
    .map(
      (p) => `
    <div class="acc-plan">
      <div class="acc-plan-title">${esc(p.title)}</div>
      <div class="acc-plan-price">$${esc(p.usd)} <span>или ${esc(String(p.stars))} ${icon('star')}</span></div>
      <div class="acc-plan-actions">
        <button class="acc-btn acc-btn-small" data-acc-buy="${p.code}" data-method="stars" ${state.busy['checkout:' + p.code + ':stars'] ? 'disabled' : ''}>Оплатить Stars</button>
        <button class="acc-btn acc-btn-small acc-btn-ghost" data-acc-buy="${p.code}" data-method="cryptobot" ${state.busy['checkout:' + p.code + ':cryptobot'] ? 'disabled' : ''}>Оплатить крипто</button>
      </div>
    </div>`
    )
    .join('');

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
      .join('') || '<p class="acc-muted">Платежей пока нет.</p>';

  return `
  <div class="acc-section">
    <div class="acc-section-title">Тарифы и оплата</div>
    <div class="acc-plans">${planCards}</div>
    <div class="acc-subblock">
      <div class="acc-subtitle">История платежей</div>
      ${paymentRows}
    </div>
  </div>`;
}

function render() {
  if (!root) return;

  if (state.loading) {
    // Раунд 8 (см. CHANGES_ROUND8.md, модуль 7): раньше здесь был голый
    // текст без спиннера — единственный полноэкранный модуль без него
    // (docsApp.js/sportApp.js уже показывали da-spinner/sa-spinner).
    root.innerHTML = `<div class="acc-wrap">${_loadingHTML('acc', 'Загрузка аккаунта…')}</div>`;
    return;
  }
  if (state.error || !user) {
    // Раунд 8: раньше ошибка была тупиком — не было кнопки повтора,
    // пользователь мог только закрыть раздел и открыть заново. Теперь —
    // тот же паттерн `data-retry`, что и в docsApp.js/sportApp.js.
    root.innerHTML = `<div class="acc-wrap">${_errorHTML('acc', state.error || 'Аккаунт не найден')}</div>`;
    const retryBtn = root.querySelector('[data-retry]');
    if (retryBtn) retryBtn.addEventListener('click', loadAll);
    return;
  }

  root.innerHTML = `
  <div class="acc-wrap">
    <button class="acc-back" data-acc-back>← Назад</button>
    ${headerHTML()}
    ${securityHTML()}
    ${billingHTML()}
    <button class="acc-btn acc-btn-logout" data-acc-logout>Выйти из аккаунта</button>
  </div>`;

  bind();
}

function bind() {
  root.querySelector('[data-acc-back]').addEventListener('click', closeAccountApp);

  const passForm = root.querySelector('[data-acc-password-form]');
  if (passForm)
    passForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      state.busy.password = true;
      render();
      try {
        await authApi.changePassword(fd.get('currentPassword') || undefined, fd.get('newPassword'));
        state.notices.security = { ok: true, text: 'Пароль обновлён.' };
        haptic('medium');
        await loadAll();
      } catch (e) {
        state.notices.security = { ok: false, text: e.message };
      }
      state.busy.password = false;
      render();
    });

  const start2fa = root.querySelector('[data-acc-2fa-start]');
  if (start2fa)
    start2fa.addEventListener('click', async () => {
      state.busy.twofa = true;
      render();
      try {
        state.totpFlow = await authApi.setup2FA();
      } catch (e) {
        state.notices.security = { ok: false, text: e.message };
      }
      state.busy.twofa = false;
      render();
    });

  const confirm2fa = root.querySelector('[data-acc-2fa-confirm-form]');
  if (confirm2fa)
    confirm2fa.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const code = new FormData(ev.target).get('code');
      state.busy.twofa = true;
      render();
      try {
        await authApi.confirm2FA(code);
        state.totpFlow = null;
        state.notices.security = { ok: true, text: '2FA включена.' };
        haptic('medium');
        await loadAll();
      } catch (e) {
        state.notices.security = { ok: false, text: e.message };
      }
      state.busy.twofa = false;
      render();
    });

  const disable2fa = root.querySelector('[data-acc-2fa-disable-form]');
  if (disable2fa)
    disable2fa.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const code = new FormData(ev.target).get('code');
      state.busy.twofa = true;
      render();
      try {
        await authApi.disable2FA(code);
        state.notices.security = { ok: true, text: '2FA отключена.' };
        await loadAll();
      } catch (e) {
        state.notices.security = { ok: false, text: e.message };
      }
      state.busy.twofa = false;
      render();
    });

  root.querySelectorAll('[data-acc-revoke-session]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await authApi.revokeSession(Number(btn.dataset.accRevokeSession));
      await loadAll();
    });
  });

  const revokeAll = root.querySelector('[data-acc-revoke-all]');
  if (revokeAll)
    revokeAll.addEventListener('click', async () => {
      await authApi.revokeAllSessions();
      await loadAll();
    });

  root.querySelectorAll('[data-acc-buy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const plan = btn.dataset.accBuy;
      const method = btn.dataset.method;
      const key = `checkout:${plan}:${method}`;
      state.busy[key] = true;
      render();
      // Один и тот же idempotency-ключ на всю попытку оплаты: если запрос
      // упал (сеть/таймаут) и пользователь нажмёт ещё раз — бэкенд опознает
      // повтор и не создаст второй платёж/инвойс (см. аудит, п.0.5).
      // После успеха или явной отмены ключ сбрасывается — следующая покупка
      // получит новый.
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
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('view-account').classList.add('active');
  root = document.getElementById('view-account');
  state = {
    loading: true,
    error: null,
    sessions: null,
    plans: null,
    billing: null,
    totpFlow: null,
    busy: {},
    notices: {},
  };
  loadAll();
}

export function closeAccountApp() {
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
