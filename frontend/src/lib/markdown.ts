/**
 * Модуль 2.4 Markdown Builder.
 *
 * Пользователь печатает/форматирует в одном "каноническом" синтаксисе
 * (жирный **, курсив *, код `, зачёркнутый ~~, спойлер ||, ссылка [t](url),
 * цитата "> " в начале строки), а при экспорте это переводится в нужный
 * формат — Markdown (legacy Telegram), MarkdownV2 или HTML. Простой
 * построчный парсер без вложенности — рассчитан на то, что реально
 * производит тулбар с кнопками, а не на произвольный markdown снаружи.
 */

// ---------- Тулбар: оборачивание выделения в textarea ----------

export interface WrapResult {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

export function wrapSelection(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string = before,
): WrapResult {
  const selected = text.slice(start, end) || "текст";
  const newText = text.slice(0, start) + before + selected + after + text.slice(end);
  return {
    text: newText,
    selectionStart: start + before.length,
    selectionEnd: start + before.length + selected.length,
  };
}

export interface ToolbarAction {
  key: string;
  label: string;
  title: string;
  before: string;
  after: string;
}

export const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { key: "bold", label: "B", title: "Жирный", before: "**", after: "**" },
  { key: "italic", label: "I", title: "Курсив", before: "*", after: "*" },
  { key: "code", label: "</>", title: "Моноширинный", before: "`", after: "`" },
  { key: "strike", label: "S̶", title: "Зачёркнутый", before: "~~", after: "~~" },
  { key: "spoiler", label: "•••", title: "Спойлер", before: "||", after: "||" },
  { key: "quote", label: "❝", title: "Цитата", before: "> ", after: "" },
];

// ---------- Экспорт: канонический синтаксис -> Markdown / MarkdownV2 / HTML ----------

export type ExportFormat = "markdown" | "markdownv2" | "html";

export const EXPORT_FORMATS: { key: ExportFormat; label: string }[] = [
  { key: "markdown", label: "Markdown" },
  { key: "markdownv2", label: "MarkdownV2" },
  { key: "html", label: "HTML" },
];

type SegmentType = "bold" | "italic" | "code" | "strike" | "spoiler" | "link" | "text";

interface Segment {
  type: SegmentType;
  content: string;
  href?: string;
}

const INLINE_PATTERN =
  /(\*\*(.+?)\*\*)|(~~(.+?)~~)|(\|\|(.+?)\|\|)|(`(.+?)`)|(\*(.+?)\*)|(\[(.+?)\]\((\S+?)\))/;

function parseInline(line: string): Segment[] {
  const segments: Segment[] = [];
  let rest = line;
  while (rest.length > 0) {
    const match = rest.match(INLINE_PATTERN);
    if (!match || match.index === undefined) {
      segments.push({ type: "text", content: rest });
      break;
    }
    if (match.index > 0) segments.push({ type: "text", content: rest.slice(0, match.index) });

    if (match[1]) segments.push({ type: "bold", content: match[2] });
    else if (match[3]) segments.push({ type: "strike", content: match[4] });
    else if (match[5]) segments.push({ type: "spoiler", content: match[6] });
    else if (match[7]) segments.push({ type: "code", content: match[8] });
    else if (match[9]) segments.push({ type: "italic", content: match[10] });
    else if (match[11]) segments.push({ type: "link", content: match[12], href: match[13] });

    rest = rest.slice(match.index + match[0].length);
  }
  return segments;
}

// MarkdownV2 требует экранировать эти символы вне code/pre (см. Bot API docs)
const MDV2_ESCAPE_RE = /[_*[\]()~`>#+\-=|{}.!\\]/g;
function escapeMdV2(text: string): string {
  return text.replace(MDV2_ESCAPE_RE, (ch) => `\\${ch}`);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderSegment(seg: Segment, format: ExportFormat): string {
  if (format === "markdown") {
    switch (seg.type) {
      case "bold": return `*${seg.content}*`; // legacy Telegram Markdown: одна звёздочка = bold
      case "italic": return `_${seg.content}_`;
      case "code": return `\`${seg.content}\``;
      case "link": return `[${seg.content}](${seg.href})`;
      // legacy Markdown не поддерживает strikethrough/спойлер — отдаём как обычный текст
      case "strike":
      case "spoiler":
        return seg.content;
      default:
        return seg.content;
    }
  }
  if (format === "markdownv2") {
    switch (seg.type) {
      case "bold": return `*${escapeMdV2(seg.content)}*`;
      case "italic": return `_${escapeMdV2(seg.content)}_`;
      case "code": return `\`${seg.content}\``; // внутри code не экранируем
      case "strike": return `~${escapeMdV2(seg.content)}~`;
      case "spoiler": return `||${escapeMdV2(seg.content)}||`;
      case "link": return `[${escapeMdV2(seg.content)}](${seg.href})`;
      default:
        return escapeMdV2(seg.content);
    }
  }
  // html
  switch (seg.type) {
    case "bold": return `<b>${escapeHtml(seg.content)}</b>`;
    case "italic": return `<i>${escapeHtml(seg.content)}</i>`;
    case "code": return `<code>${escapeHtml(seg.content)}</code>`;
    case "strike": return `<s>${escapeHtml(seg.content)}</s>`;
    case "spoiler": return `<span class="tg-spoiler">${escapeHtml(seg.content)}</span>`;
    case "link": return `<a href="${escapeHtml(seg.href ?? "")}">${escapeHtml(seg.content)}</a>`;
    default:
      return escapeHtml(seg.content);
  }
}

export function exportFormatted(source: string, format: ExportFormat): string {
  return source
    .split("\n")
    .map((line) => {
      const isQuote = line.startsWith("> ");
      const content = isQuote ? line.slice(2) : line;
      const rendered = parseInline(content).map((seg) => renderSegment(seg, format)).join("");
      if (!isQuote) return rendered;
      if (format === "html") return `<blockquote>${rendered}</blockquote>`;
      if (format === "markdownv2") return `>${rendered}`; // MarkdownV2: каждая строка цитаты начинается с ">"
      return `> ${rendered}`; // legacy Markdown цитат не поддерживает — оставляем визуальный маркер
    })
    .join("\n");
}

/** Для live-превью (пузырь чата) — тот же парсер, но сразу в безопасный HTML */
export function renderPreviewHtml(source: string): string {
  return exportFormatted(source, "html").replace(/\n/g, "<br/>");
}
