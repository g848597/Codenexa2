// Общий рендеринг состояний "загрузка"/"ошибка" для полноэкранных модулей
// (docsApp.js, sportApp.js, accountApp.js). Раунд 8 (аудит, раздел 6/11 —
// см. CHANGES_ROUND8.md, модуль 7): до этого раунда loadingHTML()/
// errorHTML()/backButtonHTML() были продублированы практически дословно в
// docsApp.js и sportApp.js (отличался только CSS-префикс), а accountApp.js
// вообще не имел спиннера и кнопки повтора при ошибке — тот же принцип
// выноса копипаста, что и esc()/escAttr() в utils/html.js.
//
// `prefix` сохраняет ИМЕНА CSS-классов такими же, какими они были в каждом
// модуле раньше (`da-*`/`sa-*`/`acc-*`) — переименование классов затронуло
// бы стили, которых в этом срезе репозитория нет (см. пустой investors.css),
// поэтому явный prefix безопаснее, чем один общий класс на все модули.
import { esc } from './html.js';
import { icon } from './icons.js';

export function loadingHTML(prefix, label = 'Загрузка…') {
  return `<div class="${prefix}-loading"><div class="${prefix}-spinner"></div><span>${esc(label)}</span></div>`;
}

export function errorHTML(prefix, message, retryLabel = 'Повторить') {
  return `<div class="${prefix}-error"><p>${icon('alertTriangle', { className: 'icon--amber' })} ${esc(message)}</p><button class="${prefix}-btn-secondary" data-retry>${esc(retryLabel)}</button></div>`;
}

export function backButtonHTML(prefix, label = 'Назад') {
  return `<button class="${prefix}-back" data-${prefix}-back>← ${esc(label)}</button>`;
}
