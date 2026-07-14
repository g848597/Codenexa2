// Клиент для раздела "Инвесторы". Тот же принцип, что и в authApi.js: пустой
// API_BASE = тот же домен (server.py раздаёт API и статику вместе, CORS не нужен).
import { getToken } from './authApi.js';

const API_BASE = window.CODENEXA_DOCS_API_BASE_URL || '';

export class InvestorsApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new InvestorsApiError('Нет связи с сервером. Проверьте подключение.', 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* например 204 */
  }

  if (!res.ok) {
    throw new InvestorsApiError(
      (data && data.detail) || `Ошибка сервера (${res.status})`,
      res.status
    );
  }
  return data;
}

export const investorsApi = {
  // Публичный список — только опубликованные карточки, уже в нужном порядке.
  listPublic: () => request('/api/investors'),

  // Ниже — только для админов (сервер сам проверяет allow-list и вернёт 403).
  listAdmin: () => request('/api/investors/admin'),
  create: (data) => request('/api/investors', { method: 'POST', body: data }),
  update: (id, data) => request(`/api/investors/${id}`, { method: 'PUT', body: data }),
  remove: (id) => request(`/api/investors/${id}`, { method: 'DELETE' }),
  reorder: (order) => request('/api/investors/reorder/bulk', { method: 'PUT', body: { order } }),
  uploadPhoto: (id, file) => {
    const form = new FormData();
    form.append('file', file);
    return request(`/api/investors/${id}/photo`, { method: 'POST', body: form, isForm: true });
  },
  removePhoto: (id) => request(`/api/investors/${id}/photo`, { method: 'DELETE' }),

  // Раунд 8, модуль 5: UI-панель поверх API аудит-лога из раунда 7. Только
  // superadmin — сервер вернёт 403 обычному admin (см. app/web/api/
  // admin_users.py::get_audit_log).
  auditLog: ({ limit = 20, offset = 0, action = null } = {}) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (action) params.set('action', action);
    return request(`/api/admin/users/audit-log?${params.toString()}`);
  },
};
