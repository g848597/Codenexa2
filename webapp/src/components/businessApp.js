// AI Business — открывается кнопкой "Открыть AI Business" на странице
// продукта (productDetail.js) поверх той же системы .view, что и остальные
// полноэкранные разделы приложения (см. docsApp.js/sportApp.js).
//
// В отличие от AI Docs/AI Sport, это НЕ вантажный JS-модуль в стиле
// остального проекта, а отдельное React/Vite-приложение (см.
// business-app/ в корне репозитория и business-app/README.md) — собирается
// отдельно и раздаётся как статика по пути /business-app/ (см.
// app/web/server.py: StaticFiles(WEBAPP_DIR) отдаёт всё, что лежит внутри
// webapp/, включая собранный webapp/business-app/ после сборки в
// Dockerfile). Чтобы не переписывать его на vanilla JS и не терять его
// собственную вёрстку/стили, он монтируется в iframe — единственный
// практичный способ встроить два независимых фронтенда в одну страницу
// без общего сборщика.
//
// ВАЖНО (см. business-app/README.md, раздел "Важно про хранилище"):
// приложение внутри изначально сохраняло CRM/проекты через window.storage —
// API, доступное только внутри Claude.ai-артефактов. Здесь, в обычном
// браузере/Telegram WebView, эти вызовы безопасно "проваливаются"
// (storageClient.js уже на это рассчитан), и приложение работает на
// демо-данных без сохранения между перезапусками. Прежде чем считать
// раздел готовым к реальному использованию, нужно подменить
// business-app/src/storage/storageClient.js на вызовы настоящего backend —
// это отдельная задача, не часть текущей интеграции карточки.

import { haptic } from '../telegram.js';
import { captureReturnTarget, getReturnTarget, reopenProductIfNeeded } from '../navigation.js';
import { icon } from '../utils/icons.js';

let root = null;

function render() {
  if (!root) return;
  root.innerHTML = `
    <div class="business-app">
      <div class="ba-topbar">
        <button class="ba-back" data-ba-exit aria-label="К экосистеме CodeNexa">
          ${icon('chevronLeft')} <span class="ba-back-label">Назад</span>
        </button>
        <div class="ba-brand">${icon('briefcase')} AI Business</div>
      </div>
      <div class="ba-frame-wrap">
        <iframe
          class="ba-frame"
          src="/business-app/"
          title="AI Business"
          loading="lazy"
        ></iframe>
      </div>
    </div>`;

  const exitBtn = root.querySelector('[data-ba-exit]');
  if (exitBtn) exitBtn.addEventListener('click', () => { haptic('light'); closeBusinessApp(); });
}

export function openBusinessApp() {
  // Запоминаем, откуда открывают модуль (вкладка каталога ИЛИ страница
  // конкретного продукта) — тот же паттерн, что и в docsApp.js/sportApp.js,
  // иначе "назад" всегда уводил бы на дашборд.
  captureReturnTarget();

  document.querySelectorAll('.tab').forEach((tabEl) => tabEl.classList.remove('active'));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('view-business-app').classList.add('active');

  root = document.getElementById('view-business-app');
  render();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

export function closeBusinessApp() {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const target = getReturnTarget();
  if (reopenProductIfNeeded(target)) return;
  const targetView = document.getElementById('view-' + target.view);
  if (targetView) targetView.classList.add('active');
  const tab = document.querySelector(`.tab[data-view="${target.view}"]`);
  if (tab) tab.classList.add('active');
}
