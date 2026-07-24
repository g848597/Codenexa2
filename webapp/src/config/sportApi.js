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

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  const initData = getInitDataRaw();
  const token = getToken();
  // Порядок важен: initData (Telegram) приоритетнее — так же, как в
  // authApi.js/docsApi.js. Вне Telegram используем обычный JWT-токен сессии,
  // иначе /api/sport/matches не сможет определить PRO-статус для тех, кто
  // вошёл по email/паролю, а не через бота.
  if (initData) headers['Authorization'] = `tma ${initData}`;
  else if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${SPORT_API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new SportApiError('Не удалось связаться с сервером AI Sport. Проверьте соединение.', 0);
  }

  let data = null;
  try { data = await res.json(); } catch { /* пустой ответ */ }

  if (!res.ok) {
    throw new SportApiError((data && data.detail) || (data && data.error) || `Ошибка сервера (${res.status})`, res.status);
  }
  return data;
}

export const sportApi = {
  status: () => request('/api/sport/status'),
  tier: () => request('/api/sport/tier'),
  popularTeams: () => request('/api/sport/teams/popular'),
  searchTeams: (q) => request(`/api/sport/teams/search?q=${encodeURIComponent(q)}`),
  teamDetail: (id) => request(`/api/sport/teams/${encodeURIComponent(id)}`),
  teamMatches: (id) => request(`/api/sport/teams/${encodeURIComponent(id)}/matches`),
  liveMatches: () => request('/api/sport/live'),
  // day: смещение от сегодня (0=сегодня, 1=завтра, …, 3) — см. sport_routes.py.
  matchesByDay: (day) => request(`/api/sport/matches?day=${encodeURIComponent(day)}`),

  // Турнирная таблица лиги (см. app/web/integrations/footballdata.py: league_standings).
  leagueStandings: (leagueId) => request(`/api/sport/leagues/${encodeURIComponent(leagueId)}/standings`),
  // Очная история двух команд.
  headToHead: (teamId, opponentId) => request(`/api/sport/teams/${encodeURIComponent(teamId)}/h2h/${encodeURIComponent(opponentId)}`),
  // Экран одного матча — составы/H2H/коэффициенты вместе.
  matchDetail: (matchId) => request(`/api/sport/matches/${encodeURIComponent(matchId)}`),

  // Избранные команды (watchlist) — требуют авторизации (см. deps.get_current_user).
  favorites: () => request('/api/sport/favorites'),
  addFavorite: (teamId, teamName, teamLogo) => request('/api/sport/favorites', { method: 'POST', body: { teamId, teamName, teamLogo } }),
  removeFavorite: (teamId) => request(`/api/sport/favorites/${encodeURIComponent(teamId)}`, { method: 'DELETE' }),

  // Напоминания о матче (Telegram-бот) — только для пользователей, вошедших через Telegram.
  reminders: () => request('/api/sport/reminders'),
  createReminder: (matchId, homeName, awayName, matchTimestamp, minutesBefore) =>
    request('/api/sport/reminders', { method: 'POST', body: { matchId, homeName, awayName, matchTimestamp, minutesBefore } }),
  cancelReminder: (matchId) => request(`/api/sport/reminders/${encodeURIComponent(matchId)}`, { method: 'DELETE' }),
};
