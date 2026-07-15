// Единая библиотека inline-SVG иконок взамен эмодзи.
// Стиль: line-icons (обводка currentColor, толщина линии 1.75, скругления),
// в духе Lucide/Phosphor. Иконка наследует цвет и размер шрифта родителя
// (width/height: 1em), поэтому подставляется на место emoji без доп. разметки —
// цвет берётся из контекста (обычный текст, .da-inline-error, .danger и т.д.).
//
// Использование: import { icon } from '../utils/icons.js'; ... `${icon('star')}`

const PATHS = {
  // общие интерфейсные
  star: '<path d="M12 2.5l2.7 6.24 6.8.6-5.16 4.5 1.56 6.66L12 16.98 5.9 20.5l1.56-6.66-5.16-4.5 6.8-.6z"/>',
  check: '<polyline points="4 12.5 9.5 18 20 6"/>',
  checkCircle: '<circle cx="12" cy="12" r="8.5"/><polyline points="8.2 12.3 11 15 15.8 9"/>',
  close: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  alertTriangle: '<path d="M12 4.2 21 19.5H3z" stroke-linejoin="round"/><line x1="12" y1="10" x2="12" y2="14.3"/><circle cx="12" cy="17" r="0.15" fill="currentColor" stroke="none"/>',
  refresh: '<path d="M4 12a8 8 0 0 1 13.66-5.66L20 8.5"/><polyline points="20 4 20 8.5 15.5 8.5"/><path d="M20 12a8 8 0 0 1-13.66 5.66L4 15.5"/><polyline points="4 20 4 15.5 8.5 15.5"/>',
  arrowRight: '<line x1="4" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>',

  // люди / организация
  tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 4.8L4 16.4l2.6 2.6 5.3-5.3a4 4 0 0 0 4.8-5.4l-2.6 2.6-2-.6-.6-2z" stroke-linejoin="round"/>',
  user: '<circle cx="12" cy="8.2" r="3.6"/><path d="M4.5 20c1-3.6 4-5.6 7.5-5.6s6.5 2 7.5 5.6"/>',
  users: '<circle cx="8.5" cy="8.5" r="3.2"/><path d="M2.7 19.2c.8-3 3-4.7 5.8-4.7s5 1.7 5.8 4.7"/><path d="M15 8.6a3 3 0 1 1 3.6 2.94"/><path d="M16.8 14.6c2.3.4 3.9 2 4.5 4.6"/>',
  mapPin: '<path d="M12 21S5 14.4 5 9.6a7 7 0 0 1 14 0C19 14.4 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.4"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.6 2.3 4 5.2 4 8.5s-1.4 6.2-4 8.5c-2.6-2.3-4-5.2-4-8.5s1.4-6.2 4-8.5z"/>',

  // документы / файлы
  fileText: '<path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="16.5" x2="15" y2="16.5"/>',
  fileEdit: '<path d="M7 3h6l4 4v6.2"/><path d="M13 3v4h4"/><path d="M7 21H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1"/><path d="M13.5 21.3 13 22l.7-3 6.1-6.1a1.4 1.4 0 0 1 2 2l-6.1 6.1z"/>',
  folder: '<path d="M3 6.2A1.2 1.2 0 0 1 4.2 5h4.7l1.8 2.1h9.1A1.2 1.2 0 0 1 21 8.3v10.5A1.2 1.2 0 0 1 19.8 20H4.2A1.2 1.2 0 0 1 3 18.8z"/>',
  puzzle: '<path d="M9 4.5h3.2a1.6 1.6 0 0 1 0 3.1H12v2.1h2.1v-.2a1.6 1.6 0 1 1 3.1 0v.2H20v3.2a1.6 1.6 0 0 1 0 3.1V19.5h-3.1a1.6 1.6 0 1 0-3.2 0H10.4v-3.1a1.6 1.6 0 1 0-3.1 0H4V13.2a1.6 1.6 0 0 0 0-3.1V7.2a1.6 1.6 0 0 1 1.6-1.6H9z" stroke-linejoin="round"/>',
  ruler: '<rect x="3" y="7" width="18" height="10" rx="1.2"/><path d="M7 7v3.2M11 7v2M15 7v3.2M19 7v2"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.6-.8 1.6-1.6 0-.4-.2-.8-.2-1.2a1.5 1.5 0 0 1 1.5-1.5H17a3.5 3.5 0 0 0 3.5-3.5C20.5 7.4 16.7 3.5 12 3.5z"/><circle cx="7.3" cy="11" r="1"/><circle cx="9.6" cy="7.3" r="1"/><circle cx="14.4" cy="7.3" r="1"/><circle cx="16.7" cy="11" r="1"/>',
  save: '<path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M8 4v5h7V4"/><path d="M7.5 14h9v6h-9z"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2"/><path d="M6.5 7l.9 12a1.2 1.2 0 0 0 1.2 1.1h6.8a1.2 1.2 0 0 0 1.2-1.1l.9-12"/><line x1="10" y1="11" x2="10" y2="16.5"/><line x1="14" y1="11" x2="14" y2="16.5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="1.4"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/>',
  creditCard: '<rect x="3" y="5.5" width="18" height="13" rx="1.6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="6.5" y1="14.5" x2="10.5" y2="14.5"/>',

  // прочее
  bot: '<rect x="4.5" y="9" width="15" height="10.5" rx="2.2"/><line x1="12" y1="5.5" x2="12" y2="9"/><circle cx="12" cy="4" r="1.1" fill="currentColor" stroke="none"/><circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.2" fill="currentColor" stroke="none"/><path d="M8.5 17.5h7"/>',
  sparkles: '<path d="M12 3.5l1.5 4.2 4.2 1.5-4.2 1.5-1.5 4.2-1.5-4.2-4.2-1.5 4.2-1.5z"/><path d="M19 14.5l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/>',
  briefcase: '<rect x="3" y="8" width="18" height="11.5" rx="1.6"/><path d="M8.3 8V6.2a1.6 1.6 0 0 1 1.6-1.6h4.2a1.6 1.6 0 0 1 1.6 1.6V8"/><path d="M3 13.2h18"/><path d="M10.6 13.2h2.8v1.9h-2.8z"/>',
  scale: '<path d="M12 3v17.5"/><path d="M7.5 20.5h9"/><path d="M12 5.5 5 8.2l3.4 6.9a4 4 0 0 0 7.2 0L19 8.2z" stroke-linejoin="round"/><path d="M5 8.2h6M13 8.2h6"/>',
  receipt: '<path d="M6 3h12v18l-2.2-1.5L14 21l-2-1.5L10 21l-1.8-1.5L6 21z" stroke-linejoin="round"/><line x1="8.5" y1="8" x2="15.5" y2="8"/><line x1="8.5" y1="11.5" x2="15.5" y2="11.5"/><line x1="8.5" y1="15" x2="13" y2="15"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3.4 2"/>',
  shieldCheck: '<path d="M12 3.3 19 6v6.2c0 4.6-3 7.7-7 8.5-4-.8-7-3.9-7-8.5V6z" stroke-linejoin="round"/><polyline points="8.7 12.3 11 14.6 15.4 9.8"/>',
  download: '<path d="M12 3.5v11.2"/><polyline points="7.5 10.5 12 15 16.5 10.5"/><path d="M4.5 17v2.3a1.2 1.2 0 0 0 1.2 1.2h12.6a1.2 1.2 0 0 0 1.2-1.2V17"/>',
  zap: '<path d="M12.8 2.8 5.5 13.4h4.9l-1.4 7.8 8.5-11.6h-5.3z" stroke-linejoin="round"/>',
  layers: '<path d="M12 3.5 3.5 8.2 12 12.9l8.5-4.7z" stroke-linejoin="round"/><path d="M3.5 12.4 12 17.1l8.5-4.7"/><path d="M3.5 16.6 12 21.3l8.5-4.7"/>',
  rocket: '<path d="M12 3c2.6 1.4 4.6 4.3 4.6 8.4 0 2-.5 3.6-1.1 4.8H8.5c-.6-1.2-1.1-2.8-1.1-4.8C7.4 7.3 9.4 4.4 12 3z"/><circle cx="12" cy="10.8" r="1.6"/><path d="M8.5 16.2 6 20l3-1.3M15.5 16.2 18 20l-3-1.3"/>',
  ball: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8.3l3.2 2.3-1.2 3.7H10L8.8 10.6z"/><path d="M12 8.3V4.8M15.2 10.6l3.3-1M13 14.3l1.8 3.2M11 14.3l-1.8 3.2M8.8 10.6l-3.3-1"/>',
  stadium: '<path d="M4 15.5c0-3.6 3.6-6.5 8-6.5s8 2.9 8 6.5"/><path d="M4 15.5v3.2h16v-3.2"/><path d="M8 15.5c0-2 1.8-3.6 4-3.6s4 1.6 4 3.6"/>',
};

/**
 * Возвращает inline-SVG строку для имени иконки.
 * @param {keyof typeof PATHS} name
 * @param {{size?: number|string, className?: string, strokeWidth?: number}} [opts]
 */
export function icon(name, opts = {}) {
  const body = PATHS[name];
  if (!body) return '';
  const size = opts.size ?? '1em';
  const sw = opts.strokeWidth ?? 1.75;
  const cls = opts.className ? ` ${opts.className}` : '';
  return `<svg class="icon${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
