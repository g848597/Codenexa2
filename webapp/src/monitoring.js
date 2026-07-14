// Фронтенд-мониторинг ошибок (раунд 8, аудит раздел 9: "Sentry сейчас только
// на бэкенде" — см. CHANGES_ROUND8.md, модуль 8).
//
// Тот же паттерн опциональной конфигурации, что и в остальном проекте (см.
// webapp/src/config/docsApi.js): без window.CODENEXA_SENTRY_DSN этот модуль
// не делает ничего — не грузит сторонний скрипт и не пытается
// инициализировать несуществующий DSN.
//
// SENTRY_DSN на бэкенде (app/web/server.py) и window.CODENEXA_SENTRY_DSN
// здесь — это ДВА РАЗНЫХ значения (два разных Sentry-проекта, frontend и
// backend), не один и тот же ключ, скопированный в двух местах.
//
// Подключение (в точке входа приложения, как можно раньше — до первого
// рендера, чтобы поймать ошибки инициализации остальных модулей):
//   import { initMonitoring } from './monitoring.js';
//   initMonitoring();
const DSN = window.CODENEXA_SENTRY_DSN || '';
const SENTRY_CDN_URL = 'https://browser.sentry-cdn.com/7.120.0/bundle.tracing.min.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
    document.head.appendChild(script);
  });
}

let initPromise = null;

// Best-effort, как и app/web/audit.py::log_action — сбой загрузки/
// инициализации мониторинга не должен ронять приложение.
export function initMonitoring() {
  if (!DSN) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = loadScript(SENTRY_CDN_URL)
    .then(() => {
      if (window.Sentry && typeof window.Sentry.init === 'function') {
        window.Sentry.init({
          dsn: DSN,
          environment: window.CODENEXA_ENV || 'production',
          tracesSampleRate: 0.1,
        });
      }
    })
    .catch((err) => {
      console.warn('Sentry: не удалось инициализировать', err);
    });

  return initPromise;
}

// Ручная отправка ошибки, пойманной вручную (например, в try/catch вокруг
// критичного действия, где хочется приложить контекст) — если мониторинг не
// подключён (нет DSN), просто ничего не делает.
export function captureException(error, context) {
  if (window.Sentry && typeof window.Sentry.captureException === 'function') {
    window.Sentry.captureException(error, context ? { extra: context } : undefined);
  }
}
