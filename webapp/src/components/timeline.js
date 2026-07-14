import { tl } from '../i18n.js';

function template(t) {
  return `
  <div class="t-item ${t.status}">
    <div class="t-dot"></div>
    <div class="t-when">${tl(t.when)}</div>
    <div class="t-title">${tl(t.title)}</div>
    <div class="t-desc">${tl(t.desc)}</div>
    <div class="t-status">${tl(t.tag)}</div>
  </div>`;
}

export function renderTimeline(container, roadmap) {
  container.innerHTML = roadmap.map(template).join('');
}
