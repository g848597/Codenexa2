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
import { haptic, isInsideTelegram, openInvoice, openTelegramLink, showAlert } from '../telegram.js';
import { captureReturnTarget, getReturnTarget, reopenProductIfNeeded } from '../navigation.js';
import { esc } from '../utils/html.js';
import { icon } from '../utils/icons.js';
import { backButtonHTML as _backButtonHTML, errorHTML as _errorHTML, loadingHTML as _loadingHTML } from '../utils/loadingState.js';

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
    case 'ai': inner = renderAi(screen.params); break;
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

function renderHome() {
  return `
  <div class="da-hero">
    <div class="da-hero-title">Документы за минуту</div>
    <div class="da-hero-sub">Шаблоны, AI-конструктор и произвольные документы — с PDF/DOCX на выходе.</div>
  </div>
  <div class="da-tiles">
    <button class="da-tile" data-go="categories"><span class="da-tile-icon">${icon('fileText')}</span><span>Создать документ</span><span class="da-tile-hint">По готовому шаблону</span></button>
    <button class="da-tile" data-go="ai"><span class="da-tile-icon">${icon('bot')}</span><span>AI-конструктор</span><span class="da-tile-hint">Опишите своими словами</span></button>
    <button class="da-tile" data-go="custom"><span class="da-tile-icon">${icon('puzzle')}</span><span>Произвольный документ</span><span class="da-tile-hint">Когда шаблона нет</span></button>
    <button class="da-tile" data-go="mydocs"><span class="da-tile-icon">${icon('folder')}</span><span>Мои документы</span><span class="da-tile-hint">История и повтор</span></button>
    <button class="da-tile" data-go="profile"><span class="da-tile-icon">${icon('user')}</span><span>Профиль</span><span class="da-tile-hint">Автоподстановка данных</span></button>
    <button class="da-tile" data-go="tariffs"><span class="da-tile-icon">${icon('star')}</span><span>Тарифы</span><span class="da-tile-hint">FREE / PRO / BUSINESS</span></button>
  </div>`;
}

function wireHome() {
  root.querySelectorAll('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => { haptic('light'); push(btn.dataset.go); });
  });
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
// Экран: мастер заполнения полей шаблона
// =========================================================================

let wizardState = { template: null, values: {}, error: null, loading: false };

function renderWizard(params) {
  if (!wizardState.template || wizardState.template.code !== params.code) {
    wizardState = { template: null, values: {}, error: null, loading: true };
    loadWizardTemplate(params.code);
    return loadingHTML('Открываю мастер…');
  }
  if (wizardState.loading) return loadingHTML('Открываю мастер…');

  const tpl = wizardState.template;
  return `
  <h2 class="da-h2">${esc(tpl.title)}</h2>
  <p class="da-hint-block">${esc(tpl.description)}</p>
  ${wizardState.error ? `<div class="da-inline-error">${icon('alertTriangle')} ${esc(wizardState.error)}</div>` : ''}
  <form class="da-form" data-wizard-form>
    ${tpl.fields.map((f) => renderField(f, wizardState.values[f.key])).join('')}
    <button type="submit" class="da-btn-primary" ${wizardState.loading ? 'disabled' : ''}>
      ${wizardState.loading ? 'Собираю документ…' : 'Продолжить →'}
    </button>
  </form>`;
}

function renderField(field, prevValue) {
  const value = prevValue !== undefined ? prevValue : (field.prefill || '');
  const label = `${esc(field.question)}${field.required ? '' : ' <span class="da-optional">(необязательно)</span>'}`;
  const input = field.multiline
    ? `<textarea name="${esc(field.key)}" rows="4" ${field.required ? 'required' : ''}>${esc(value)}</textarea>`
    : `<input type="text" name="${esc(field.key)}" value="${esc(value)}" ${field.required ? 'required' : ''} inputmode="${field.isMoney ? 'numeric' : 'text'}">`;
  return `
  <label class="da-field">
    <span class="da-field-label">${label}</span>
    ${input}
    ${field.hint ? `<span class="da-field-hint">${esc(field.hint)}</span>` : ''}
  </label>`;
}

async function loadWizardTemplate(code) {
  try {
    const tpl = await docsApi.getTemplate(code);
    wizardState = { template: tpl, values: {}, error: null, loading: false };
    render();
  } catch (e) {
    wizardState = { template: null, values: {}, error: null, loading: false };
    root.querySelector('.da-body').innerHTML = errorHTML(e.message);
    wireRetry(() => render());
  }
}

function wireWizard(params) {
  const form = root.querySelector('[data-wizard-form]');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const values = {};
    for (const [k, v] of fd.entries()) values[k] = v;
    wizardState.values = values;

    haptic('medium');
    wizardState.loading = true;
    render();
    try {
      const preview = await docsApi.previewDocument(params.code, values);
      push('preview', { code: params.code, values, finalText: preview.finalText, kind: 'template' });
    } catch (e2) {
      wizardState.loading = false;
      wizardState.error = e2.message;
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
// Экран: AI-конструктор
// =========================================================================

let aiState = { text: '', loading: false, error: null, result: null };

function renderAi() {
  return `
  <h2 class="da-h2">${icon('bot')} AI-конструктор</h2>
  <p class="da-hint-block">Опишите своими словами, какой документ нужен — AI подберёт шаблон и заполнит, что сможет определить из текста.</p>
  <form class="da-form" data-ai-form>
    <textarea name="text" rows="5" placeholder="Например: нужна расписка о получении 300 000 тенге от Иванова с возвратом до 15 августа">${esc(aiState.text)}</textarea>
    ${aiState.error ? `<div class="da-inline-error">${icon('alertTriangle')} ${esc(aiState.error)}</div>` : ''}
    <button type="submit" class="da-btn-primary" ${aiState.loading ? 'disabled' : ''}>${aiState.loading ? 'Анализирую…' : 'Определить документ →'}</button>
  </form>
  ${aiState.result ? renderAiResult(aiState.result) : ''}`;
}

function renderAiResult(result) {
  if (result.templateCode === 'unknown' || !result.templateCode) {
    return `
    <div class="da-ai-result">
      <p>Не удалось точно определить тип документа по описанию.</p>
      <button class="da-btn-secondary" data-ai-fallback-custom>Сгенерировать как произвольный документ</button>
      <button class="da-btn-ghost" data-ai-fallback-categories>Выбрать шаблон вручную</button>
    </div>`;
  }
  return `
  <div class="da-ai-result">
    <p>Похоже, нужен: <b>${esc(result.templateTitle)}</b> (уверенность ${Math.round((result.confidence || 0) * 100)}%)</p>
    ${result.missingFields.length ? `<p class="da-hint-block">Осталось уточнить: ${result.missingFields.length} поле(й) — откроется мастер.</p>` : '<p class="da-hint-block">Все обязательные поля уже определены — можно сразу смотреть предпросмотр.</p>'}
    <button class="da-btn-primary" data-ai-continue>Продолжить →</button>
  </div>`;
}

function wireAi() {
  const form = root.querySelector('[data-ai-form]');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = new FormData(form).get('text').toString().trim();
    if (!text) return;
    aiState = { text, loading: true, error: null, result: null };
    render();
    try {
      const result = await docsApi.aiParse(text);
      aiState = { text, loading: false, error: null, result };
      render();
    } catch (e2) {
      aiState = { text, loading: false, error: e2.message, result: null };
      render();
    }
  });

  const fallbackCustom = root.querySelector('[data-ai-fallback-custom]');
  if (fallbackCustom) fallbackCustom.addEventListener('click', () => { haptic('light'); push('custom', { description: aiState.text }); });

  const fallbackCategories = root.querySelector('[data-ai-fallback-categories]');
  if (fallbackCategories) fallbackCategories.addEventListener('click', () => { haptic('light'); push('categories'); });

  const cont = root.querySelector('[data-ai-continue]');
  if (cont) cont.addEventListener('click', async () => {
    haptic('light');
    const result = aiState.result;
    try {
      const tpl = await docsApi.getTemplate(result.templateCode);
      wizardState = { template: tpl, values: { ...result.extracted }, error: null, loading: false };
      push('wizard', { code: result.templateCode });
    } catch (e) {
      showAlert(e.message);
    }
  });
}

// =========================================================================
// Экран: произвольный документ
// =========================================================================

let customState = { description: '', loading: false, error: null };

function renderCustom(params) {
  if (params && params.description && !customState.description) customState.description = params.description;
  return `
  <h2 class="da-h2">${icon('puzzle')} Произвольный документ</h2>
  <p class="da-hint-block">Опишите, какой документ нужен и что в нём должно быть — AI напишет готовый текст с нуля, без пошагового мастера.</p>
  <form class="da-form" data-custom-form>
    <textarea name="description" rows="6" placeholder="Например: договор оказания консультационных услуг между ИП и заказчиком, срок 3 месяца, оплата 200 000 тенге ежемесячно">${esc(customState.description)}</textarea>
    ${customState.error ? `<div class="da-inline-error">${icon('alertTriangle')} ${esc(customState.error)}</div>` : ''}
    <button type="submit" class="da-btn-primary" ${customState.loading ? 'disabled' : ''}>${customState.loading ? 'Генерирую…' : 'Сгенерировать →'}</button>
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

let tariffsState = { plans: null, status: null, loading: false, error: null, checkoutFor: null, checkoutResult: null, checkoutError: null };

function renderTariffs() {
  if (!tariffsState.plans && !tariffsState.loading) {
    loadTariffs();
    return loadingHTML('Загружаю тарифы…');
  }
  if (tariffsState.loading) return loadingHTML('Загружаю тарифы…');
  if (tariffsState.error) return errorHTML(tariffsState.error);

  const { plans, status } = tariffsState;
  return `
  <h2 class="da-h2">${icon('star')} Тарифы</h2>
  <p class="da-hint-block">Текущий тариф: <b>${esc(status.tariff.toUpperCase())}</b>${status.subscriptionExpiresAt ? ` · до ${new Date(status.subscriptionExpiresAt).toLocaleDateString('ru-RU')}` : ''}. Сегодня создано документов: ${status.todayDocumentCount}${status.isProOrHigher ? '' : ` из ${status.freeDailyLimit}`}.</p>
  <div class="da-plans">
    ${plans.map((p) => `
      <div class="da-plan ${status.tariff === p.code ? 'current' : ''}">
        <div class="da-plan-title">${esc(p.title)}</div>
        <div class="da-plan-price">${p.price === 0 ? 'Бесплатно' : `${Number(p.price).toLocaleString('ru-RU')} ₸ / мес`}</div>
        <ul class="da-plan-features">${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        ${p.code === 'free' || status.tariff === p.code ? '' : `<button class="da-btn-primary" data-buy="${p.code}">Оформить</button>`}
      </div>`).join('')}
  </div>
  ${tariffsState.checkoutFor ? renderCheckoutPanel() : ''}
  `;
}

function renderCheckoutPanel() {
  const plan = tariffsState.checkoutFor;
  if (tariffsState.checkoutResult) {
    const r = tariffsState.checkoutResult;
    if (r.method === 'stars') {
      return `<div class="da-checkout"><p>Открываю оплату через Telegram Stars…</p></div>`;
    }
    if (r.method === 'card') {
      return `<div class="da-checkout">
        <p>Заявка создана. ${esc(r.instructions)}</p>
        ${r.adminContact ? `<button class="da-btn-primary" data-open-admin="${esc(r.adminContact)}">Написать администратору</button>` : '<p class="da-inline-error">Контакт администратора не настроен — впишите ADMIN_CONTACT_USERNAME в config/.env бота.</p>'}
      </div>`;
    }
    if (r.method === 'crypto') {
      return `<div class="da-checkout">
        <p>${esc(r.networkLabel)} · адрес для перевода:</p>
        <code class="da-code-block">${esc(r.address)}</code>
        <p class="da-hint-block">${esc(r.instructions)}</p>
      </div>`;
    }
  }
  return `
  <div class="da-checkout">
    <p>Оплата тарифа <b>${esc(plan)}</b> — выберите способ:</p>
    <div class="da-actions">
      <button class="da-btn-primary" data-method="stars">${icon('star')} Telegram Stars</button>
      <button class="da-btn-secondary" data-method="card">${icon('creditCard')} Карта (через админа)</button>
      <button class="da-btn-secondary" data-method="crypto">₿ Крипта (USDT)</button>
    </div>
    ${tariffsState.checkoutError ? `<div class="da-inline-error">${icon('alertTriangle')} ${esc(tariffsState.checkoutError)}</div>` : ''}
  </div>`;
}

async function loadTariffs() {
  tariffsState.loading = true;
  render();
  try {
    const [plansData, status] = await Promise.all([
      docsApi.getPlans(),
      docsApi.getBillingStatus(),
    ]);
    tariffsState = { plans: plansData.plans, status, loading: false, error: null, checkoutFor: null, checkoutResult: null, checkoutError: null };
    render();
  } catch (e) {
    tariffsState = { plans: null, status: null, loading: false, error: e.message, checkoutFor: null, checkoutResult: null, checkoutError: null };
    render();
  }
}

function wireTariffs() {
  root.querySelectorAll('[data-buy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic('light');
      tariffsState.checkoutFor = btn.dataset.buy;
      tariffsState.checkoutResult = null;
      tariffsState.checkoutError = null;
      render();
    });
  });

  root.querySelectorAll('[data-method]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      haptic('medium');
      const method = btn.dataset.method;
      const plan = tariffsState.checkoutFor;

      if (method === 'crypto') {
        // Простая заглушка выбора сети через нативный confirm — полноценный
        // выбор из трёх сетей легко доразвернуть в отдельный экран при желании.
        const network = window.prompt('Сеть USDT: ton, trc20 или bep20', 'trc20');
        if (!network) return;
        await runCheckout(plan, method, network.trim());
        return;
      }
      await runCheckout(plan, method);
    });
  });

  const adminBtn = root.querySelector('[data-open-admin]');
  if (adminBtn) adminBtn.addEventListener('click', () => {
    openTelegramLink(`https://t.me/${adminBtn.dataset.openAdmin}`);
  });
}

async function runCheckout(plan, method, network) {
  try {
    const result = await docsApi.checkout(plan, method, network);
    tariffsState.checkoutResult = result;
    tariffsState.checkoutError = null;
    render();

    if (method === 'stars') {
      if (isInsideTelegram()) {
        openInvoice(result.invoiceLink, (status) => {
          if (status === 'paid') {
            haptic('medium');
            showAlert('Оплата прошла успешно! Тариф активирован.');
            tariffsState = { plans: null, status: null, loading: false, error: null, checkoutFor: null, checkoutResult: null, checkoutError: null };
            loadTariffs();
          }
        });
      } else {
        showAlert('Оплата через Telegram Stars доступна только внутри Telegram.');
      }
    }
  } catch (e) {
    tariffsState.checkoutError = e.message;
    render();
  }
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
    case 'ai': wireAi(); break;
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
