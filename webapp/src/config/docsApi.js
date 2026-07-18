// По умолчанию — пустая строка: мини-апп теперь отдаётся тем же сервером,
// что и API (см. app/web/server.py: webapp/ смонтирована на "/", API — на
// "/api"), поэтому запросы идут на тот же домен и CORS не нужен.
//
// Если когда-нибудь понадобится развести фронтенд и бэкенд по разным
// доменам — задайте window.CODENEXA_DOCS_API_BASE_URL = 'https://...'
// инлайн-скриптом в index.html до загрузки модулей.
export const DOCS_API_BASE_URL = window.CODENEXA_DOCS_API_BASE_URL || '';

import { getInitDataRaw } from '../telegram.js';
import { getToken } from '../api/authApi.js';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Раздел AI Docs открывается и внутри Telegram-мини-аппа, и в обычном
// браузере (аккаунт по email/Google/Yandex) — это НЕ телеграм-бот, аккаунт
// в вебе первичен. Поэтому сперва проверяем обычную веб-сессию (JWT из
// authApi.js, тот же токен, что используют investorsApi.js и т.д.), и
// только если её нет — initData Telegram. Раньше здесь проверялся только
// Telegram, из-за чего залогиненный по email пользователь не отправлял
// вообще никакого заголовка Authorization и получал 401 на каждый запрос.
function authHeader() {
  const token = getToken();
  if (token) return `Bearer ${token}`;
  const initData = getInitDataRaw();
  if (initData) return `tma ${initData}`;
  return null;
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const auth = authHeader();
  if (auth) headers['Authorization'] = auth;
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${DOCS_API_BASE_URL}${path}`, {
      method,
      headers,
      body: isForm ? body : (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError('Не удалось связаться с сервером AI Docs. Проверьте соединение.', 0);
  }

  let data = null;
  try { data = await res.json(); } catch { /* пустой ответ, например 204 */ }

  if (!res.ok) {
    throw new ApiError((data && data.error) || `Ошибка сервера (${res.status})`, res.status);
  }
  return data;
}

export const docsApi = {
  // --- Шаблоны ---
  listTemplates: () => request('/api/templates'),
  getTemplate: (code) => request(`/api/templates/${encodeURIComponent(code)}`),

  // --- Документы по шаблону ---
  previewDocument: (templateCode, data) => request('/api/documents/preview', { method: 'POST', body: { templateCode, data } }),
  createDocument: (templateCode, data) => request('/api/documents', { method: 'POST', body: { templateCode, data } }),
  listDocuments: (page = 1) => request(`/api/documents?page=${page}`),
  getDocument: (id) => request(`/api/documents/${id}`),
  deleteDocument: (id) => request(`/api/documents/${id}`, { method: 'DELETE' }),
  // Скачивание требует заголовка Authorization (initData), поэтому обычная
  // ссылка <a href> не подойдёт — качаем как blob и триггерим сохранение.
  downloadFile: async (id, format, filename) => {
    const headers = {};
    const auth = authHeader();
    if (auth) headers['Authorization'] = auth;
    const res = await fetch(`${DOCS_API_BASE_URL}/api/documents/${id}/file?format=${format}`, { headers });
    if (!res.ok) {
      let msg = `Ошибка сервера (${res.status})`;
      try { const data = await res.json(); if (data.error) msg = data.error; } catch { /* noop */ }
      throw new ApiError(msg, res.status);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `document.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  },

  // --- Свой документ (без AI — пользователь сам пишет текст, см. docs.py) ---
  previewCustomDocument: (description) => request('/api/custom-document/preview', { method: 'POST', body: { description } }),
  saveCustomDocument: (description, finalText) => request('/api/custom-document', { method: 'POST', body: { description, finalText } }),

  // --- Дневной лимит бесплатного тарифа ---
  getDocsLimit: () => request('/api/documents/limit'),

  // --- Профиль ---
  getProfile: () => request('/api/profile'),
  updateProfile: (fields) => request('/api/profile', { method: 'PUT', body: fields }),
  uploadLogo: (file) => { const fd = new FormData(); fd.append('file', file); return request('/api/profile/logo', { method: 'POST', body: fd, isForm: true }); },
  uploadSignature: (file) => { const fd = new FormData(); fd.append('file', file); return request('/api/profile/signature', { method: 'POST', body: fd, isForm: true }); },

  // --- Тарифы и оплата ---
  getPlans: () => request('/api/billing/plans'),
  getBillingStatus: () => request('/api/billing/status'),
  checkout: (plan, method, network) => request('/api/billing/checkout', { method: 'POST', body: { plan, method, network } }),
};
