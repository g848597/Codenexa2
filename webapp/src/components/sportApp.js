// AI Sport — веб-модуль поверх REST API /api/sport/* (см. src/config/sportApi.js).
// Открывается кнопкой запуска на странице продукта (productDetail.js), поверх
// той же системы .view, что и остальные полноэкранные разделы приложения.
// Архитектура — тот же паттерн стека экранов, что и в docsApp.js: без
// виртуального DOM, render() каждый раз перерисовывает верхний экран целиком.

import { sportApi, SportApiError } from '../config/sportApi.js';
import { authApi } from '../api/authApi.js';
import { haptic } from '../telegram.js';
import { captureReturnTarget, getReturnTarget, reopenProductIfNeeded } from '../navigation.js';
import { esc } from '../utils/html.js';
import { icon } from '../utils/icons.js';
import { backButtonHTML as _backButtonHTML, errorHTML as _errorHTML, loadingHTML as _loadingHTML } from '../utils/loadingState.js';
import { showPlanCheckout } from './planCheckoutModal.js';

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

// Прогноз (см. app/web/integrations/predictions.py) показывается только для
// предстоящих матчей (NS) — для сыгранных/идущих сейчас прогноз не имеет
// смысла. showPrediction=false используется на экранах, где матч уже не в
// контексте тарифной квоты дня (карточка команды, live-табло) — там прогноз
// не запрашивается бэкендом вовсе, поэтому f.prediction всегда undefined.
function predictionChipHTML(f) {
  if (f.statusShort !== 'NS') return '';
  if (f.prediction) {
    const p = f.prediction;
    return `
    <div class="sa-pred-chip sa-pred-${esc(p.pick)}">
      <span class="sa-pred-label">${icon('sparkles')} ${esc(p.label)}</span>
      <span class="sa-pred-bar"><span class="sa-pred-bar-fill" style="width:${p.confidence}%"></span></span>
      <span class="sa-pred-conf">${p.confidence}%</span>
      <span class="sa-pred-basis">${esc(p.basis)}</span>
    </div>`;
  }
  if (f.prediction === null) {
    return `
    <button class="sa-pred-chip sa-pred-locked" data-open-pro>
      <span>${icon('lock')} Прогноз на этот матч — в старшем тарифе</span>
    </button>`;
  }
  return '';
}

// Строка "лига · время" над карточкой — данные из f.league (см.
// footballdata.py: _map_league_ref), появились вместе с исправлением
// эндпоинта /matches/date/{date}. Раньше поля league в fixture вообще не
// было, поэтому в списке матчей нельзя было понять, из какого чемпионата
// каждая строка — особенно заметно, когда день показывает сразу 5 лиг подряд.
function fixtureMetaHTML(f) {
  const bits = [];
  if (f.league && f.league.name) bits.push(esc(f.league.name));
  if (f.timestamp && f.statusShort === 'NS') {
    const d = new Date(f.timestamp * 1000);
    bits.push(d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
  }
  if (!bits.length) return '';
  return `<div class="sa-fixture-meta">${bits.join(' <span class="sa-fixture-meta-dot">·</span> ')}</div>`;
}

// Реальные коэффициенты букмекеров (f.odds — П1/Х/П2, см. footballdata.py:
// _map_odds), когда источник их отдаёт для предстоящего матча. Это НЕ то же
// самое, что прогноз ИИ (predictionChipHTML) — коэффициенты показываются
// отдельной строкой с явной подписью "Коэффициенты", чтобы два разных вида
// чисел (рыночная цена букмекера vs модель по форме команд) не сливались
// в один блок и не выглядели как один и тот же прогноз, посчитанный дважды.
function oddsStripHTML(f) {
  if (f.statusShort !== 'NS' || !f.odds) return '';
  const { home, draw, away } = f.odds;
  if (home == null && draw == null && away == null) return '';
  const cell = (label, val) => `<div class="sa-odds-cell"><span class="sa-odds-label">${label}</span><span class="sa-odds-val">${val != null ? Number(val).toFixed(2) : '—'}</span></div>`;
  return `
  <div class="sa-odds-strip">
    <span class="sa-odds-title">${icon('scale')}<span>Коэффициенты</span></span>
    <div class="sa-odds-cells">
      ${cell('П1', home)}
      ${cell('X', draw)}
      ${cell('П2', away)}
    </div>
  </div>`;
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
    <div class="sa-fixture-status">${statusBadge(f)}${fixtureMetaHTML(f)}</div>
    <div class="sa-fixture-main">
      <button class="sa-fixture-team" data-team="${f.home.id ?? ''}">${crestHTML(f.home, 'md')}<span class="sa-fixture-team-name">${esc(f.home.name)}</span></button>
      <div class="sa-fixture-score-block">${scoreOrTimeHTML(f)}</div>
      <button class="sa-fixture-team sa-fixture-team-away" data-team="${f.away.id ?? ''}"><span class="sa-fixture-team-name">${esc(f.away.name)}</span>${crestHTML(f.away, 'md')}</button>
    </div>
    ${predictionChipHTML(f)}
    ${oddsStripHTML(f)}
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
  homeLive = { matches: null, loaded: false };
  tierState = { loaded: false, tier: 'free', tierTitle: 'Бесплатный', daysUnlocked: 1, predMin: 1, predMax: 3 };
  dayMatches = { day: 0, revealed: false, matches: null, dayLocked: false, total: 0, predictedCount: 0, loaded: false, error: null };
  plansState = { plans: null };
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
      ${canGoBack ? `
      <div class="sa-topbar">
        ${backButtonHTML('Назад')}
        <div class="sa-brand">${icon('ball')} AI Sport</div>
      </div>` : `
      <div class="sa-header">
        <button class="sa-header-left" data-sa-exit aria-label="К экосистеме CodeNexa">
          <span class="sa-avatar">CN</span>
          <span class="sa-header-titles">
            <span class="sa-header-title">AI Sport</span>
            <span class="sa-header-sub">by CodeNexa</span>
          </span>
        </button>
        <div class="sa-header-right">
          <button class="sa-pro-pill" data-open-pro>${icon('crown')} PRO</button>
          <button class="sa-bell-btn" data-go-live aria-label="Live-матчи">${icon('bell')}${liveCount > 0 ? '<span class="sa-bell-dot"></span>' : ''}</button>
        </div>
      </div>`}
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

  // Тарифы и оплата — мини-окно поверх текущего экрана (см.
  // components/planCheckoutModal.js), а не переход на вкладку "Аккаунт".
  // В wireCommon(), а не только в wireHome(), т.к. кнопка "PRO" в шапке и
  // залоченные чипы прогнозов встречаются и на экранах команды/live-табло.
  // Оплата идёт через тот же authApi.checkout(), которым пользуется личный
  // кабинет — тарифы/цены общие для всей экосистемы CodeNexa, здесь только
  // другая точка входа в тот же биллинг.
  root.querySelectorAll('[data-plan-code]').forEach((btn) => btn.addEventListener('click', () => {
    haptic('light');
    openSportPlanCheckout(btn.dataset.planCode);
  }));
  root.querySelectorAll('[data-open-pro]').forEach((btn) => btn.addEventListener('click', () => {
    haptic('light');
    openSportPlanCheckout(null);
  }));
}

// =========================================================================
// Экран: Home
// =========================================================================

let homeState = { popular: null, error: null };
let homeLive = { matches: null, loaded: false };
let plansState = { plans: null }; // реальные тарифы — authApi.plans() (см. accountApp.js/billingHTML)
// Тариф текущего пользователя (см. /api/sport/tier, sport_common.py TIER_RULES)
// — определяет, сколько дней вперёд открыто и сколько матчей в день получают
// прогноз. free по умолчанию, пока реальный ответ ещё не пришёл — так гость
// не увидит на долю секунды состояние "всё открыто", которое тут же схлопнется.
let tierState = { loaded: false, tier: 'free', tierTitle: 'Бесплатный', daysUnlocked: 1, predMin: 1, predMax: 3 };
// "Матчи по дням" — раньше грузились и показывались сразу при открытии
// раздела. Теперь явный шаг: домашний экран показывает тизер с квотой
// тарифа и кнопку "Показать матчи" — revealed=true только после тапа
// (см. владелец продукта: "нету кнопки просмотр матчей, даётся сразу").
let dayMatches = { day: 0, revealed: false, matches: null, dayLocked: false, total: 0, predictedCount: 0, loaded: false, error: null };

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

  // "Матчи по дням" — реальные фикстуры (см. /api/sport/matches?day=N).
  // Тариф определяет: (1) сколько дней вперёд вообще открыто — daysUnlocked
  // (см. /api/sport/tier), (2) сколько матчей в день получают прогноз —
  // predMin..predMax. Список матчей на открытых днях всегда полный и
  // настоящий; ограничивается именно число прогнозов, а не сами матчи.
  const DAY_LABELS = ['Сегодня', 'Завтра', '+2 дня', '+3 дня'];
  const daysUnlocked = tierState.daysUnlocked;

  const dayTabsHTML = `<div class="sa-day-tabs">
    ${DAY_LABELS.map((label, i) => {
      const locked = i >= daysUnlocked;
      const active = dayMatches.revealed && dayMatches.day === i && !locked;
      return `<button class="sa-day-tab ${active ? 'active' : ''} ${locked ? 'sa-day-tab-locked' : ''}" data-day="${i}" ${locked ? 'data-day-locked' : ''}>
        ${label}${locked ? icon('lock') : ''}
      </button>`;
    }).join('')}
  </div>`;

  let dayBody;
  if (!dayMatches.revealed) {
    // Тизер вместо автозагрузки — человек явно решает "показать матчи",
    // а не утыкается в список ещё до того, как понял тариф и квоту.
    dayBody = `
    <div class="sa-day-teaser">
      <div class="sa-day-teaser-row">
        <span class="sa-day-teaser-tier">${icon('layers')} Тариф «${esc(tierState.tierTitle)}»</span>
        <span class="sa-day-teaser-quota">до ${daysUnlocked} ${daysUnlocked === 1 ? 'дня' : 'дней'} вперёд · ${tierState.predMin}–${tierState.predMax} прогнозов в день</span>
      </div>
      <button class="sa-btn-primary sa-day-reveal" data-reveal-matches>${icon('zap')} Показать матчи</button>
    </div>`;
  } else if (dayMatches.error) {
    dayBody = errorHTML(dayMatches.error);
  } else if (!dayMatches.loaded) {
    dayBody = loadingHTML('Загружаю матчи…');
  } else if (dayMatches.dayLocked) {
    dayBody = `
    <div class="sa-upsell" data-open-pro>
      ${icon('lock')} Этот день закрыт на тарифе «${esc(tierState.tierTitle)}» — откройте в тарифе выше
    </div>`;
  } else if (!dayMatches.matches || !dayMatches.matches.length) {
    dayBody = `<div class="sa-empty-mini">${DAY_LABELS[dayMatches.day]}: матчей по отслеживаемым лигам не найдено.</div>`;
  } else {
    const hiddenPred = dayMatches.total > 0 ? Math.max(0, dayMatches.matches.filter((f) => f.statusShort === 'NS').length - dayMatches.predictedCount) : 0;
    dayBody = `<div class="sa-fixture-list">${dayMatches.matches.map(fixtureRowHTML).join('')}</div>
      ${hiddenPred > 0 ? `
        <button class="sa-upsell" data-open-pro>
          ${icon('crown')} Ещё ${hiddenPred} ${hiddenPred === 1 ? 'прогноз' : 'прогнозов'} доступно в старшем тарифе
        </button>` : ''}`;
  }

  const daySection = `
  <div class="sa-section-head sa-day-head">
    <h2>Матчи по дням</h2>
    ${dayTabsHTML}
  </div>
  ${dayBody}`;

  let liveSection = '';
  if (homeLive.loaded && homeLive.matches && homeLive.matches.length) {
    liveSection = `
    <div class="sa-section-head"><h2>Матчи сейчас <span class="sa-live-dot"></span></h2></div>
    <div class="sa-fixture-list">${homeLive.matches.slice(0, 3).map(fixtureRowHTML).join('')}</div>`;
  }

  // Тарифы: реальные данные из /api/billing/plans (то же, что в личном
  // кабинете). Код тарифа определяет "линейку" (start/pro/business —
  // см. app/web/integrations/sport_common.py tier_from_plan_code — тот же
  // префикс до "_", здесь только для подписи квоты и подсветки текущего
  // тарифа, реальные цифры доступа считает бэкенд).
  const TIER_QUOTA = { start: '2 дня · до 6 прогнозов', pro: '3 дня · до 9 прогнозов', business: '4 дня · до 12 прогнозов' };
  const tierOf = (code) => String(code || '').split('_')[0];
  const plans = (plansState.plans || []).slice(0, 4);
  const recommendedCode = plans.find((p) => tierOf(p.code) === 'pro')?.code;
  const plansSection = plans.length ? `
  <div class="sa-section-head sa-plans-head">
    <h2>Выберите подписку</h2>
    <button class="sa-link-btn" data-open-pro>Все тарифы ${icon('arrowRight')}</button>
  </div>
  <div class="sa-plan-row">
    ${plans.map((p) => {
      const t = tierOf(p.code);
      const isCurrent = tierState.loaded && t === tierState.tier;
      const isFeatured = p.code === recommendedCode && !isCurrent;
      return `
      <button class="sa-plan-card ${isFeatured ? 'sa-plan-featured' : ''} ${isCurrent ? 'sa-plan-current' : ''}" data-plan-code="${esc(p.code)}">
        <span class="sa-plan-title">${esc(p.title)}</span>
        <span class="sa-plan-price">$${esc(p.usd)}<em>/ ${esc(String(p.stars))} ${icon('star')}</em></span>
        ${TIER_QUOTA[t] ? `<span class="sa-plan-quota">${TIER_QUOTA[t]}</span>` : ''}
        ${isCurrent ? `<span class="sa-plan-badge sa-plan-badge-current">${icon('checkCircle')} Ваш тариф</span>`
          : isFeatured ? `<span class="sa-plan-badge">${icon('star')} Популярный</span>` : ''}
      </button>`;
    }).join('')}
  </div>` : '';

  return `
  <div class="sa-hero">
    <div class="sa-hero-badges">
      <div class="sa-hero-stat"><span>${icon('ball')} Данные</span><strong>api-football</strong></div>
      <div class="sa-hero-stat sa-hero-stat-roi"><span>${icon('bell')} Live сейчас</span><strong data-live-count>${liveCount}</strong></div>
    </div>
    <div class="sa-hero-ball" aria-hidden="true">${icon('ball')}</div>
    <h1 class="sa-hero-title">Команды, live-счёт<br><em>и статистика клубов.</em></h1>
    <p class="sa-hero-sub">Ищите клуб, смотрите форму и ближайшие матчи по реальным данным api-football — без выдуманных прогнозов и коэффициентов.</p>

    <div class="sa-search-row">
      <input type="text" class="sa-search-input" placeholder="Найти команду… например, Реал Мадрид" data-search-input>
      <button class="sa-search-btn" data-search-go>Найти</button>
    </div>

    <div class="sa-action-row">
      <button class="sa-action-btn sa-action-primary" data-go-live>${icon('zap')} Live-матчи</button>
      <button class="sa-action-btn" data-scroll-teams>${icon('trophy')} Топ клубы</button>
      <button class="sa-action-btn" data-open-pro>${icon('crown')} PRO-тарифы</button>
    </div>
  </div>

  <div class="sa-tile-grid">
    <button class="sa-tile" data-scroll-teams>${icon('trophy')}<span>Топ клубы</span><em>Список</em></button>
    <button class="sa-tile" data-go-live>${icon('calendar')}<span>Live сейчас</span><em data-live-count>${liveCount}</em></button>
    <button class="sa-tile" data-focus-search>${icon('search')}<span>Поиск</span><em>Любой клуб</em></button>
    <button class="sa-tile" data-open-pro>${icon('layers')}<span>PRO-тарифы</span><em>Подписка</em></button>
    <button class="sa-tile sa-tile-exit" data-sa-exit>${icon('globe')}<span>Экосистема</span><em>CodeNexa</em></button>
  </div>

  ${plansSection}

  ${daySection}

  ${liveSection || (apiConfigured !== false ? `<div class="sa-empty-mini">Live-матчей прямо сейчас нет — загляните позже, табло обновляется автоматически.</div>` : '')}

  ${configuredHint}

  <div class="sa-section-head"><h2 id="sa-teams-anchor">Популярные команды</h2></div>
  ${grid}`;
}

async function loadHomeAsync() {
  try {
    const [popularData, statusData, liveData, plansData, tierData] = await Promise.all([
      sportApi.popularTeams(),
      sportApi.status(),
      sportApi.liveMatches().catch(() => null),
      authApi.plans().catch(() => ({ plans: [] })),
      sportApi.tier().catch(() => null),
    ]);
    apiConfigured = statusData.configured;
    homeState = { popular: popularData.teams, error: null };
    plansState = { plans: plansData.plans || [] };
    if (tierData) {
      tierState = { loaded: true, tier: tierData.tier, tierTitle: tierData.tierTitle, daysUnlocked: tierData.daysUnlocked, predMin: tierData.predMin, predMax: tierData.predMax };
    }
    if (liveData) {
      homeLive = { matches: liveData.matches, loaded: true };
      liveCount = (liveData.matches || []).length;
    } else {
      homeLive = { matches: null, loaded: true };
    }
    render();
  } catch (e) {
    homeState = { popular: null, error: e.message };
    render();
  }
}

async function loadDayMatches(day) {
  dayMatches = { day, revealed: true, matches: null, dayLocked: false, total: 0, predictedCount: 0, loaded: false, error: null };
  render();
  try {
    const data = await sportApi.matchesByDay(day);
    // Ответ несёт и актуальный тариф — если подписка поменялась в другой
    // вкладке (например, только что оплатили), квота на экране обновится
    // без перезахода в раздел.
    if (data.tier) {
      tierState = { loaded: true, tier: data.tier, tierTitle: data.tierTitle, daysUnlocked: data.daysUnlocked, predMin: data.predMin, predMax: data.predMax };
    }
    dayMatches = {
      day,
      revealed: true,
      matches: data.matches || [],
      dayLocked: !!data.dayLocked,
      total: data.total || (data.matches || []).length,
      predictedCount: data.predictedCount || 0,
      loaded: true,
      error: null,
    };
  } catch (e) {
    dayMatches = { day, revealed: true, matches: null, dayLocked: false, total: 0, predictedCount: 0, loaded: true, error: e.message };
  }
  render();
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

  root.querySelectorAll('[data-go-live]').forEach((btn) => btn.addEventListener('click', () => { haptic('light'); push('live'); }));

  const focusSearchBtn = root.querySelector('[data-focus-search]');
  if (focusSearchBtn) focusSearchBtn.addEventListener('click', () => { haptic('light'); input?.focus(); input?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });

  root.querySelectorAll('[data-scroll-teams]').forEach((btn) => btn.addEventListener('click', () => {
    haptic('light');
    document.getElementById('sa-teams-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  const revealBtn = root.querySelector('[data-reveal-matches]');
  if (revealBtn) revealBtn.addEventListener('click', () => { haptic('medium'); loadDayMatches(0); });

  root.querySelectorAll('[data-day]').forEach((btn) => btn.addEventListener('click', () => {
    const day = Number(btn.dataset.day);
    if (btn.hasAttribute('data-day-locked')) {
      // День вне тарифа — не грузим ничего, сразу ведём на тарифы, чтобы не
      // притворяться, будто там просто "пока нет матчей".
      haptic('light');
      closeSportApp();
      document.querySelector('.tab[data-view="account"]')?.click();
      return;
    }
    haptic('light');
    if (!dayMatches.revealed || day !== dayMatches.day) loadDayMatches(day);
  }));

}

function openSportPlanCheckout(planCode) {
  const plans = plansState.plans || [];
  if (!plans.length) {
    // Тарифы ещё не загрузились (или бэкенд их не отдал) — самое честное
    // здесь — отправить туда, где точно есть актуальный список, а не
    // показывать пустое мини-окно.
    closeSportApp();
    document.querySelector('.tab[data-view="account"]')?.click();
    return;
  }
  showPlanCheckout({
    plans,
    planCode: planCode || undefined,
    checkout: (code, method, network) => authApi.checkout(code, method, network, crypto.randomUUID()),
    onSuccess: () => { sportApi.tier().then((tierData) => { if (tierData) { tierState = { loaded: true, tier: tierData.tier, tierTitle: tierData.tierTitle, daysUnlocked: tierData.daysUnlocked, predMin: tierData.predMin, predMax: tierData.predMax }; render(); } }).catch(() => {}); },
  });
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
