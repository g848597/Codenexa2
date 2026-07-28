// Клиент для новой Admin-панели (webapp/src/components/adminApp.js). Тот же
// принцип, что и в investorsApi.js/authApi.js: пустой API_BASE = тот же
// домен (server.py раздаёт API и статику вместе, CORS не нужен). Не
// переизобретаем investorsApi.js для CRUD инвесторов — тот файл продолжает
// обслуживать investorsAdmin.js напрямую (см. admin_panel_build_prompt.md,
// "мount the existing investorsAdmin.js ... instead of building new UI").
import { getToken } from './authApi.js';

const API_BASE = window.CODENEXA_DOCS_API_BASE_URL || '';

export class AdminApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new AdminApiError('Нет связи с сервером. Проверьте подключение.', 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* например 204 */
  }

  if (!res.ok) {
    throw new AdminApiError((data && data.detail) || `Ошибка сервера (${res.status})`, res.status);
  }
  return data;
}

export const adminApi = {
  // --- Дэшборд (единственный по-настоящему новый бэкенд-эндпоинт этой
  // панели, см. app/web/api/admin_dashboard.py) ---
  dashboard: () => request('/api/admin/dashboard'),

  // --- Пользователи/роли (app/web/api/admin_users.py, уже существовал) ---
  listUsers: (q = '') =>
    request(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  setUserRole: (userId, role) =>
    request(`/api/admin/users/${userId}/role`, { method: 'PUT', body: { role } }),

  // Полноценный экран "Журнал действий" — targetType добавлен вместе с этой
  // панелью (см. app/web/api/admin_users.py::get_audit_log).
  auditLog: ({ limit = 20, offset = 0, action = null, targetType = null, adminId = null } = {}) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (action) params.set('action', action);
    if (targetType) params.set('targetType', targetType);
    if (adminId != null) params.set('adminId', String(adminId));
    return request(`/api/admin/users/audit-log?${params.toString()}`);
  },

  // --- Тарифы (app/web/api/admin_plans.py, уже существовал) ---
  listPlans: () => request('/api/admin/plans'),
  planHistory: (code = null) =>
    request(`/api/admin/plans/history${code ? `?code=${encodeURIComponent(code)}` : ''}`),
  setPlanPrice: (code, payload) =>
    request(`/api/admin/plans/${encodeURIComponent(code)}`, { method: 'PUT', body: payload }),

  // --- Ручные платежи (app/web/api/billing.py, уже существовал) ---
  pendingManualPayments: () => request('/api/billing/admin/manual-payments'),
  confirmManualPayment: (paymentId) =>
    request(`/api/billing/admin/manual-payments/${paymentId}/confirm`, { method: 'POST' }),

  // --- Организации: read-only обзор (новый эндпоинт, п.9 build-промпта) ---
  listAllOrganizations: () => request('/api/organizations/admin/all'),
};
