/**
 * Раздел «Контент» генерирует готовый текст сообщения (не канонический
 * синтаксис редактора, как lib/markdown.ts) — иногда с реальным Telegram
 * legacy Markdown *bold* (один астериск, см. app/content_logic.py
 * build_welcome_message/build_group_rules) для названия канала/заголовка
 * правил. Простой рендер для live-превью в виде пузыря Telegram:
 * экранируем HTML, переносы строк -> <br/>, *bold* -> <b>.
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderTelegramBubbleHtml(text: string): string {
  const escaped = escapeHtml(text);
  const withBold = escaped.replace(/\*(.+?)\*/g, "<b>$1</b>");
  return withBold.replace(/\n/g, "<br/>");
}
