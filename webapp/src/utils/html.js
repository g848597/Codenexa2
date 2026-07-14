// Раньше esc()/escAttr() были продублированы почти буквально в 8 файлах
// (docsApp.js, investorsAdmin.js, trust.js, sportApp.js, accountApp.js,
// partners.js, investors.js, hero.js) — см. аудит, раздел 2 ("Дублирование")
// и раздел 12 ("Объединить"). Один общий модуль означает, что усилить
// экранирование (например, добавить санитайзер для href) теперь нужно
// в одном месте, а не в восьми.

/** Экранирует пользовательский текст перед вставкой в innerHTML. */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** То же самое, но дополнительно экранирует одинарную кавычку — для
 * вставки в атрибуты, обёрнутые в '...'. */
export function escAttr(s) {
  return esc(s).replace(/'/g, '&#39;');
}
