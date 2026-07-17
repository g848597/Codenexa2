// Клиент авторизации. Хранит JWT в localStorage (не в cookie — Telegram
// WebView часто режет сторонние куки), а внутри Telegram отправляет initData
// напрямую и вообще не требует хранимого токена для базового входа.
import { getInitDataRaw, isInsideTelegram } from '../telegram.js';

// Тот же принцип, что и в docsApi.js/sportApi.js: пусто = тот же домен,
// т.к. app/web/server.py монтирует API и статику вместе.
const API_BASE = window.CODENEXA_DOCS_API_BASE_URL || '';

const TOKEN_KEY = 'codenexa_auth_token_v1';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class AuthApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(
  path,
  { method = 'GET', body, useTelegram = false, extraHeaders = {} } = {}
) {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  if (useTelegram) {
    const initData = getInitDataRaw();
    if (initData) headers['Authorization'] = `tma ${initData}`;
  } else {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new AuthApiError('Нет связи с сервером. Проверьте подключение.', 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* пусто, например 204 */
  }

  if (!res.ok) {
    throw new AuthApiError((data && data.detail) || `Ошибка сервера (${res.status})`, res.status);
  }
  return data;
}

export const authApi = {
  // Тихий вход внутри Telegram — initData уже подписана клиентом Telegram,
  // подтверждаем на бэкенде и получаем такой же JWT, как при обычном логине.
  loginWithTelegram: () =>
    request('/api/auth/telegram', {
      method: 'POST',
      useTelegram: true,
      body: { initData: getInitDataRaw() },
    }),

  register: (email, password, firstName) =>
    request('/api/auth/register', { method: 'POST', body: { email, password, firstName } }),
  login: (email, password, totpCode) =>
    request('/api/auth/login', { method: 'POST', body: { email, password, totpCode } }),
  me: () => request('/api/auth/me'),
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  changePassword: (currentPassword, newPassword) =>
    request('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),

  // Подтверждение email и сброс пароля по одноразовому 6-значному коду,
  // присылаемому на почту (см. app/web/api/auth.py, задача 3).
  requestEmailVerification: () => request('/api/auth/verify-email/request', { method: 'POST' }),
  confirmEmailVerification: (code) =>
    request('/api/auth/verify-email/confirm', { method: 'POST', body: { code } }),

  forgotPassword: (email) =>
    request('/api/auth/password/forgot', { method: 'POST', body: { email } }),
  resetPassword: (email, code, newPassword) =>
    request('/api/auth/password/reset', { method: 'POST', body: { email, code, newPassword } }),

  sessions: () => request('/api/auth/sessions'),
  revokeSession: (id) => request(`/api/auth/sessions/${id}/revoke`, { method: 'POST' }),
  revokeAllSessions: () => request('/api/auth/sessions/revoke-all', { method: 'POST' }),

  setup2FA: () => request('/api/auth/2fa/setup', { method: 'POST' }),
  confirm2FA: (code) => request('/api/auth/2fa/confirm', { method: 'POST', body: { code } }),
  disable2FA: (code) => request('/api/auth/2fa/disable', { method: 'POST', body: { code } }),

  exchangeCode: (code) => request('/api/auth/exchange', { method: 'POST', body: { code } }),

  googleStartUrl: () => `${API_BASE}/api/auth/google/start`,
  yandexStartUrl: () => `${API_BASE}/api/auth/yandex/start`,

  plans: () => request('/api/billing/plans'),
  billingStatus: () => request('/api/billing/status'),
  // Реальная реферальная статистика с бэкенда (app/web/api/referrals.py) —
  // confirmedCount подтверждается только первой оплатой приглашённого
  // (см. referrals.py), поэтому это честное число, а не локальный счётчик.
  referralStats: () => request('/api/referrals/me'),
  // idempotencyKey: см. components/accountApp.js — один и тот же ключ на всю
  // попытку оплаты (переживает ретраи после ошибки), чтобы повторная отправка
  // не создавала второй инвойс на бэкенде (см. аудит, п.0.5).
  checkout: (plan, method, network, idempotencyKey) =>
    request('/api/billing/checkout', {
      method: 'POST',
      body: { plan, method, network },
      extraHeaders: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    }),
};

export function isRunningInsideTelegram() {
  return isInsideTelegram();
}
