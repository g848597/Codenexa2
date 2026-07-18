// AI Sport — тонкий REST-клиент поверх /api/sport/* (см. app/web/api/sport_routes.py).
// Та же схема, что и docsApi.js: initData как Bearer-подобный заголовок, единый
// домен с мини-аппом, никакого отдельного CORS-конфига не требуется.

import { getInitDataRaw } from '../telegram.js';
import { getToken } from '../api/authApi.js';

const SPORT_API_BASE_URL = window.CODENEXA_DOCS_API_BASE_URL || '';

export class SportApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path) {
  const headers = {};
  const initData = getInitDataRaw();
  const token = getToken();
  // Порядок важен: initData (Telegram) приоритетнее — так же, как в
  // authApi.js/docsApi.js. Вне Telegram используем обычный JWT-токен сессии,
  // иначе /api/sport/matches не сможет определить PRO-статус для тех, кто
  // вошёл по email/паролю, а не через бота.
  if (initData) headers['Authorization'] = `tma ${initData}`;
  else if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${SPORT_API_BASE_URL}${path}`, { headers });
  } catch {
    throw new SportApiError('Не удалось связаться с сервером AI Sport. Проверьте соединение.', 0);
  }

  let data = null;
  try { data = await res.json(); } catch { /* пустой ответ */ }

  if (!res.ok) {
    throw new SportApiError((data && data.error) || `Ошибка сервера (${res.status})`, res.status);
  }
  return data;
}

export const sportApi = {
  status: () => request('/api/sport/status'),
  popularTeams: () => request('/api/sport/teams/popular'),
  searchTeams: (q) => request(`/api/sport/teams/search?q=${encodeURIComponent(q)}`),
  teamDetail: (id) => request(`/api/sport/teams/${encodeURIComponent(id)}`),
  teamMatches: (id) => request(`/api/sport/teams/${encodeURIComponent(id)}/matches`),
  liveMatches: () => request('/api/sport/live'),
  matchesByDate: (when) => request(`/api/sport/matches?when=${encodeURIComponent(when)}`),
};
