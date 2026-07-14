// AI Sport — веб-модуль поверх REST API /api/sport/* (см. src/config/sportApi.js).
// Открывается кнопкой запуска на странице продукта (productDetail.js), поверх
// той же системы .view, что и остальные полноэкранные разделы приложения.
// Архитектура — тот же паттерн стека экранов, что и в docsApp.js: без
// виртуального DOM, render() каждый раз перерисовывает верхний экран целиком.

import { sportApi, SportApiError } from '../config/sportApi.js';
import { haptic } from '../telegram.js';
import { captureReturnTarget, getReturnTarget, reopenProductIfNeeded } from '../navigation.js';
import { esc } from '../utils/html.js';
import { icon } from '../utils/icons.js';
import { backButtonHTML as _backButtonHTML, errorHTML as _errorHTML, loadingHTML as _loadingHTML } from '../utils/loadingState.js';

let root = null;
let screenStack = [{ name: 'home' }];
let apiConfigured = null; // null = ещё не проверено
let liveCount = 0;

// --- Утилиты -------------------------------------------------------------

function push(name, params = {}) {
  screenStack.push({ name, params });
  render();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function back() {
  if (screenStack.length > 1) screenStack.pop();
  render();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function current() {
  return screenStack[screenStack.length - 1];
}

// Раунд 8 (см. CHANGES_ROUND8.md, модуль 7): тела функций вынесены в
// utils/loadingState.js — здесь только фиксация CSS-префикса 'sa',
// сохранявшегося до этого раунда (sa-loading/sa-spinner/sa-error/sa-back).
function loadingHTML(label = 'Загрузка…') {
  return _loadingHTML('sa', label);
}

function errorHTML(message, retryLabel = 'Повторить') {
  return _errorHTML('sa', message, retryLabel);
}

function backButtonHTML(label = 'Назад') {
  return _backButtonHTML('sa', label);
}

function initials(name) {
  return String(name ?? '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

// Стабильный псевдослучайный оттенок фона плейсхолдера по имени команды —
// чтобы карточки без герба (нет данных / API не настроен) всё равно выглядели
// как осмысленный дизайн, а не как "сломанная картинка".
function placeholderHue(name) {
  const s = String(name ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

function crestHTML(team, size = 'md') {
  const wrapCls = `sa-crest-wrap sa-crest-${size}`;
  if (team.logo) {
    // Без инлайн-обработчиков (риск инъекции через кавычки в названии команды,
    // напр. "Nott'm Forest") — на ошибку загрузки реагирует делегированный
    // слушатель, подключённый в wireImageFallbacks() после каждого render().
    return `<span class="${wrapCls}"><img class="sa-crest-img" src="${esc(team.logo)}" alt="${esc(team.name)}" loading="lazy" data-crest-img data-fallback-text="${esc(initials(team.name))}" data-fallback-hue="${placeholderHue(team.name)}"></span>`;
  }
  return `<span class="${wrapCls} sa-crest-fallback" style="--hue:${placeholderHue(team.name)}">${esc(initials(team.name))}</span>`;
}

function wireImageFallbacks() {
  root.querySelectorAll('[data-crest-img]').forEach((img) => {
    img.addEventListener('error', () => {
      const wrap = img.closest('.sa-crest-wrap');
      if (!wrap) return;
      wrap.classList.add('sa-crest-fallback');
      wrap.style.setProperty('--hue', img.dataset.fallbackHue || '210');
      wrap.textContent = img.dataset.fallbackText || '?';
    }, { once: true });
  });
}

function matchStatusClass(f) {
  if (['1H', '2H', 'ET', 'P', 'BT', 'LIVE'].includes(f.statusShort)) return 'live';
  if (['FT', 'AET', 'PEN'].includes(f.statusShort)) return 'ft';
  return 'upcoming';
}

function statusBadge(f) {
  const cls = matchStatusClass(f);
  if (cls === 'live') return `<span class="sa-badge sa-badge-live"><span class="sa-live-dot"></span>${f.elapsed ? `${f.elapsed}'` : 'LIVE'}</span>`;
  if (cls === 'ft') return `<span class="sa-badge sa-badge-ft">Матч завершён</span>`;
  if (!f.timestamp) return '';
  // Дата тут без времени — время того же матча уже крупно показано в самом
  // табло (scoreOrTimeHTML), дублировать его в бейдже больше не нужно.
  const d = new Date(f.timestamp * 1000);
  return `<span class="sa-badge sa-badge-upcoming">${d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}</span>`;
}

function scoreOrTimeHTML(f) {
  const hasScore = (f.goalsHome ?? f.goalsAway) != null;
  if (hasScore) {
    return `<div class="sa-score"><span>${f.goalsHome ?? '–'}</span><em>:</em><span>${f.goalsAway ?? '–'}</span></div>`;
  }
  if (f.timestamp) {
    const d = new Date(f.timestamp * 1000);
    return `<div class="sa-score sa-score-time">${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>`;
  }
  return `<div class="sa-score sa-score-time">vs</div>`;
}

function fixtureRowHTML(f) {
  const cls = matchStatusClass(f);
  // Раньше вся строка была одной <button> с data-team жёстко на f.home.id —
  // тап по строке всегда вёл на домашнюю команду, даже если человек целился
  // в гостевую (а если на странице команды текущий клуб как раз был "дома",
  // клик вообще никуда не вёл — открывал ту же самую карточку). Теперь дом и
  // гости — две отдельные кнопки, каждая ведёт на свою команду.
  return `
  <div class="sa-fixture sa-fixture-${cls}">
    <div class="sa-fixture-status">${statusBadge(f)}</div>
    <div class="sa-fixture-main">
      <button class="sa-fixture-team" data-team="${f.home.id ?? ''}">${crestHTML(f.home, 'md')}<span class="sa-fixture-team-name">${esc(f.home.name)}</span></button>
      <div class="sa-fixture-score-block">${scoreOrTimeHTML(f)}</div>
      <button class="sa-fixture-team sa-fixture-team-away" data-team="${f.away.id ?? ''}"><span class="sa-fixture-team-name">${esc(f.away.name)}</span>${crestHTML(f.away, 'md')}</button>
    </div>
  </div>`;
}

// --- Публичный вход/выход из модуля --------------------------------------

export function openSportApp() {
  // Запоминаем, откуда открывают модуль (вкладка каталога ИЛИ страница
  // конкретного продукта) — раньше это работало только для вкладок, и
  // "назад" из Sport App всегда уводил на дашборд, даже если модуль открыли
  // со страницы продукта (см. navigation.js).
  captureReturnTarget();

  document.querySelectorAll('.tab').forEach((tabEl) => tabEl.classList.remove('active'));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('view-sport-app').classList.add('active');

  root = document.getElementById('view-sport-app');
  screenStack = [{ name: 'home' }];
  homeState = { popular: null, error: null };
  searchState = { query: '', results: null, loading: false, error: null };
  render();
  refreshLiveBadge();
}

export function closeSportApp() {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const target = getReturnTarget();
  if (reopenProductIfNeeded(target)) return;
  const targetView = document.getElementById('view-' + target.view);
  if (targetView) targetView.classList.add('active');
  const tab = document.querySelector(`.tab[data-view="${target.view}"]`);
  if (tab) tab.classList.add('active');
}

async function refreshLiveBadge() {
  try {
    const data = await sportApi.liveMatches();
    apiConfigured = data.configured;
    liveCount = (data.matches || []).length;
    const el = root && root.querySelector('[data-live-count]');
    if (el) {
      el.textContent = liveCount;
      el.closest('.sa-tile-live')?.classList.toggle('has-live', liveCount > 0);
    }
  } catch { /* тихо — бейдж live необязателен для работы экрана */ }
}

// --- Главный рендер --------------------------------------------------------

function render() {
  if (!root) return;
  const screen = current();
  const canGoBack = screenStack.length > 1;

  let inner = '';
  switch (screen.name) {
    case 'home': inner = renderHome(); break;
    case 'search': inner = renderSearch(screen.params); break;
    case 'team': inner = renderTeam(screen.params); break;
    case 'live': inner = renderLive(); break;
    default: inner = renderHome();
  }

  root.innerHTML = `
    <div class="sport-app">
      <div class="sa-topbar">
        ${canGoBack ? backButtonHTML(screen.name === 'home' ? 'Экосистема' : 'Назад') : `<button class="sa-back" data-sa-exit>← К экосистеме</button>`}
        <div class="sa-brand">${icon('ball')} AI Sport</div>
      </div>
      <div class="sa-body">${inner}</div>
    </div>`;

  wireCommon();
  wireImageFallbacks();
  wireScreen(screen);
}

function wireCommon() {
  const backBtn = root.querySelector('[data-sa-back]');
  if (backBtn) backBtn.addEventListener('click', () => { haptic('light'); back(); });
  const exitBtn = root.querySelector('[data-sa-exit]');
  if (exitBtn) exitBtn.addEventListener('click', () => { haptic('light'); closeSportApp(); });

  root.querySelectorAll('[data-team]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.team;
      if (!id || id === 'null' || id === 'undefined') return;
      haptic('light');
      push('team', { id });
    });
  });
}

// =========================================================================
// Экран: Home
// =========================================================================

let homeState = { popular: null, error: null };

function renderHome() {
  if (!homeState.popular && !homeState.error) {
    loadHomeAsync();
  }

  const grid = homeState.error
    ? errorHTML(homeState.error)
    : !homeState.popular
      ? loadingHTML('Загружаю команды…')
      : `<div class="sa-team-grid">
          ${homeState.popular.map((t) => `
            <button class="sa-team-card" data-team-click data-id="${t.id ?? ''}" data-name="${esc(t.name)}">
              ${crestHTML(t, 'lg')}
              <span class="sa-team-card-name">${esc(t.name)}</span>
              ${t.country ? `<span class="sa-team-card-country">${esc(t.country)}</span>` : ''}
            </button>`).join('')}
        </div>`;

  const configuredHint = apiConfigured === false
    ? `<div class="sa-hint-block">Источник живых данных (api-football) пока не подключён на сервере — показываем команды по названиям без гербов и статистики. Как только появится ключ API, здесь честно появятся реальные данные.</div>`
    : '';

  return `
  <div class="sa-hero">
    <div class="sa-hero-title">Команды и матчи в одном месте</div>
    <div class="sa-hero-sub">Найдите клуб, посмотрите форму, ближайший матч и live-счёт — без переключения между источниками.</div>
    <div class="sa-search-row">
      <input type="text" class="sa-search-input" placeholder="Найти команду… например, Реал Мадрид" data-search-input>
      <button class="sa-search-btn" data-search-go>Найти</button>
    </div>
  </div>

  <button class="sa-tile-live" data-go-live>
    <div class="sa-tile-live-left">
      <span class="sa-live-dot"></span>
      <div>
        <div class="sa-tile-live-title">Матчи сейчас</div>
        <div class="sa-tile-live-sub">Смотреть live-табло</div>
      </div>
    </div>
    <span class="sa-tile-live-count" data-live-count>${liveCount}</span>
  </button>

  ${configuredHint}

  <div class="sa-section-head"><h2>Популярные команды</h2></div>
  ${grid}`;
}

async function loadHomeAsync() {
  try {
    const [popularData, statusData] = await Promise.all([sportApi.popularTeams(), sportApi.status()]);
    apiConfigured = statusData.configured;
    homeState = { popular: popularData.teams, error: null };
    render();
  } catch (e) {
    homeState = { popular: null, error: e.message };
    render();
  }
}

function wireHome() {
  root.querySelectorAll('[data-team-click]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic('light');
      const id = btn.dataset.id;
      if (id) push('team', { id });
      else push('search', { query: btn.dataset.name });
    });
  });

  const input = root.querySelector('[data-search-input]');
  const goBtn = root.querySelector('[data-search-go]');
  const doSearch = () => {
    const q = (input.value || '').trim();
    if (q.length < 2) { haptic('light'); return; }
    haptic('light');
    push('search', { query: q });
  };
  if (goBtn) goBtn.addEventListener('click', doSearch);
  if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

  const liveBtn = root.querySelector('[data-go-live]');
  if (liveBtn) liveBtn.addEventListener('click', () => { haptic('light'); push('live'); });
}

// =========================================================================
// Экран: поиск команд
// =========================================================================

let searchState = { query: '', results: null, loading: false, error: null };

function renderSearch(params) {
  if (params && params.query && params.query !== searchState.query) {
    searchState = { query: params.query, results: null, loading: false, error: null };
  }
  if (!searchState.results && !searchState.loading && !searchState.error) {
    loadSearchAsync(searchState.query);
  }

  let body;
  if (searchState.loading) body = loadingHTML('Ищу команды…');
  else if (searchState.error) body = errorHTML(searchState.error);
  else if (searchState.results && searchState.results.length === 0) {
    body = `<div class="sa-empty"><p>По запросу «${esc(searchState.query)}» ничего не нашлось.</p></div>`;
  } else if (searchState.results) {
    body = `<div class="sa-team-grid">
      ${searchState.results.map((t) => `
        <button class="sa-team-card" data-team-click data-id="${t.id}" data-name="${esc(t.name)}">
          ${crestHTML(t, 'lg')}
          <span class="sa-team-card-name">${esc(t.name)}</span>
          ${t.country ? `<span class="sa-team-card-country">${esc(t.country)}</span>` : ''}
        </button>`).join('')}
    </div>`;
  } else {
    body = loadingHTML();
  }

  return `
  <h2 class="sa-h2">Поиск: «${esc(searchState.query)}»</h2>
  <div class="sa-search-row">
    <input type="text" class="sa-search-input" placeholder="Другая команда…" value="${esc(searchState.query)}" data-search-input>
    <button class="sa-search-btn" data-search-go>Найти</button>
  </div>
  ${body}`;
}

async function loadSearchAsync(query) {
  searchState = { ...searchState, loading: true, error: null };
  try {
    const data = await sportApi.searchTeams(query);
    if (data.configured === false) {
      searchState = { query, results: [], loading: false, error: null, unconfigured: true };
      render();
      return;
    }
    searchState = { query, results: data.teams, loading: false, error: null };
    render();
  } catch (e) {
    searchState = { query, results: null, loading: false, error: e.message };
    render();
  }
}

function wireSearch() {
  // Карточки команд и поисковая строка используют те же data-атрибуты и
  // обработчики, что и на домашнем экране — переиспользуем wireHome(),
  // чтобы не дублировать логику (и не навешивать обработчики дважды).
  wireHome();
}

// =========================================================================
// Экран: карточка команды
// =========================================================================

let teamState = { id: null, team: null, matches: null, error: null };

function matchResult(f, teamId) {
  const isHome = String(f.home.id) === String(teamId);
  const my = isHome ? f.home : f.away;
  const opp = isHome ? f.away : f.home;
  let result = 'D';
  if (my.winner === true) result = 'W';
  else if (my.winner === false) result = 'L';
  return { result, opp };
}

function formBadgeHTML(f, teamId) {
  const { result, opp } = matchResult(f, teamId);
  const label = { W: 'Победа', D: 'Ничья', L: 'Поражение' }[result];
  return `<span class="sa-form-dot sa-form-${result}" title="${label} vs ${esc(opp.name)}">${result}</span>`;
}

// Сводка над рядом кружков — раньше смысл "П/Н/В" был доступен только через
// title="" при наведении, что бесполезно на тач-экране. Теперь то же самое
// видно сразу текстом, без необходимости тапать/наводить на каждый кружок.
function formSummaryHTML(matches, teamId) {
  const counts = { W: 0, D: 0, L: 0 };
  matches.forEach((f) => { counts[matchResult(f, teamId).result]++; });
  return `<div class="sa-form-summary">${counts.W} побед · ${counts.D} ничьих · ${counts.L} поражений — последние ${matches.length} игр</div>`;
}

function renderTeam(params) {
  if (params.id !== teamState.id) {
    teamState = { id: params.id, team: null, matches: null, error: null };
  }
  if (!teamState.team && !teamState.error) {
    loadTeamAsync(params.id);
  }

  if (teamState.error) return errorHTML(teamState.error);
  if (!teamState.team) return loadingHTML('Загружаю карточку команды…');

  const t = teamState.team;
  const matches = teamState.matches;

  return `
  <div class="sa-team-hero">
    ${crestHTML(t, 'xl')}
    <div class="sa-team-hero-name">${esc(t.name)}</div>
    <div class="sa-team-hero-meta">
      ${t.country ? `<span>${esc(t.country)}</span>` : ''}
      ${t.founded ? `<span>· Основан в ${t.founded}</span>` : ''}
    </div>
  </div>

  ${t.venue && t.venue.name ? `
  <div class="sa-venue-card">
    <div class="sa-venue-icon">${icon('stadium')}</div>
    <div>
      <div class="sa-venue-name">${esc(t.venue.name)}</div>
      <div class="sa-venue-sub">${[t.venue.city, t.venue.capacity ? `вместимость ${Number(t.venue.capacity).toLocaleString('ru-RU')}` : null].filter(Boolean).map(esc).join(' · ')}</div>
    </div>
  </div>` : ''}

  ${!matches ? loadingHTML('Загружаю матчи…') : `
    ${matches.recent && matches.recent.length ? `
    <div class="sa-section-head"><h2>Форма</h2></div>
    <div class="sa-form-card">
      <div class="sa-form-row">${matches.recent.map((f) => formBadgeHTML(f, t.id)).join('')}</div>
      ${formSummaryHTML(matches.recent, t.id)}
    </div>
    <div class="sa-fixture-list">${matches.recent.map(fixtureRowHTML).join('')}</div>` : ''}

    ${matches.upcoming && matches.upcoming.length ? `
    <div class="sa-section-head"><h2>Ближайшие матчи</h2></div>
    <div class="sa-fixture-list">${matches.upcoming.map(fixtureRowHTML).join('')}</div>` : ''}

    ${(!matches.recent || !matches.recent.length) && (!matches.upcoming || !matches.upcoming.length) ? `
    <div class="sa-empty"><p>Нет данных о матчах этой команды за доступный период.</p></div>` : ''}
  `}`;
}

async function loadTeamAsync(id) {
  try {
    const [teamData, matchesData] = await Promise.all([sportApi.teamDetail(id), sportApi.teamMatches(id)]);
    teamState = { id, team: teamData.team, matches: matchesData, error: null };
    render();
  } catch (e) {
    const msg = e instanceof SportApiError && e.status === 503
      ? 'Раздел AI Sport временно не подключён к источнику данных — попробуйте позже.'
      : e.message;
    teamState = { id, team: null, matches: null, error: msg };
    render();
  }
}

function wireTeam() {
  // Кнопка "Повторить" при ошибке обрабатывается централизованно в wireRetry().
}

// =========================================================================
// Экран: live-табло
// =========================================================================

let liveState = { matches: null, loading: false, error: null, configured: null };

function renderLive() {
  if (!liveState.matches && !liveState.loading && !liveState.error) {
    loadLiveAsync();
  }

  let body;
  if (liveState.loading) body = loadingHTML('Обновляю live-табло…');
  else if (liveState.error) body = errorHTML(liveState.error);
  else if (liveState.configured === false) {
    body = `<div class="sa-empty"><p>Источник live-данных пока не подключён на сервере. Как только ключ API появится — здесь будут реальные матчи, идущие прямо сейчас.</p></div>`;
  } else if (liveState.matches && liveState.matches.length === 0) {
    body = `<div class="sa-empty"><p>Сейчас нет матчей в прямом эфире. Загляните позже — табло обновляется автоматически.</p></div>`;
  } else if (liveState.matches) {
    body = `<div class="sa-fixture-list">${liveState.matches.map(fixtureRowHTML).join('')}</div>`;
  } else {
    body = loadingHTML();
  }

  return `
  <div class="sa-live-head">
    <h2 class="sa-h2"><span class="sa-live-dot"></span> Матчи сейчас</h2>
    <button class="sa-btn-ghost" data-refresh-live>${icon('refresh')} Обновить</button>
  </div>
  ${body}`;
}

async function loadLiveAsync() {
  liveState = { ...liveState, loading: true, error: null };
  try {
    const data = await sportApi.liveMatches();
    liveState = { matches: data.matches, loading: false, error: null, configured: data.configured };
    liveCount = (data.matches || []).length;
    render();
  } catch (e) {
    liveState = { matches: null, loading: false, error: e.message, configured: null };
    render();
  }
}

function wireLive() {
  const btn = root.querySelector('[data-refresh-live]');
  if (btn) btn.addEventListener('click', () => { haptic('light'); liveState = { matches: null, loading: false, error: null, configured: null }; render(); });
}

// =========================================================================
// Диспетчер обработчиков конкретного экрана
// =========================================================================

function wireScreen(screen) {
  switch (screen.name) {
    case 'home': wireHome(); break;
    case 'search': wireSearch(); break;
    case 'team': wireTeam(); break;
    case 'live': wireLive(); break;
  }
  wireRetry(screen);
}

// Единая точка обработки кнопки "Повторить" (errorHTML()) — какой бы экран её
// ни отрисовал, здесь понятно, какое состояние сбросить и перезапустить.
function wireRetry(screen) {
  const btn = root.querySelector('[data-retry]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    haptic('light');
    if (screen.name === 'home') homeState = { popular: null, error: null };
    else if (screen.name === 'search') searchState = { ...searchState, results: null, loading: false, error: null };
    else if (screen.name === 'team') teamState = { id: null, team: null, matches: null, error: null };
    else if (screen.name === 'live') liveState = { matches: null, loading: false, error: null, configured: null };
    render();
  });
}
