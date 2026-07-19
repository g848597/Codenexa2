// AI Docs — полноценный веб-модуль поверх REST API codenexa-docs-ai
// (см. src/config/docsApi.js). Открывается кнопкой "Открыть AI Docs" на
// странице продукта (productDetail.js) поверх той же системы .view, что и
// остальные полноэкранные разделы приложения.
//
// Архитектура внутри модуля: простой стек экранов (screenStack), каждый
// экран — объект { name, params }. render() каждый раз перерисовывает текущий
// верхний экран целиком (тот же паттерн, что и в остальном проекте — без
// виртуального DOM, достаточно для этого объёма интерактивности).

import { docsApi } from '../config/docsApi.js';
import { haptic, showAlert } from '../telegram.js';
import { captureReturnTarget, getReturnTarget, reopenProductIfNeeded } from '../navigation.js';
import { esc } from '../utils/html.js';
import { icon } from '../utils/icons.js';
import { backButtonHTML as _backButtonHTML, errorHTML as _errorHTML, loadingHTML as _loadingHTML } from '../utils/loadingState.js';
import { showPlanCheckout } from './planCheckoutModal.js';

let root = null;
let screenStack = [{ name: 'home' }];
let cache = { templatesByCategory: null, profile: null, billing: null };

// --- Общие мелкие утилиты ---------------------------------------------

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
// utils/loadingState.js — здесь только фиксация CSS-префикса 'da',
// сохранявшегося до этого раунда (da-loading/da-spinner/da-error/da-back).
function loadingHTML(label = 'Загрузка…') {
  return _loadingHTML('da', label);
}

function errorHTML(message, retryLabel = 'Повторить') {
  return _errorHTML('da', message, retryLabel);
}

function backButtonHTML(label = 'Назад') {
  return _backButtonHTML('da', label);
}

// --- Публичный вход/выход из модуля --------------------------------------

export function openDocsApp() {
  // Запоминаем, откуда открывают модуль (вкладка каталога ИЛИ страница
  // конкретного продукта) — раньше это работало только для вкладок, и
  // "назад" из AI Docs всегда уводил на дашборд, даже если модуль открыли
  // со страницы продукта (см. navigation.js).
  captureReturnTarget();

  document.querySelectorAll('.tab').forEach((tabEl) => tabEl.classList.remove('active'));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('view-docs-app').classList.add('active');

  root = document.getElementById('view-docs-app');
  screenStack = [{ name: 'home' }];
  cache = { templatesByCategory: null, profile: null, billing: null };
  homeState = { catLoading: false, catError: null, docs: null, docsTotal: 0, docsLoading: false, docsError: null };
  render();
}

export function closeDocsApp() {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const target = getReturnTarget();
  if (reopenProductIfNeeded(target)) return;
  const targetView = document.getElementById('view-' + target.view);
  if (targetView) targetView.classList.add('active');
  const tab = document.querySelector(`.tab[data-view="${target.view}"]`);
  if (tab) tab.classList.add('active');
}

// --- Главный рендер -------------------------------------------------------

function render() {
  if (!root) return;
  const screen = current();
  const canGoBack = screenStack.length > 1;

  let inner = '';
  switch (screen.name) {
    case 'home': inner = renderHome(); break;
    case 'categories': inner = renderCategories(screen.params); break;
    case 'templates': inner = renderTemplateList(screen.params); break;
    case 'wizard': inner = renderWizard(screen.params); break;
    case 'preview': inner = renderPreview(screen.params); break;
    case 'custom': inner = renderCustom(screen.params); break;
    case 'mydocs': inner = renderMyDocuments(screen.params); break;
    case 'mydoc-detail': inner = renderMyDocumentDetail(screen.params); break;
    case 'profile': inner = renderProfile(screen.params); break;
    case 'tariffs': inner = renderTariffs(screen.params); break;
    default: inner = renderHome();
  }

  root.innerHTML = `
    <div class="docs-app">
      <div class="da-topbar">
        ${canGoBack ? backButtonHTML(screen.name === 'home' ? 'Экосистема' : 'Назад') : `<button class="da-back" data-da-exit>← К экосистеме</button>`}
        <div class="da-brand">${icon('bot')} AI Docs</div>
      </div>
      <div class="da-body">${inner}</div>
    </div>`;

  wireCommon();
  wireScreen(screen);
}

function wireCommon() {
  const backBtn = root.querySelector('[data-da-back]');
  if (backBtn) backBtn.addEventListener('click', () => { haptic('light'); back(); });
  const exitBtn = root.querySelector('[data-da-exit]');
  if (exitBtn) exitBtn.addEventListener('click', () => { haptic('light'); closeDocsApp(); });
}

// =========================================================================
// Экран: Home
// =========================================================================
//
// Полностью переработанный премиальный лендинг модуля (см. CHANGES —
// редизайн главного экрана AI Docs). Архитектурно ничего не меняет: тот же
// стек экранов, те же da-* экраны дальше по стеку (categories/templates/...),
// просто "home" теперь состоит из нескольких секций, часть из которых
// подгружает реальные данные (категории шаблонов, последние документы),
// а не выдумывает цифры.

let homeState = { catLoading: false, catError: null, docs: null, docsTotal: 0, docsLoading: false, docsError: null };

function categoryIcon(title) {
  const t = (title || '').toLowerCase();
  if (/догов/.test(t)) return 'fileEdit';
  if (/юр|нда|оферт|полит/.test(t)) return 'scale';
  if (/hr|кадр|сотруд|труд/.test(t)) return 'users';
  if (/финанс|счет|счёт|оплат|инвойс|акт/.test(t)) return 'receipt';
  if (/маркет|реклам|презент/.test(t)) return 'sparkles';
  if (/бизнес|компан|тендер/.test(t)) return 'briefcase';
  return 'fileText';
}

function renderHeroIllustration() {
  // Лёгкая декоративная SVG-сцена: парящие документы + печать + подпись.
  // Никаких внешних ассетов — чистый inline SVG в токенах проекта, анимация
  // на чистом CSS (см. docsHome.css: dh-doc-float/dh-glow-pulse).
  return `
  <div class="dh-hero-illustration" aria-hidden="true">
    <svg viewBox="0 0 340 96" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="dhDocA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="var(--ledger)"/><stop offset="1" stop-color="var(--steel)"/>
        </linearGradient>
        <linearGradient id="dhDocB" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="var(--violet)"/><stop offset="1" stop-color="var(--steel)"/>
        </linearGradient>
      </defs>
      <ellipse class="dh-glow-pulse" cx="170" cy="50" rx="120" ry="30" fill="url(#dhDocA)" opacity="0.14"/>
      <g transform="translate(30,18)">
        <g class="dh-doc-float" style="--r:-6deg">
          <rect width="46" height="60" rx="5" fill="var(--bg-elevated)" stroke="url(#dhDocA)" stroke-width="1.4"/>
          <rect x="9" y="12" width="28" height="3" rx="1.5" fill="var(--text-faint)"/>
          <rect x="9" y="20" width="28" height="3" rx="1.5" fill="var(--text-faint)" opacity=".6"/>
          <rect x="9" y="28" width="18" height="3" rx="1.5" fill="var(--text-faint)" opacity=".4"/>
          <text x="9" y="48" font-family="var(--font-mono)" font-size="9" fill="var(--ledger)">PDF</text>
        </g>
      </g>
      <g transform="translate(145,6)">
        <g class="dh-doc-float d2" style="--r:4deg">
          <rect width="52" height="66" rx="5" fill="var(--bg-elevated)" stroke="url(#dhDocB)" stroke-width="1.4"/>
          <rect x="10" y="13" width="32" height="3" rx="1.5" fill="var(--text-faint)"/>
          <rect x="10" y="21" width="32" height="3" rx="1.5" fill="var(--text-faint)" opacity=".6"/>
          <rect x="10" y="29" width="20" height="3" rx="1.5" fill="var(--text-faint)" opacity=".4"/>
          <path d="M12 50 q6 -8 12 0 t12 0" stroke="var(--violet)" stroke-width="1.6" fill="none" stroke-linecap="round"/>
          <text x="10" y="60" font-family="var(--font-mono)" font-size="9" fill="var(--violet)">DOCX</text>
        </g>
      </g>
      <g transform="translate(250,22)">
        <g class="dh-doc-float d3" style="--r:-3deg">
          <circle cx="24" cy="24" r="23" fill="none" stroke="var(--amber)" stroke-width="1.6" opacity=".8"/>
          <circle cx="24" cy="24" r="16" fill="none" stroke="var(--amber)" stroke-width="1.2" opacity=".55"/>
          <text x="24" y="27" font-family="var(--font-mono)" font-size="7.5" fill="var(--amber)" text-anchor="middle">СВЕРЕНО</text>
        </g>
      </g>
    </svg>
  </div>`;
}

function renderHome() {
  // Категории — реальные данные API (тот же кэш, что и экран "categories").
  if (!cache.templatesByCategory && !homeState.catLoading && !homeState.catError) {
    homeState.catLoading = true;
    loadHomeCategories();
  }
  // Последние документы пользователя — тоже реальные данные (listDocuments).
  if (!homeState.docs && !homeState.docsLoading && !homeState.docsError) {
    homeState.docsLoading = true;
    loadHomeRecentDocs();
  }

  const totalTemplates = cache.templatesByCategory
    ? cache.templatesByCategory.reduce((sum, c) => sum + c.templates.length, 0)
    : null;

  return `
  <section class="dh-hero dh-fade dh-fade-1">
    <div class="dh-hero-eyebrow">${icon('sparkles')} AI Docs · CodeNexa</div>
    <h1 class="dh-hero-title">Документы <em>за минуту</em>, а не за день</h1>
    <p class="dh-hero-sub">Готовые шаблоны по категориям — отвечаете на пару вопросов в чате, а на выходе всегда чистый PDF или DOCX.</p>
    ${renderHeroIllustration()}
    <div class="dh-hero-actions">
      <button class="dh-btn-primary" data-go="categories">${icon('fileText')} Создать документ</button>
      <button class="dh-btn-secondary" data-go="custom">${icon('puzzle')} Свой текст — без шаблона</button>
      <button class="dh-hero-link" data-go="categories">Смотреть все шаблоны ${icon('arrowRight')}</button>
    </div>
  </section>

  <section class="dh-section dh-fade dh-fade-2">
    <div class="dh-section-head"><h2>Быстрый старт</h2></div>
    <div class="dh-quick">
      <button class="dh-card" data-go="categories">
        <span class="dh-card-icon">${icon('fileText')}</span>
        <span class="dh-card-title">Создать документ</span>
        <span class="dh-card-hint">По готовому шаблону</span>
      </button>
      <button class="dh-card" data-go="custom">
        <span class="dh-card-icon steel">${icon('puzzle')}</span>
        <span class="dh-card-title">Свой текст</span>
        <span class="dh-card-hint">Когда шаблона нет</span>
      </button>
      <button class="dh-card" data-go="mydocs">
        <span class="dh-card-icon">${icon('folder')}</span>
        <span class="dh-card-title">Мои документы</span>
        <span class="dh-card-hint">История и повтор</span>
      </button>
      <button class="dh-card" data-go="profile">
        <span class="dh-card-icon amber">${icon('user')}</span>
        <span class="dh-card-title">Профиль</span>
        <span class="dh-card-hint">Автоподстановка данных</span>
      </button>
      <button class="dh-card" data-go="tariffs">
        <span class="dh-card-icon violet">${icon('star')}</span>
        <span class="dh-card-title">Тарифы</span>
        <span class="dh-card-hint">FREE / PRO / BUSINESS</span>
      </button>
    </div>
  </section>

  <section class="dh-section dh-fade dh-fade-3">
    <div class="dh-section-head">
      <div><h2>Разделы документов</h2><p>Реальные категории и шаблоны вашего аккаунта</p></div>
      ${cache.templatesByCategory ? `<button class="dh-section-more" data-go="categories">Все ${icon('arrowRight')}</button>` : ''}
    </div>
    ${renderHomeCategories()}
  </section>

  <section class="dh-section dh-fade dh-fade-4">
    <div class="dh-section-head">
      <div><h2>Недавние документы</h2></div>
      ${homeState.docs && homeState.docs.length ? `<button class="dh-section-more" data-go="mydocs">Все (${homeState.docsTotal}) ${icon('arrowRight')}</button>` : ''}
    </div>
    ${renderHomeRecentDocs()}
  </section>

  <section class="dh-section dh-fade dh-fade-5">
    <div class="dh-section-head"><h2>Возможности AI Docs</h2></div>
    <div class="dh-features">
      <div class="dh-feature">${icon('download')} Экспорт в PDF и DOCX</div>
      <div class="dh-feature">${icon('zap')} Готовый документ за минуту</div>
      <div class="dh-feature">${icon('puzzle')} Свой текст, если шаблона нет</div>
      <div class="dh-feature">${icon('user')} Автоподстановка профиля</div>
      <div class="dh-feature">${icon('layers')} Шаблоны для бизнеса и HR</div>
      <div class="dh-feature">${icon('shieldCheck')} История и повтор документов</div>
    </div>
  </section>

  <section class="dh-section dh-fade dh-fade-5" style="margin-bottom:8px">
    <div class="dh-stats">
      <div class="dh-stat"><div class="dh-stat-value">${totalTemplates !== null ? totalTemplates : '—'}</div><div class="dh-stat-label">Шаблонов</div></div>
      <div class="dh-stat"><div class="dh-stat-value">${homeState.docs !== null ? homeState.docsTotal : '—'}</div><div class="dh-stat-label">Ваши документы</div></div>
      <div class="dh-stat"><div class="dh-stat-value">2</div><div class="dh-stat-label">Тарифа</div></div>
    </div>
  </section>`;
}

function renderHomeCategories() {
  if (homeState.catError) {
    return `<div class="dh-empty-inline">${icon('alertTriangle')} ${esc(homeState.catError)}<br><button class="da-btn-secondary" data-retry-home-cats style="margin-top:10px">Повторить</button></div>`;
  }
  if (!cache.templatesByCategory) {
    return `<div class="dh-cats">${['','',''].map(() => '<div class="dh-skel dh-skel-cat"></div>').join('')}</div>`;
  }
  const cats = cache.templatesByCategory.slice(0, 6);
  if (!cats.length) return `<div class="dh-empty-inline">Пока нет доступных шаблонов.</div>`;
  return `
  <div class="dh-cats">
    ${cats.map((c) => `
      <button class="dh-cat-card" data-home-cat="${esc(c.code)}">
        <span class="dh-cat-icon">${icon(categoryIcon(c.title))}</span>
        <span class="dh-cat-body">
          <span class="dh-cat-title">${esc(c.title)}</span>
          <span class="dh-cat-count">${c.templates.length} ${c.templates.length === 1 ? 'шаблон' : 'шаблонов'}</span>
        </span>
        <span class="dh-cat-arrow">${icon('arrowRight')}</span>
      </button>`).join('')}
  </div>`;
}

function renderHomeRecentDocs() {
  if (homeState.docsError) {
    return `<div class="dh-empty-inline">${icon('alertTriangle')} ${esc(homeState.docsError)}<br><button class="da-btn-secondary" data-retry-home-docs style="margin-top:10px">Повторить</button></div>`;
  }
  if (homeState.docs === null) {
    return `<div class="dh-docs">${['',''].map(() => '<div class="dh-skel dh-skel-doc"></div>').join('')}</div>`;
  }
  if (!homeState.docs.length) {
    return `<div class="dh-empty-inline">Пока нет созданных документов.<br><button class="dh-btn-primary" data-go="categories" style="margin-top:12px; display:inline-flex">Создать первый документ</button></div>`;
  }
  return `
  <div class="dh-docs">
    ${homeState.docs.map((d) => `
      <button class="dh-doc-row" data-home-doc="${d.id}">
        <span class="dh-doc-badge">${icon('fileText')}</span>
        <span class="dh-doc-info">
          <span class="dh-doc-title">${esc(d.title)}</span>
          <span class="dh-doc-meta">${esc(d.templateTitle)} · ${new Date(d.createdAt).toLocaleDateString('ru-RU')}</span>
        </span>
        <span class="dh-cat-arrow">${icon('arrowRight')}</span>
      </button>`).join('')}
  </div>`;
}

async function loadHomeCategories() {
  try {
    await ensureTemplates();
    homeState.catLoading = false;
    render();
  } catch (e) {
    homeState.catLoading = false;
    homeState.catError = e.message;
    render();
  }
}

async function loadHomeRecentDocs() {
  try {
    const data = await docsApi.listDocuments(1);
    homeState.docs = (data.items || []).slice(0, 3);
    homeState.docsTotal = data.total || 0;
    homeState.docsLoading = false;
    render();
  } catch (e) {
    homeState.docsLoading = false;
    homeState.docsError = e.message;
    render();
  }
}

function attachRipple(el) {
  el.addEventListener('click', (e) => {
    const rect = el.getBoundingClientRect();
    const span = document.createElement('span');
    const size = Math.max(rect.width, rect.height) * 1.4;
    span.className = 'dh-ripple';
    span.style.width = span.style.height = `${size}px`;
    span.style.left = `${(e.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2}px`;
    span.style.top = `${(e.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2}px`;
    el.style.position = el.style.position || 'relative';
    el.appendChild(span);
    setTimeout(() => span.remove(), 600);
  });
}

function wireHome() {
  root.querySelectorAll('[data-go]').forEach((btn) => {
    attachRipple(btn);
    btn.addEventListener('click', () => { haptic('light'); push(btn.dataset.go); });
  });
  root.querySelectorAll('[data-home-cat]').forEach((btn) => {
    attachRipple(btn);
    btn.addEventListener('click', () => { haptic('light'); push('templates', { category: btn.dataset.homeCat }); });
  });
  root.querySelectorAll('[data-home-doc]').forEach((btn) => {
    attachRipple(btn);
    btn.addEventListener('click', () => { haptic('light'); push('mydoc-detail', { id: Number(btn.dataset.homeDoc) }); });
  });
  const retryCats = root.querySelector('[data-retry-home-cats]');
  if (retryCats) retryCats.addEventListener('click', () => { homeState.catError = null; render(); });
  const retryDocs = root.querySelector('[data-retry-home-docs]');
  if (retryDocs) retryDocs.addEventListener('click', () => { homeState.docsError = null; render(); });
}

// =========================================================================
// Экран: категории шаблонов
// =========================================================================

async function ensureTemplates() {
  if (cache.templatesByCategory) return cache.templatesByCategory;
  const data = await docsApi.listTemplates();
  cache.templatesByCategory = data.categories;
  return data.categories;
}

function renderCategories() {
  if (!cache.templatesByCategory) {
    loadCategoriesAsync();
    return loadingHTML('Загружаю список документов…');
  }
  const cats = cache.templatesByCategory;
  return `
  <h2 class="da-h2">Выберите раздел</h2>
  <div class="da-list">
    ${cats.map((c) => `
      <button class="da-list-item" data-cat="${esc(c.code)}">
        <span>${esc(c.title)}</span>
        <span class="da-list-count">${c.templates.length}</span>
      </button>`).join('')}
  </div>`;
}

async function loadCategoriesAsync() {
  try {
    await ensureTemplates();
    render();
  } catch (e) {
    root.querySelector('.da-body').innerHTML = errorHTML(e.message);
    wireRetry(() => { cache.templatesByCategory = null; render(); });
  }
}

function wireCategories() {
  root.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => { haptic('light'); push('templates', { category: btn.dataset.cat }); });
  });
}

// =========================================================================
// Экран: список шаблонов внутри категории
// =========================================================================

function renderTemplateList(params) {
  if (!cache.templatesByCategory) {
    loadCategoriesAsync();
    return loadingHTML();
  }
  const cat = cache.templatesByCategory.find((c) => c.code === params.category);
  if (!cat) return errorHTML('Категория не найдена');

  return `
  <h2 class="da-h2">${esc(cat.title)}</h2>
  <div class="da-list">
    ${cat.templates.map((t) => `
      <button class="da-list-item ${t.locked ? 'locked' : ''}" data-tpl="${esc(t.code)}" ${t.locked ? 'data-locked="1"' : ''}>
        <span>
          <span class="da-list-title">${esc(t.title)}</span>
          <span class="da-list-desc">${esc(t.description)}</span>
        </span>
        ${t.locked ? `<span class="da-lock">${icon('lock')} PRO</span>` : '<span class="da-arrow">›</span>'}
      </button>`).join('')}
  </div>`;
}

function wireTemplateList() {
  root.querySelectorAll('[data-tpl]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic('light');
      if (btn.dataset.locked) {
        push('tariffs');
        return;
      }
      push('wizard', { code: btn.dataset.tpl });
    });
  });
}

// =========================================================================
// Экран: мастер заполнения шаблона — в виде чата (один вопрос за раз)
// =========================================================================
//
// Раньше здесь была одна длинная форма со всеми полями сразу. По запросу
// (см. чат) переделано в пошаговый диалог: бот задаёт вопрос -> пользователь
// отвечает -> следующий вопрос, как в мессенджере. Каждый отвеченный вопрос
// остаётся видимым выше в виде пары реплик и кликабелен для правки ответа.

let wizardState = { template: null, values: {}, step: 0, error: null, loading: false };

function renderWizard(params) {
  if (!wizardState.template || wizardState.template.code !== params.code) {
    wizardState = { template: null, values: {}, step: 0, error: null, loading: true };
    loadWizardTemplate(params.code);
    return loadingHTML('Открываю чат…');
  }
  if (wizardState.loading) return loadingHTML('Открываю чат…');
  if (wizardState.loadError) return errorHTML(wizardState.loadError);

  const tpl = wizardState.template;
  const fields = tpl.fields;
  const step = wizardState.step;
  const done = step >= fields.length;

  const history = fields.slice(0, step).map((f, i) => renderAnsweredBubble(f, i)).join('');

  let activeBlock = '';
  if (!done) {
    const field = fields[step];
    activeBlock = `
    <div class="da-chat-msg da-chat-bot">
      <div class="da-chat-bubble">
        <div class="da-chat-progress">Вопрос ${step + 1} из ${fields.length}</div>
        <div>${esc(field.question)}${field.required ? '' : ' <span class="da-optional">(необязательно)</span>'}</div>
        ${field.hint ? `<div class="da-chat-hint">${esc(field.hint)}</div>` : ''}
      </div>
    </div>`;
  } else {
    activeBlock = `
    <div class="da-chat-msg da-chat-bot">
      <div class="da-chat-bubble">${icon('checkCircle')} Все вопросы позади — можно смотреть готовый документ.</div>
    </div>`;
  }

  return `
  <h2 class="da-h2">${esc(tpl.title)}</h2>
  <div class="da-chat" data-chat-scroll>
    ${history}
    ${activeBlock}
    ${wizardState.error ? `<div class="da-inline-error">${icon('alertTriangle')} ${esc(wizardState.error)}</div>` : ''}
  </div>
  ${done ? `
    <div class="da-actions da-chat-footer">
      <button class="da-btn-primary" data-wizard-preview ${wizardState.loading ? 'disabled' : ''}>${wizardState.loading ? 'Собираю…' : `${icon('fileText')} Показать документ`}</button>
    </div>
  ` : renderWizardInput(fields[step])}
  `;
}

function renderAnsweredBubble(field, index) {
  const value = wizardState.values[field.key];
  const shown = (value && String(value).trim()) ? esc(value) : '<span class="da-optional">пропущено</span>';
  return `
  <div class="da-chat-msg da-chat-bot">
    <div class="da-chat-bubble">${esc(field.question)}</div>
  </div>
  <button class="da-chat-msg da-chat-user da-chat-user-edit" data-edit-step="${index}" type="button">
    <div class="da-chat-bubble">${shown}<span class="da-chat-edit-hint">${icon('fileEdit')} изменить</span></div>
  </button>`;
}

function renderWizardInput(field) {
  const value = wizardState.values[field.key] || field.prefill || '';
  const input = field.multiline
    ? `<textarea class="da-chat-textarea" name="answer" rows="3" placeholder="Ваш ответ…">${esc(value)}</textarea>`
    : `<input class="da-chat-input-el" type="text" name="answer" value="${esc(value)}" placeholder="Ваш ответ…" inputmode="${field.isMoney ? 'numeric' : 'text'}">`;
  return `
  <form class="da-chat-input" data-wizard-form>
    ${input}
    <button type="submit" class="da-chat-send" aria-label="Отправить">${icon('arrowRight')}</button>
    ${!field.required ? '<button type="button" class="da-chat-skip" data-wizard-skip>Пропустить</button>' : ''}
  </form>`;
}

async function loadWizardTemplate(code) {
  try {
    const tpl = await docsApi.getTemplate(code);
    wizardState = { template: tpl, values: {}, step: 0, error: null, loading: false };
    render();
  } catch (e) {
    wizardState = { template: null, values: {}, step: 0, error: null, loading: false, loadError: e.message };
    render();
  }
}

function scrollChatToBottom() {
  const el = root.querySelector('[data-chat-scroll]');
  if (el) el.scrollTop = el.scrollHeight;
}

function wireWizard(params) {
  scrollChatToBottom();

  root.querySelectorAll('[data-edit-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic('light');
      wizardState.step = Number(btn.dataset.editStep);
      wizardState.error = null;
      render();
    });
  });

  const form = root.querySelector('[data-wizard-form]');
  if (form) {
    const input = form.querySelector('.da-chat-input-el, .da-chat-textarea');
    if (input) input.focus();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const tpl = wizardState.template;
      const field = tpl.fields[wizardState.step];
      const value = new FormData(form).get('answer')?.toString().trim() || '';
      if (field.required && !value) {
        wizardState.error = `Поле «${field.question}» обязательно для заполнения`;
        render();
        return;
      }
      haptic('light');
      wizardState.values[field.key] = value;
      wizardState.step += 1;
      wizardState.error = null;
      render();
      scrollChatToBottom();
    });

    // Enter отправляет ответ (кроме textarea, где Enter — новая строка).
    if (input && input.tagName === 'INPUT') {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); form.requestSubmit(); }
      });
    }
  }

  const skipBtn = root.querySelector('[data-wizard-skip]');
  if (skipBtn) skipBtn.addEventListener('click', () => {
    haptic('light');
    const tpl = wizardState.template;
    const field = tpl.fields[wizardState.step];
    wizardState.values[field.key] = '';
    wizardState.step += 1;
    wizardState.error = null;
    render();
    scrollChatToBottom();
  });

  const previewBtn = root.querySelector('[data-wizard-preview]');
  if (previewBtn) previewBtn.addEventListener('click', async () => {
    haptic('medium');
    wizardState.loading = true;
    render();
    try {
      const preview = await docsApi.previewDocument(params.code, wizardState.values);
      wizardState.loading = false;
      push('preview', { code: params.code, values: wizardState.values, finalText: preview.finalText, kind: 'template' });
    } catch (e) {
      wizardState.loading = false;
      wizardState.error = e.message;
      render();
    }
  });
}

// =========================================================================
// Экран: предпросмотр + сохранение/скачивание
// =========================================================================

let previewState = { saving: false, saved: null, error: null };

function renderPreview(params) {
  const saved = previewState.saved;
  return `
  <h2 class="da-h2">${saved ? `${icon('checkCircle')} Документ сохранён` : 'Предпросмотр'}</h2>
  <pre class="da-preview">${esc(params.finalText)}</pre>
  ${previewState.error ? `<div class="da-inline-error">${icon('alertTriangle')} ${esc(previewState.error)}</div>` : ''}
  <div class="da-actions">
    ${!saved ? `
      <button class="da-btn-secondary" data-edit>${icon('fileEdit')} Изменить</button>
      <button class="da-btn-primary" data-save ${previewState.saving ? 'disabled' : ''}>${previewState.saving ? 'Сохраняю…' : `${icon('save')} Сохранить`}</button>
    ` : `
      <button class="da-btn-primary" data-dl="pdf">${icon('fileText')} Скачать PDF</button>
      <button class="da-btn-secondary" data-dl="docx">${icon('fileEdit')} Скачать DOCX</button>
      <button class="da-btn-ghost" data-go-home>Готово</button>
    `}
  </div>`;
}

function wirePreview(params) {
  const editBtn = root.querySelector('[data-edit]');
  if (editBtn) editBtn.addEventListener('click', () => { haptic('light'); back(); });

  const saveBtn = root.querySelector('[data-save]');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    haptic('medium');
    previewState.saving = true;
    render();
    try {
      let doc;
      if (params.kind === 'custom') {
        doc = await docsApi.saveCustomDocument(params.description, params.finalText);
      } else {
        doc = await docsApi.createDocument(params.code, params.values);
      }
      previewState = { saving: false, saved: doc, error: null };
      cache.billing = null; // лимит на сегодня изменился
      render();
    } catch (e) {
      previewState.saving = false;
      previewState.error = e.message;
      render();
    }
  });

  root.querySelectorAll('[data-dl]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      haptic('light');
      const fmt = btn.dataset.dl;
      try {
        await docsApi.downloadFile(previewState.saved.id, fmt, `${previewState.saved.templateCode}.${fmt}`);
      } catch (e) {
        showAlert(e.message);
      }
    });
  });

  const homeBtn = root.querySelector('[data-go-home]');
  if (homeBtn) homeBtn.addEventListener('click', () => {
    previewState = { saving: false, saved: null, error: null };
    screenStack = [{ name: 'home' }];
    render();
  });
}

// =========================================================================
// Экран: свой текст (без шаблона, без AI — пользователь пишет сам)
// =========================================================================

let customState = { description: '', loading: false, error: null };

function renderCustom(params) {
  if (params && params.description && !customState.description) customState.description = params.description;
  return `
  <h2 class="da-h2">${icon('puzzle')} Свой текст</h2>
  <p class="da-hint-block">Если готового шаблона нет — просто напишите текст документа сами. Мы аккуратно оформим его в PDF и DOCX: заголовок, абзацы, место для подписи.</p>
  <form class="da-form" data-custom-form>
    <textarea name="description" rows="10" placeholder="Например:&#10;ДОГОВОР ОКАЗАНИЯ УСЛУГ&#10;&#10;Исполнитель: ...&#10;Заказчик: ...&#10;&#10;1. Предмет договора&#10;...">${esc(customState.description)}</textarea>
    ${customState.error ? `<div class="da-inline-error">${icon('alertTriangle')} ${esc(customState.error)}</div>` : ''}
    <button type="submit" class="da-btn-primary" ${customState.loading ? 'disabled' : ''}>${customState.loading ? 'Готовлю…' : 'Предпросмотр →'}</button>
  </form>`;
}

function wireCustom() {
  const form = root.querySelector('[data-custom-form]');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const description = new FormData(form).get('description').toString().trim();
    if (!description) return;
    customState = { description, loading: true, error: null };
    render();
    try {
      const result = await docsApi.previewCustomDocument(description);
      customState = { description, loading: false, error: null };
      push('preview', { kind: 'custom', description, finalText: result.finalText });
    } catch (e2) {
      customState = { description, loading: false, error: e2.message };
      render();
    }
  });
}

// =========================================================================
// Экран: Мои документы
// =========================================================================

let myDocsState = { items: null, page: 1, total: 0, loading: false, error: null };

function renderMyDocuments() {
  if (myDocsState.items === null && !myDocsState.loading) {
    loadMyDocuments(1);
    return loadingHTML('Загружаю документы…');
  }
  if (myDocsState.loading) return loadingHTML('Загружаю документы…');
  if (myDocsState.error) return errorHTML(myDocsState.error);

  const items = myDocsState.items;
  if (!items.length) {
    return `
    <h2 class="da-h2">${icon('folder')} Мои документы</h2>
    <div class="da-empty">
      <p>Пока пусто. Создайте первый документ.</p>
      <button class="da-btn-primary" data-go="categories">Создать документ</button>
    </div>`;
  }

  const totalPages = Math.max(1, Math.ceil(myDocsState.total / 8));
  return `
  <h2 class="da-h2">${icon('folder')} Мои документы (${myDocsState.total})</h2>
  <div class="da-list">
    ${items.map((d) => `
      <button class="da-list-item" data-doc="${d.id}">
        <span>
          <span class="da-list-title">${esc(d.title)}</span>
          <span class="da-list-desc">${esc(d.templateTitle)} · ${new Date(d.createdAt).toLocaleDateString('ru-RU')}</span>
        </span>
        <span class="da-arrow">›</span>
      </button>`).join('')}
  </div>
  ${totalPages > 1 ? `
    <div class="da-pager">
      <button class="da-btn-ghost" data-page="prev" ${myDocsState.page <= 1 ? 'disabled' : ''}>← Раньше</button>
      <span>${myDocsState.page} / ${totalPages}</span>
      <button class="da-btn-ghost" data-page="next" ${myDocsState.page >= totalPages ? 'disabled' : ''}>Позже →</button>
    </div>` : ''}`;
}

async function loadMyDocuments(page) {
  myDocsState.loading = true;
  render();
  try {
    const data = await docsApi.listDocuments(page);
    myDocsState = { items: data.items, page: data.page, total: data.total, loading: false, error: null };
    render();
  } catch (e) {
    myDocsState = { items: [], page: 1, total: 0, loading: false, error: e.message };
    render();
  }
}

function wireMyDocuments() {
  root.querySelectorAll('[data-doc]').forEach((btn) => {
    btn.addEventListener('click', () => { haptic('light'); push('mydoc-detail', { id: Number(btn.dataset.doc) }); });
  });
  root.querySelectorAll('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => { haptic('light'); push(btn.dataset.go); });
  });
  const prev = root.querySelector('[data-page="prev"]');
  if (prev) prev.addEventListener('click', () => loadMyDocuments(myDocsState.page - 1));
  const next = root.querySelector('[data-page="next"]');
  if (next) next.addEventListener('click', () => loadMyDocuments(myDocsState.page + 1));
}

let myDocDetailState = { doc: null, loading: false, error: null, deleting: false };

function renderMyDocumentDetail(params) {
  if (!myDocDetailState.doc || myDocDetailState.doc.id !== params.id) {
    if (!myDocDetailState.loading) loadMyDocDetail(params.id);
    return loadingHTML();
  }
  if (myDocDetailState.error) return errorHTML(myDocDetailState.error);

  const doc = myDocDetailState.doc;
  return `
  <h2 class="da-h2">${esc(doc.title)}</h2>
  <p class="da-hint-block">${esc(doc.templateTitle)} · ${new Date(doc.createdAt).toLocaleDateString('ru-RU')}</p>
  <pre class="da-preview">${esc(doc.finalText)}</pre>
  <div class="da-actions">
    <button class="da-btn-primary" data-dl="pdf">${icon('fileText')} PDF</button>
    <button class="da-btn-secondary" data-dl="docx">${icon('fileEdit')} DOCX</button>
    <button class="da-btn-danger" data-delete ${myDocDetailState.deleting ? 'disabled' : ''}>${myDocDetailState.deleting ? 'Удаляю…' : `${icon('trash')} Удалить`}</button>
  </div>`;
}

async function loadMyDocDetail(id) {
  myDocDetailState = { doc: null, loading: true, error: null, deleting: false };
  render();
  try {
    const doc = await docsApi.getDocument(id);
    myDocDetailState = { doc, loading: false, error: null, deleting: false };
    render();
  } catch (e) {
    myDocDetailState = { doc: null, loading: false, error: e.message, deleting: false };
    render();
  }
}

function wireMyDocumentDetail() {
  root.querySelectorAll('[data-dl]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      haptic('light');
      const fmt = btn.dataset.dl;
      try {
        await docsApi.downloadFile(myDocDetailState.doc.id, fmt, `${myDocDetailState.doc.templateCode}.${fmt}`);
      } catch (e) { showAlert(e.message); }
    });
  });
  const del = root.querySelector('[data-delete]');
  if (del) del.addEventListener('click', async () => {
    haptic('medium');
    myDocDetailState.deleting = true;
    render();
    try {
      await docsApi.deleteDocument(myDocDetailState.doc.id);
      myDocsState.items = null; // форсируем перезагрузку списка
      back();
    } catch (e) {
      myDocDetailState.deleting = false;
      myDocDetailState.error = e.message;
      render();
    }
  });
}

// =========================================================================
// Экран: Профиль
// =========================================================================

let profileState = { loading: false, error: null, saving: false, data: null };

function renderProfile() {
  if (!profileState.data && !profileState.loading) {
    loadProfile();
    return loadingHTML('Загружаю профиль…');
  }
  if (profileState.loading) return loadingHTML('Загружаю профиль…');
  if (profileState.error) return errorHTML(profileState.error);

  const { profile, user, permissions } = profileState.data;
  const fields = [
    ['full_name', 'ФИО'],
    ['city', 'Город'],
    ['position', 'Должность'],
    ['company_name', 'Компания (ИП/ТОО)'],
    ['bin_iin', 'БИН/ИИН'],
    ['requisites', 'Реквизиты'],
    ['address', 'Адрес'],
    ['signature_name', 'Подпись/инициалы'],
  ];

  return `
  <h2 class="da-h2">${icon('user')} Профиль</h2>
  <p class="da-hint-block">Тариф: <b>${esc(user.tariff.toUpperCase())}</b>. Эти данные автоматически подставляются в документы.</p>
  <form class="da-form" data-profile-form>
    ${fields.map(([key, label]) => `
      <label class="da-field">
        <span class="da-field-label">${esc(label)}</span>
        <input type="text" name="${key}" value="${esc(profile[key] || '')}">
      </label>`).join('')}
    ${permissions.canEditPdfTheme ? `
      <label class="da-field">
        <span class="da-field-label">Тема PDF</span>
        <select name="pdf_theme">
          <option value="classic" ${profile.pdf_theme === 'classic' ? 'selected' : ''}>Строгая деловая</option>
          <option value="modern" ${profile.pdf_theme === 'modern' ? 'selected' : ''}>Современная</option>
        </select>
      </label>` : ''}
    ${profileState.error ? `<div class="da-inline-error">${icon('alertTriangle')} ${esc(profileState.error)}</div>` : ''}
    <button type="submit" class="da-btn-primary" ${profileState.saving ? 'disabled' : ''}>${profileState.saving ? 'Сохраняю…' : 'Сохранить'}</button>
  </form>

  ${permissions.canUploadLogo ? renderUploadBlock('logo', 'Логотип компании', profile.logo_path) : ''}
  ${permissions.canUploadSignature ? renderUploadBlock('signature', 'Изображение подписи', profile.signature_path) : ''}
  ${(!permissions.canUploadLogo || !permissions.canUploadSignature) ? `<p class="da-hint-block">Логотип — на BUSINESS, изображение подписи — на PRO и BUSINESS. <a href="#" data-go-tariffs>Посмотреть тарифы →</a></p>` : ''}
  `;
}

function renderUploadBlock(kind, label, currentPath) {
  return `
  <div class="da-upload-block">
    <span class="da-field-label">${esc(label)}</span>
    <span class="da-hint-block">${currentPath ? `${icon('checkCircle')} загружено` : 'не загружено'}</span>
    <input type="file" accept="image/png,image/jpeg" data-upload="${kind}">
  </div>`;
}

async function loadProfile() {
  profileState = { loading: true, error: null, saving: false, data: null };
  render();
  try {
    const data = await docsApi.getProfile();
    profileState = { loading: false, error: null, saving: false, data };
    render();
  } catch (e) {
    profileState = { loading: false, error: e.message, saving: false, data: null };
    render();
  }
}

function wireProfile() {
  const form = root.querySelector('[data-profile-form]');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const values = {};
    for (const [k, v] of fd.entries()) values[k] = v;
    profileState.saving = true;
    render();
    try {
      await docsApi.updateProfile(values);
      haptic('medium');
      profileState.data = null; // перезагрузим целиком, чтобы подтянуть актуальные права
      profileState.saving = false;
      loadProfile();
    } catch (e2) {
      profileState.saving = false;
      profileState.error = e2.message;
      render();
    }
  });

  root.querySelectorAll('[data-upload]').forEach((input) => {
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      haptic('light');
      try {
        if (input.dataset.upload === 'logo') await docsApi.uploadLogo(file);
        else await docsApi.uploadSignature(file);
        profileState.data = null;
        loadProfile();
      } catch (e) {
        showAlert(e.message);
      }
    });
  });

  const tariffLink = root.querySelector('[data-go-tariffs]');
  if (tariffLink) tariffLink.addEventListener('click', (e) => { e.preventDefault(); push('tariffs'); });
}

// =========================================================================
// Экран: Тарифы и оплата
// =========================================================================

let tariffsState = { plans: null, status: null, limit: null, loading: false, error: null };

function renderTariffs() {
  if (!tariffsState.plans && !tariffsState.loading) {
    loadTariffs();
    return loadingHTML('Загружаю тарифы…');
  }
  if (tariffsState.loading) return loadingHTML('Загружаю тарифы…');
  if (tariffsState.error) return errorHTML(tariffsState.error);

  const { plans, status, limit } = tariffsState;
  const sub = status.subscription;
  const currentTitle = sub.active ? (plans.find((p) => p.code === sub.plan)?.title || sub.plan) : 'FREE';

  return `
  <h2 class="da-h2">${icon('star')} Тарифы</h2>
  <p class="da-hint-block">
    Текущий тариф: <b>${esc(currentTitle)}</b>${sub.active && sub.expiresAt ? ` · до ${new Date(sub.expiresAt).toLocaleDateString('ru-RU')}` : ''}.
    ${limit.isPro ? 'Документы — без ограничений.' : `Сегодня создано документов: ${limit.todayCount} из ${limit.freeDailyLimit}.`}
  </p>
  <div class="da-plans">
    <div class="da-plan ${!sub.active ? 'current' : ''}">
      <div class="da-plan-title">FREE</div>
      <div class="da-plan-price">Бесплатно</div>
      <ul class="da-plan-features">
        <li>До ${limit.freeDailyLimit} документов в день</li>
        <li>Все бесплатные шаблоны</li>
        <li>Экспорт в PDF и DOCX</li>
      </ul>
    </div>
    ${plans.map((p) => `
      <div class="da-plan ${sub.active && sub.plan === p.code ? 'current' : ''}">
        <div class="da-plan-title">${esc(p.title)}</div>
        <div class="da-plan-price">$${p.usd}${p.durationDays ? ` / ${p.durationDays} дн.` : ''}</div>
        <ul class="da-plan-features">
          <li>Документы без дневного лимита</li>
          <li>PRO-шаблоны (договоры, доверенности, КП)</li>
          <li>Логотип и подпись в документах</li>
          <li>Тема оформления PDF</li>
        </ul>
        ${sub.active && sub.plan === p.code ? '' : `<button class="da-btn-primary" data-buy="${esc(p.code)}">Оформить</button>`}
      </div>`).join('')}
  </div>`;
}

async function loadTariffs() {
  tariffsState.loading = true;
  render();
  try {
    const [plansData, status, limit] = await Promise.all([
      docsApi.getPlans(),
      docsApi.getBillingStatus(),
      docsApi.getDocsLimit(),
    ]);
    tariffsState = { plans: plansData.plans, status, limit, loading: false, error: null };
    render();
  } catch (e) {
    tariffsState = { plans: null, status: null, limit: null, loading: false, error: e.message };
    render();
  }
}

// Тариф и оплата — мини-окно поверх текущего экрана (см.
// components/planCheckoutModal.js), а не разворачивающийся блок на той же
// странице, как было раньше. Оплата идёт через тот же docsApi.checkout(),
// который уже работал — здесь только новый UI вокруг него.
function wireTariffs() {
  root.querySelectorAll('[data-buy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic('light');
      showPlanCheckout({
        plans: tariffsState.plans,
        planCode: btn.dataset.buy,
        lockPlan: true,
        checkout: (code, method, network) => docsApi.checkout(code, method, network),
        onSuccess: () => loadTariffs(),
      });
    });
  });
}

// =========================================================================
// Диспетчер подключения обработчиков конкретного экрана
// =========================================================================

function wireScreen(screen) {
  switch (screen.name) {
    case 'home': wireHome(); break;
    case 'categories': wireCategories(); break;
    case 'templates': wireTemplateList(); break;
    case 'wizard': wireWizard(screen.params); break;
    case 'preview': wirePreview(screen.params); break;
    case 'custom': wireCustom(); break;
    case 'mydocs': wireMyDocuments(); break;
    case 'mydoc-detail': wireMyDocumentDetail(); break;
    case 'profile': wireProfile(); break;
    case 'tariffs': wireTariffs(); break;
  }
}

function wireRetry(fn) {
  const btn = root.querySelector('[data-retry]');
  if (btn) btn.addEventListener('click', fn);
}
