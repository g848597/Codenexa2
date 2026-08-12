/**
 * Модуль 2.6 Text Cleaner — реактивная клиентская очистка, чекбоксы
 * применяются последовательно к исходному тексту при каждом изменении
 * (никакого запроса на бэкенд не нужно, как и в спеке).
 */
export interface CleanOptions {
  collapseWhitespace: boolean; // двойные пробелы / пустые строки
  stripMarkdown: boolean; // markdown-символы
  stripEmoji: boolean; // все эмодзи
  normalizeQuotes: boolean; // «умные» кавычки/тире -> обычные
  stripHtml: boolean; // HTML-теги
}

export const DEFAULT_CLEAN_OPTIONS: CleanOptions = {
  collapseWhitespace: true,
  stripMarkdown: true,
  stripEmoji: true,
  normalizeQuotes: true,
  stripHtml: true,
};

// Широкий, но не исчерпывающий диапазон эмодзи-блоков — покрывает
// подавляющее большинство реальных эмодзи, включая флаги и variation selector.
const EMOJI_RE =
  /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\uFE0F\u200D]/gu;

function stripMarkdownSymbols(text: string): string {
  return text
    // изображения и ссылки — оставляем только видимый текст
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // жирный/курсив/зачёркнутый/спойлер/код
    .replace(/(\*\*\*|\*\*|\*|__|_|~~|~|\|\||`{1,3})/g, "")
    // заголовки и цитаты в начале строки
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>+\s?/gm, "")
    // любые оставшиеся "#" — почти всегда markdown-мусор, а не значимый символ в обычном тексте
    .replace(/#+/g, "");
}

function normalizeQuotesAndDashes(text: string): string {
  return text
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-");
}

function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

function collapseWhitespace(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "");
}

export function cleanText(input: string, opts: CleanOptions): string {
  let text = input;
  if (opts.stripHtml) text = stripHtmlTags(text);
  if (opts.stripMarkdown) text = stripMarkdownSymbols(text);
  if (opts.stripEmoji) text = text.replace(EMOJI_RE, "");
  if (opts.normalizeQuotes) text = normalizeQuotesAndDashes(text);
  if (opts.collapseWhitespace) text = collapseWhitespace(text);
  return text;
}
